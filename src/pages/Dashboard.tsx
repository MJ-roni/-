import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { handleFirestoreError, db, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, onSnapshot, or } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Users, Edit3, Trash2, Sparkles, Copy } from 'lucide-react';
import { format } from 'date-fns';

interface Room {
  id: string;
  title: string;
  hostId: string;
  status: string;
  createdAt: any;
  inviteCode?: string;
  participantIds?: string[];
}

export default function Dashboard() {
  const { user, signOut } = useAuthStore();
  const { addToast } = useToastStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, 'rooms'), 
      or(
        where('hostId', '==', user.uid),
        where('participantIds', 'array-contains', user.uid)
      )
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      data.sort((a, b) => {
        const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const db = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return db - da;
      });
      setRooms(data);
      setLoading(false);
    }, (err) => {
      setLoading(false);
      
      const errorMessage = typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : String(err);
      if (errorMessage.includes('requires an index') || errorMessage.includes('FAILED_PRECONDITION')) {
        addToast('⚠️ 데이터베이스 인덱스가 설정되지 않았습니다. Firebase 콘솔에서 인덱스 생성 링크를 클릭해야 합니다.', 'error');
        console.error("Firebase Index Error:", errorMessage);
      } else {
        addToast('목록을 불러오는 중 오류가 발생했습니다.', 'error');
      }

      try {
        handleFirestoreError(err, OperationType.LIST, 'rooms');
      } catch (handleErr) {
        console.error(handleErr);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTitle.trim()) {
      addToast('방 제목을 입력해주세요! e.g. 1학기 고향 친구들 모임', 'error');
      return;
    }
    if (!user) return;
    
    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'rooms'), {
        title: newRoomTitle,
        hostId: user.uid,
        status: 'open',
        createdAt: serverTimestamp(),
        deadline: null,
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        participantIds: [user.uid]
      });
      addToast(`📢 [${newRoomTitle}] 방 오픈! 시간 안 적으면 총대가 임의로 정한다? 얼른 들어와! 🏃‍♂️`, 'success');
      navigate(`/room/${docRef.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'rooms');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      addToast('초대 코드를 입력해주세요', 'error');
      return;
    }
    if (joinCode.trim().length !== 6) {
      addToast('초대 코드는 6자리여야 합니다.', 'error');
      return;
    }
    setIsJoining(true);
    try {
      const q = query(collection(db, 'rooms'), where('inviteCode', '==', joinCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        addToast('잘못된 초대 코드입니다. 다시 확인해주세요!', 'error');
      } else {
        navigate(`/room/${snap.docs[0].id}`);
      }
    } catch (err) {
      addToast('초대 코드로 방을 찾는 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyInviteCode = async (e: React.MouseEvent, inviteCode: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(inviteCode);
      addToast(`초대 코드 [${inviteCode}] 복사 완료! 친구들에게 공유해봐!`, 'success');
    } catch (err) {
      addToast(`초대 코드: ${inviteCode}\n(복사가 제한된 환경입니다)`, 'info');
    }
  };

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, roomId: string | null}>({isOpen: false, roomId: null});
  const [promptModal, setPromptModal] = useState<{isOpen: boolean, roomId: string | null, currentTitle: string, newTitle: string}>({isOpen: false, roomId: null, currentTitle: '', newTitle: ''});
  const [isEditing, setIsEditing] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirmModal({ isOpen: true, roomId });
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal.roomId) return;
    try {
      const roomToDelete = rooms.find(r => r.id === confirmModal.roomId);
      await deleteDoc(doc(db, 'rooms', confirmModal.roomId));
      if (roomToDelete) {
        addToast(`😭 [${roomToDelete.title}] 약속이 아쉽게 취소됐어. 이번엔 인연이 아니었나 봐! 다음에 더 좋은 날에 다시 만나자.`, 'info');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rooms/${confirmModal.roomId}`);
    } finally {
      setConfirmModal({ isOpen: false, roomId: null });
    }
  };

  const handleEditClick = (e: React.MouseEvent, roomId: string, currentTitle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setPromptModal({ isOpen: true, roomId, currentTitle, newTitle: currentTitle });
  };

  const handleConfirmEdit = async () => {
    if (!promptModal.roomId) return;
    const { roomId, newTitle, currentTitle } = promptModal;
    if (!newTitle || newTitle.trim() === '') {
      addToast('방 제목을 비워둘 수 없습니다.', 'error');
      return;
    }
    if (newTitle.trim() === currentTitle) {
      setPromptModal({ isOpen: false, roomId: null, currentTitle: '', newTitle: '' });
      return;
    }
    
    setIsEditing(true);
    try {
      await updateDoc(doc(db, 'rooms', roomId), { title: newTitle.trim() });
      addToast(`🔔 [${newTitle.trim()}] 정보가 바뀌었어! 총대가 더 좋은 조건으로 수정했으니 다시 한번 확인해 봐! ✨`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
    } finally {
      setIsEditing(false);
      setPromptModal({ isOpen: false, roomId: null, currentTitle: '', newTitle: '' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body pb-20">
      <header className="bg-surface border-b border-surface-container-highest px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex items-center justify-center shrink-0">
            <div className="absolute w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#5D5FEF] opacity-80 -translate-x-1.5 sm:-translate-x-2"></div>
            <div className="absolute w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#FFD338] opacity-80 translate-x-1.5 sm:translate-x-2 mix-blend-multiply"></div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-headline font-extrabold tracking-tight text-primary truncate border-none m-0 leading-tight">언제어디 홈</h1>
            <p className="text-[10px] sm:text-xs font-medium text-on-surface-variant truncate">환영합니다, {user?.displayName || '사용자'}님</p>
          </div>
        </div>
        <button onClick={signOut} className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center rounded-xl hover:bg-surface-container-low transition-colors active:scale-95 duration-200 ml-2">
          <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        
        <section className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-surface-container-highest ai-glow">
          <h2 className="text-lg font-headline font-extrabold text-on-surface mb-4">새로운 약속 잡기</h2>
          <form onSubmit={handleCreateRoom} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="e.g. 1학기 고향 친구들 모임"
              value={newRoomTitle}
              onChange={(e) => setNewRoomTitle(e.target.value)}
              className="flex-1 rounded-xl border border-surface-container-highest bg-surface-container-lowest px-4 py-3 font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-outline"
              disabled={isCreating}
            />
            <button 
              type="submit" 
              disabled={!newRoomTitle.trim() || isCreating}
              className="bg-secondary-container text-on-secondary-container sm:px-6 px-4 py-3 rounded-xl font-headline font-bold transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 chunky-shadow active:scale-95 duration-150 shrink-0"
            >
              {isCreating ? '생성 중...' : <><Plus className="w-5 h-5"/> 방 만들기</>}
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-surface-container-highest">
            <h2 className="text-lg font-headline font-extrabold text-on-surface mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              초대 코드로 입장
            </h2>
            <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="코드 6자리 입력"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-1 rounded-xl border border-surface-container-highest bg-surface-container-lowest px-4 py-3 font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-outline uppercase text-center sm:text-left tracking-widest sm:tracking-normal"
                disabled={isJoining}
                maxLength={6}
              />
              <button 
                type="submit" 
                disabled={!joinCode.trim() || isJoining || joinCode.trim().length !== 6}
                className="bg-primary text-on-primary sm:px-6 px-4 py-3 rounded-xl font-headline font-bold transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 chunky-shadow active:scale-95 duration-150 shrink-0"
              >
                {isJoining ? '입장 중...' : '입장하기'}
              </button>
            </form>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-headline font-extrabold text-on-surface">내가 만든 약속 방</h2>
            <span className="text-xs font-bold text-primary bg-primary-container/10 px-3 py-1 rounded-full border border-primary/20">{rooms.length}</span>
          </div>
          
          {loading ? (
            <div className="text-center py-10 font-bold text-outline">불러오는 중...</div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-lowest rounded-[24px] border-2 border-surface-container-highest border-dashed shadow-sm">
              <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center text-3xl mx-auto mb-4">👻</div>
              <p className="text-on-surface font-headline font-bold">아직 만든 약속 방이 없어요.</p>
              <p className="text-sm font-medium text-on-surface-variant mt-1">위에서 첫 번째 약속 방을 만들어보세요!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rooms.map(room => (
                <div 
                  key={room.id}
                  onClick={() => navigate(`/room/${room.id}`)}
                  className="bg-surface-container-lowest p-6 rounded-[24px] shadow-sm border border-surface-container-highest cursor-pointer hover:border-primary hover:shadow-md transition-all group flex flex-col gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl shrink-0">
                      🔥
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1 truncate pr-2">{room.title}</h3>
                        <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider shrink-0 border ${
                          room.status === 'open' ? 'bg-secondary-container text-on-secondary-container border-secondary-fixed-dim' : 
                          room.status === 'closed' ? 'bg-surface-container-highest text-on-surface-variant border-outline-variant' : 'bg-primary-container text-on-primary-container border-primary'
                        }`}>
                          {room.status === 'open' ? '조율 중' : room.status === 'closed' ? '마감됨' : '확정됨'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs font-semibold text-on-surface-variant shrink-0">
                          생성일: {room.createdAt?.toDate ? format(room.createdAt.toDate(), 'yyyy.MM.dd') : '알 수 없음'}
                        </p>
                        {room.inviteCode && (
                          <div 
                            className="flex items-center gap-1.5 bg-surface-container-high px-2 py-0.5 rounded text-[10px] sm:text-xs font-mono font-bold text-on-surface-variant hover:text-primary hover:bg-primary/10 transition cursor-pointer"
                            onClick={(e) => handleCopyInviteCode(e, room.inviteCode)}
                            title="초대 코드 복사"
                          >
                            <span>코드: {room.inviteCode}</span>
                            <Copy className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2 border-t border-surface-container-highest pt-3">
                    <button 
                      onClick={(e) => {
                        if (room.status === 'open') {
                          handleEditClick(e, room.id, room.title);
                        } else {
                          e.stopPropagation();
                          e.preventDefault();
                          addToast('앗, 수정 실패! ㅠㅠ 마감 기한이 지나서 이미 시간 조율이 시작됐어. 꼭 바꿔야 한다면 방을 새로 만들어야 해!', 'error');
                        }
                      }}
                      className={`px-3 py-1.5 sm:py-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0 ${
                        room.status === 'open' 
                          ? 'text-on-surface-variant hover:text-primary hover:bg-primary/10' 
                          : 'text-on-surface-variant/50 hover:bg-surface-container-highest'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" /> 수정
                    </button>
                    <button 
                      onClick={(e) => handleDeleteClick(e, room.id)}
                      className="px-3 py-1.5 sm:py-2 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modals for restricted iframe environments */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-lg border border-surface-container-highest animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-headline font-bold text-on-surface mb-2">약속 방 삭제</h3>
            <p className="text-on-surface-variant font-medium text-sm mb-6">정말로 이 약속 방을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmModal({isOpen: false, roomId: null})} className="px-4 py-2 font-bold font-headline text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors">취소</button>
              <button onClick={handleConfirmDelete} className="px-4 py-2 font-bold font-headline text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors chunky-shadow active:scale-95">삭제하기</button>
            </div>
          </div>
        </div>
      )}
      
      {promptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-lg border border-surface-container-highest animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-headline font-bold text-on-surface mb-4">방 제목 수정</h3>
            <input 
              type="text" 
              value={promptModal.newTitle}
              onChange={(e) => setPromptModal(prev => ({...prev, newTitle: e.target.value}))}
              className="w-full mb-6 rounded-xl border border-surface-container-highest bg-surface p-3 font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button disabled={isEditing} onClick={() => setPromptModal({isOpen: false, roomId: null, currentTitle: '', newTitle: ''})} className="px-4 py-2 font-bold font-headline text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors disabled:opacity-50">취소</button>
              <button disabled={isEditing} onClick={handleConfirmEdit} className="px-4 py-2 font-bold font-headline text-on-primary bg-primary hover:bg-primary/90 rounded-xl transition-colors chunky-shadow active:scale-95 disabled:opacity-50">
                {isEditing ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
