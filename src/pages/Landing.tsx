import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Landing() {
  const { signIn } = useAuthStore();

  return (
    <div className="min-h-screen bg-background text-on-background font-body flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-surface-container-lowest rounded-3xl shadow-sm border border-surface-container-highest overflow-hidden"
      >
        <div className="p-8 text-center bg-surface-container-lowest border-b border-surface-container-highest text-on-surface">
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
            onClick={signIn}
            className="w-full bg-primary-container text-on-primary-container font-headline font-bold py-4 rounded-xl transition-all chunky-shadow active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Google 계정으로 시작하기
          </button>
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

