import { create } from 'zustand';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, signInWithRedirect } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            nickname: user.displayName || 'Unkown User',
            createdAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error setting up user profile", error);
        // Do not throw handleFirestoreError here as it might crash the listener, just log
      }
    }
    set({ user, loading: false });
  });

  return {
    user: null,
    loading: true,
    signIn: async () => {
      try {
        const provider = new GoogleAuthProvider();
        // iframe 내부(AI 스튜디오 미리보기 등)에서는 popup, 실제 배포된 Vercel 등에서는 redirect 사용
        const isIframe = window !== window.top;
        
        if (isIframe) {
          await signInWithPopup(auth, provider);
        } else {
          await signInWithRedirect(auth, provider);
        }
      } catch (error: any) {
        console.error('Sign in with popup error, attempting redirect...', error);
        if (error.code === 'auth/popup-blocked' || error.message?.includes('Cross-Origin-Opener-Policy')) {
          try {
            const provider = new GoogleAuthProvider();
            await signInWithRedirect(auth, provider);
          } catch (redirectError) {
             console.error('Sign in with redirect error', redirectError);
          }
        } else {
           // It might be unauthorized domain error or something else.
           // Fallback to redirect just in case
           try {
             const provider = new GoogleAuthProvider();
             await signInWithRedirect(auth, provider);
           } catch (redirectErr) {
             console.error('Sign in error', error);
           }
        }
      }
    },
    signOut: async () => {
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        console.error('Sign out error', error);
      }
    }
  };
});
