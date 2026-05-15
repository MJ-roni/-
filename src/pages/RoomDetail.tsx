import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { handleFirestoreError, db, OperationType } from '../lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, serverTimestamp, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ArrowLeft, Clock, MapPin, CheckCircle, Sparkles, Share2 } from 'lucide-react';
import { format } from 'date-fns';

import { recommendFinalPlan, getUrgeMessage } from '../lib/aiService';

export default function RoomDetail() {
  const { roomId } = useParams();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const [room, setRoom] = useState<any>(null);
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [myAvailability, setMyAvailability] = useState<any>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [inputDate, setInputDate] = useState('');
  const [inputTime, setInputTime] = useState('');
  const [inputLoc, setInputLoc] = useState('');

  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [recommending, setRecommending] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    
    const roomRef = doc(db, 'rooms', roomId);
    const unRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoom({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("방이 존재하지 않습니다.");
        navigate('/dashboard');
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`));

    const availRef = collection(db, 'rooms', roomId, 'availabilities');
    const unAvail = onSnapshot(availRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setAvailabilities(list);
      if (user) {
        const mine = list.find(a => a.userId === user.uid);
        if (mine) {
          setMyAvailability(mine);
          if (!inputDate && mine.possibleDates?.length > 0) setInputDate(mine.possibleDates[0]);
          if (!inputTime && mine.possibleTimes?.length > 0) setInputTime(mine.possibleTimes[0]);
          if (!inputLoc && mine.possibleLocations?.length > 0 || mine.preferredLocations?.length > 0) setInputLoc(mine.preferredLocations[0] || mine.possibleLocations?.[0] || '');
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/availabilities`));
    
    // final results
    const finalRef = collection(db, 'rooms', roomId, 'finals');
    const unFinal = onSnapshot(finalRef, (snapshot) => {
      if (!snapshot.empty) {
        setFinalResult({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/finals`));

    setLoading(false);
    return () => {
      unRoom();
      unAvail();
      unFinal();
    };
  }, [roomId, user, navigate]);

  useEffect(() => {
    if (room && user && !room.participantIds?.includes(user.uid)) {
      updateDoc(doc(db, 'rooms', room.id), {
        participantIds: arrayUnion(user.uid)
      }).catch(err => {
        console.error("Failed to add participant to room", err);
      });
    }
  }, [room?.id, room?.participantIds, user]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    const shareText = `[${room.title}] 약속 방에 초대합니다!\n\n링크: ${url}\n초대 코드: ${room.inviteCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: room.title,
          text: shareText,
        });
        return;
      } catch (err) {
        console.log('Share failed or cancelled', err);
      }
    }
    
    try {
      await navigator.clipboard.writeText(shareText);
      addToast(`초대 링크와 코드가 복사되었습니다!`, 'success');
    } catch (err) {
      // In case clipboard fails (e.g., iframe restrictions)
      addToast(`초대 코드: ${room.inviteCode}\n(링크 복사가 제한된 환경입니다)`, 'info');
    }
  };

  const handleSaveAvailability = async () => {
    if (!user || !roomId) return;
    if (!inputDate.trim() && !inputTime.trim() && !inputLoc.trim()) {
      addToast('날짜, 시간, 장소 중 최소 하나는 입력해주세요! 그래야 조율할 수 있어요 🙏', 'error');
      return;
    }

    setIsSavingAvailability(true);
    try {
      const newDates = inputDate.trim() ? [inputDate.trim()] : [];
      const newTimes = inputTime.trim() ? [inputTime.trim()] : [];
      const newLocs = inputLoc.trim() ? [inputLoc.trim()] : [];

      const ref = doc(db, 'rooms', roomId, 'availabilities', user.uid);
      await setDoc(ref, {
        userId: user.uid,
        possibleDates: newDates.slice(0, 50),
        possibleTimes: newTimes.slice(0, 50),
        preferredLocations: newLocs.slice(0, 20),
        isSubmitted: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      addToast('의견이 성공적으로 저장되었습니다!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/availabilities/${user.uid}`);
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const handleCloseRoom = async () => {
    if (!roomId) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'closed'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
    }
  };

  const handleAiRecommendation = async () => {
    if (!roomId || !user) return;
    setRecommending(true);
    try {
      const plan = await recommendFinalPlan(availabilities.length, availabilities);
      
      const finalRef = doc(collection(db, 'rooms', roomId, 'finals'));
      await setDoc(finalRef, {
        roomId: roomId,
        finalDate: plan?.finalDate || 'AI 분석 실패',
        finalTime: plan?.finalTime || 'AI 분석 실패',
        finalLocation: plan?.finalLocation || 'AI 분석 실패',
        recommendationReason: plan?.recommendationReason || '분석 중 오류가 발생했어요 ㅠㅠ 다시 시도해주세요!',
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'finalized'
      });
      setRecommending(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/finals`);
      setRecommending(false);
    }
  };

  const handleUrgeFriends = async () => {
    if (!room) return;
    const missing = ["미응답자 친구들"];
    const msg = await getUrgeMessage(room.title, missing, '조만간');
    if(msg) {
      addToast(msg, 'success');
    } else {
      addToast("AI 메시지 생성에 실패했어요 ㅠㅠ", 'error');
    }
  };

  if (loading) return <div className="text-center mt-20">Loading...</div>;
  if (!room) return <div className="text-center mt-20">Room not found</div>;

  const isHost = user?.uid === room.hostId;

  return (
    <div className="min-h-screen bg-background text-on-background font-body pb-24">
      <header className="bg-surface border-b border-surface-container-highest px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button onClick={() => navigate('/dashboard')} className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low transition shrink-0">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-headline font-extrabold text-primary tracking-tight truncate">{room.title}</h1>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5">
              <span className="text-[10px] sm:text-xs font-label font-medium text-on-surface-variant shrink-0">참여자: {availabilities.length}명</span>
              <span className="text-[10px] font-mono text-outline bg-surface-container-high px-1 sm:px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">코드:{room.inviteCode}</span>
            </div>
          </div>
        </div>
        <button onClick={handleCopyLink} className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-label font-bold text-on-secondary-container bg-secondary-container px-2 sm:px-3 py-1.5 sm:py-1.5 rounded-lg border border-[#FFE1CC]/0 hover:brightness-95 transition chunky-shadow shrink-0 ml-1">
          <Share2 className="w-3.5 h-3.5"/> <span className="hidden sm:inline">초대</span><span className="sm:hidden">공유</span>
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        {/* Status Banner */}
        {room.status === 'finalized' && finalResult ? (
          <section className="bg-primary-container rounded-[24px] p-8 text-on-primary-container shadow-sm border border-surface-container-highest relative overflow-hidden ai-glow">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <h2 className="text-2xl font-headline font-extrabold flex items-center gap-2 mb-6 relative z-10">
              <CheckCircle className="text-primary-fixed-dim w-8 h-8"/> 
              약속이 확정되었습니다!
            </h2>
            <div className="bg-surface-container-lowest/90 backdrop-blur-md rounded-2xl p-6 space-y-4 border border-surface-container-highest relative z-10 shadow-sm text-on-surface">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 text-xl font-headline font-extrabold">
                  📅
                </div>
                <div>
                  <p className="text-sm text-on-surface-variant font-label mb-1">날짜 및 시간</p>
                  <p className="text-lg font-headline font-bold">{finalResult.finalDate} &middot; {finalResult.finalTime}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 text-xl font-headline font-extrabold">
                  📍
                </div>
                <div>
                  <p className="text-sm text-on-surface-variant font-label mb-1">장소</p>
                  <p className="text-lg font-headline font-bold">{finalResult.finalLocation}</p>
                </div>
              </div>
              {finalResult.recommendationReason && (
                <div className="mt-6 pt-4 border-t border-surface-container-highest text-sm opacity-90 leading-relaxed font-body whitespace-pre-wrap">
                  <span className="font-label font-bold text-on-secondary-container bg-secondary-container px-2 py-1 rounded-md mr-2">AI 브리핑</span> 
                  {finalResult.recommendationReason}
                </div>
              )}
            </div>
          </section>
        ) : (
           <div className={`p-4 rounded-2xl flex items-center gap-3 border ${room.status === 'open' ? 'bg-primary-container/20 text-primary border-primary/30 ai-glow' : 'bg-surface-container-low text-on-surface-variant border-surface-container-highest'}`}>
             <div className="flex-1">
               <p className="font-headline font-bold">{room.status === 'open' ? '현재 의견을 조율 중입니다.' : '의견 취합이 마감되었습니다.'}</p>
               {room.status === 'open' && <p className="text-sm font-label opacity-80 mt-1">모든 친구들이 가능한 일정을 남기도록 독려해주세요.</p>}
             </div>
           </div>
        )}

        {/* Input Section (If open) */}
        {room.status === 'open' && (
          <section className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-surface-container-highest">
            <h2 className="text-lg font-headline font-extrabold text-on-surface mb-6">내 가능 일정 등록</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-label font-bold text-outline mb-2 uppercase tracking-wide">가능한 날짜 (e.g. 10/24, 이번주 주말)</label>
                <div className="flex gap-2">
                  <input type="text" value={inputDate} onChange={e => setInputDate(e.target.value)} className="flex-1 rounded-xl px-4 py-3 border border-surface-container-highest bg-surface-container-low font-body focus:bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-outline"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-label font-bold text-outline mb-2 uppercase tracking-wide">가능한 시간대 (e.g. 오후 6시 이후)</label>
                <div className="flex gap-2">
                  <input type="text" value={inputTime} onChange={e => setInputTime(e.target.value)} className="flex-1 rounded-xl px-4 py-3 border border-surface-container-highest bg-surface-container-low font-body focus:bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-outline"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-label font-bold text-outline mb-2 uppercase tracking-wide">선호/기피 장소 (e.g. 강남역 선호, 건대 거절)</label>
                 <div className="flex gap-2">
                  <input type="text" value={inputLoc} onChange={e => setInputLoc(e.target.value)} className="flex-1 rounded-xl px-4 py-3 border border-surface-container-highest bg-surface-container-low font-body focus:bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-outline"/>
                </div>
              </div>
              <button 
                onClick={handleSaveAvailability}
                disabled={isSavingAvailability}
                className="w-full bg-primary-container text-on-primary-container font-headline font-bold py-4 rounded-xl transition chunky-shadow active:scale-95 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingAvailability ? '저장 중...' : '의견 저장하기'}
              </button>
            </div>

            {/* My Current Inputs List */}
            {myAvailability && ((myAvailability.possibleDates?.length > 0) || (myAvailability.possibleTimes?.length > 0) || (myAvailability.preferredLocations?.length > 0)) && (
              <div className="mt-8 pt-6 border-t border-surface-container-highest">
                <h3 className="text-xs font-label font-bold text-outline mb-4 uppercase tracking-widest">내가 제안한 내용</h3>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-on-surface">
                  {myAvailability.possibleDates?.map((d: string, i: number) => <span key={i} className="px-3 py-1.5 bg-surface-container-low border border-surface-container-highest rounded-lg">{d}</span>)}
                  {myAvailability.possibleTimes?.map((t: string, i: number) => <span key={i} className="px-3 py-1.5 bg-surface-container-low border border-surface-container-highest rounded-lg">{t}</span>)}
                  {myAvailability.preferredLocations?.map((l: string, i: number) => <span key={i} className="px-3 py-1.5 bg-surface-container-low border border-surface-container-highest rounded-lg">{l}</span>)}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Participants Summary */}
        <section className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-surface-container-highest">
          <h2 className="text-lg font-headline font-extrabold text-on-surface mb-6">참여자 현황 ({availabilities.length}명)</h2>
          <div className="space-y-4">
            {availabilities.length === 0 ? (
              <p className="text-outline font-body text-center py-4">아직 참여자가 없습니다.</p>
            ) : (
              availabilities.map((av) => (
                <div key={av.id} className="border border-surface-container-highest rounded-2xl p-4 bg-surface-container-lowest shadow-sm">
                  <div className="font-headline font-bold text-on-surface flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center text-sm font-extrabold">
                      {av.userId?.substring(0,2)}
                    </div>
                    익명 친구 {av.userId?.substring(0,4)}
                  </div>
                  <div className="text-sm font-label text-on-surface-variant space-y-1.5 pl-13">
                    <p><span className="text-outline font-bold">날짜:</span> {av.possibleDates?.join(', ') || '미입력'}</p>
                    <p><span className="text-outline font-bold">시간:</span> {av.possibleTimes?.join(', ') || '미입력'}</p>
                    <p><span className="text-outline font-bold">장소:</span> {av.preferredLocations?.join(', ') || '미입력'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* AI Action / Host Action (M-1) */}
        {isHost && room.status !== 'finalized' && (
          <section className="bg-surface-container-lowest rounded-[24px] p-8 shadow-sm border border-surface-container-highest ai-glow mt-8">
            <h2 className="text-2xl font-headline font-extrabold mb-3 flex items-center gap-3 text-on-surface">
              <span className="text-3xl">🤖</span>
              AI 총대 봇
            </h2>
            <p className="text-sm font-body text-on-surface-variant mb-8 leading-relaxed">
              모든 인원이 의견을 작성했나요? AI가 각자의 상황을 분석하여<br/>
              모두가 만족할 최적의 시간과 장소를 추천해줍니다.
            </p>
            
            {room.status === 'open' ? (
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleUrgeFriends}
                  className="w-full bg-primary/10 hover:bg-primary/20 text-primary font-headline font-bold py-4 rounded-xl transition chunky-shadow active:scale-95 border border-primary/20"
                >
                  미응답자 재촉하기
                </button>
                <button 
                  onClick={handleCloseRoom}
                  className="w-full bg-surface-container-high hover:bg-surface-dim text-on-surface font-headline font-bold py-4 rounded-xl transition chunky-shadow active:scale-95 border border-surface-container-highest"
                >
                  취합 마감하기
                </button>
              </div>
            ) : (
               <button 
                onClick={handleAiRecommendation}
                disabled={recommending}
                className="w-full bg-secondary-container text-on-secondary-container hover:brightness-95 font-headline font-extrabold py-4 text-lg rounded-xl transition flex items-center justify-center gap-2 chunky-shadow disabled:opacity-50 active:scale-95"
              >
                {recommending ? 'AI 분석 중...' : '완벽한 약속 만들기 🚀'}
              </button>
            )}
          </section>
        )}

      </main>
    </div>
  );
}

function CalendarIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
