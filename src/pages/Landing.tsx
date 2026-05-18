import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Calendar, MapPin, Sparkles, AlertCircle, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Landing() {
  const { signIn } = useAuthStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ignoreWarning, setIgnoreWarning] = useState(false);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signIn();
    } catch (error: any) {
      if (error?.message?.includes('disallowed_useragent') || error?.code === 'auth/disallowed-useragent') {
        setAuthError('in_app_browser');
        setIgnoreWarning(false);
      } else if (error?.message === 'popup-blocked' || error?.code === 'auth/popup-blocked') {
        setAuthError('popup_blocked');
      } else {
        setAuthError('unknown');
      }
    }
  };

  const isInAppBrowser = () => {
    if (ignoreWarning) return false;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    return /KAKAOTALK|Instagram|NAVER|FBAN|FBAV|Line|Daum|Twitter|Snapchat/i.test(ua);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-surface-container-lowest rounded-3xl shadow-sm border border-surface-container-highest overflow-hidden relative"
      >
        {authError === 'in_app_browser' || isInAppBrowser() ? (
          <div className="absolute inset-0 bg-surface-container-lowest z-10 p-8 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 bg-error-container text-on-error-container rounded-full flex items-center justify-center">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">인앱 브라우저 제한 안내</h3>
              <p className="text-on-surface-variant text-sm mb-4 break-keep">
                카카오톡, 인스타그램 등의 브라우저에서는 구글 로그인이 원활하지 않습니다. 아래 버튼을 눌러 링크를 복사한 후 <b>사파리(Safari)</b>나 <b>크롬(Chrome)</b>에서 열어주세요.
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
              {copied ? '링크가 복사되었습니다!' : '링크 복사하기'}
            </button>
            <button
              onClick={() => {
                setIgnoreWarning(true);
                setAuthError(null);
                handleSignIn();
              }}
              className="text-primary text-sm underline underline-offset-2 mt-4"
            >
              그래도 계속 시도하기
            </button>
          </div>
        ) : null}

        <div className="p-8 text-center bg-surface-container-lowest border-b border-surface-container-highest text-on-surface relative">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 relative flex items-center justify-center shrink-0">
              <div className="absolute w-8 h-8 rounded-full bg-[#5D5FEF] opacity-80 -translate-x-2"></div>
              <div className="absolute w-8 h-8 rounded-full bg-[#FFD338] opacity-80 translate-x-2 mix-blend-multiply"></div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-headline font-black text-primary tracking-tight">언제어디</h2>
          </div>
          <h1 className="text-xl sm:text-2xl font-headline font-bold mb-4 text-on-surface-variant tracking-tight leading-tight break-keep">
            시간 추합부터 장소 추천까지,<br/>AI가 알아서 척척! <span className="inline-block bg-surface-container-high border-2 border-primary text-primary font-mono text-sm px-1.5 py-0.5 rounded shadow-[2px_2px_0px_#5D5FEF] ml-1 align-middle -mt-1"><span className="animate-pulse mr-1">&gt;_</span>👾</span>
          </h1>
          <p className="opacity-90 font-medium text-on-surface-variant leading-relaxed break-keep text-sm sm:text-base">
            안 읽씹하는 친구 독려도 AI 총대에게 맡기세요.<br/>
            스트레스 제로 일정 조율 앱, 언제어디.
          </p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <Feature icon="📅" text="번거로운 시간 추합을 쉽게" />
            <Feature icon="📍" text="서로의 선호도를 묻고 위치 추천" />
          </div>

          <button 
            onClick={handleSignIn}
            className="w-full bg-primary-container text-on-primary-container font-headline font-bold py-4 rounded-xl transition-all chunky-shadow active:scale-[0.98] flex items-center justify-center gap-2 relative"
          >
            Google 계정으로 시작하기
          </button>
          {authError === 'unknown' && (
            <p className="text-error text-sm text-center font-medium mt-2">로그인 중 오류가 발생했습니다. 다시 시도해주세요.</p>
          )}
          {authError === 'popup_blocked' && (
            <p className="text-error text-sm text-center font-medium mt-2 leading-tight">팝업 차단 또는 광고 차단 프로그램이 감지되었습니다.<br/>브라우저 설정에서 <b>팝업 차단을 해제</b>하거나 <b>AdGuard 등을 끄고</b> 다시 시도해주세요.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center gap-3 text-on-surface">
      <div className="w-10 h-10 bg-surface-container-highest rounded-xl flex items-center justify-center text-xl text-primary">{icon}</div>
      <span className="font-bold flex-1">{text}</span>
    </div>
  );
}

