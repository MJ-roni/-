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
  // Edge나 AdGuard 등에서 IndexedDB 접근이 안되어 Firebase 초기화가 무한 대기하는 경우를 대비한 타임아웃
  setTimeout(() => {
    set((state) => {
      if (state.loading) {
        console.warn('Auth initialization timeout - forcing load state to false to prevent infinite loop.');
        return { loading: false };
      }
      return state;
    });
  }, 3000);

  // Check redirect result to catch any silent redirect errors
  import('firebase/auth').then(({ getRedirectResult }) => {
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect login error:", error);
    });
  });

  onAuthStateChanged(auth, async (user) => {
    // 렌더링 블로킹 방지를 위해 먼저 user 상태와 로딩 상태 업데이트
    set({ user, loading: false });
    
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
      }
    }
  });

  return {
    user: null,
    loading: true,
    signIn: async () => {
      try {
        const provider = new GoogleAuthProvider();
        
        // Always try popup first, as it avoids Safari ITP (Intelligent Tracking Prevention) issues 
        // which cause the "infinite redirect loop" bug.
        await signInWithPopup(auth, provider);
        
      } catch (error: any) {
        console.error('Sign in with popup error...', error);
        
        if (error?.message?.includes('disallowed_useragent') || error?.code === 'auth/disallowed-useragent') {
          throw error;
        }
        
        // Only fallback to redirect if it explicitly fails due to COOP.
        // If it's a popup blocker (like AdGuard), redirect will ALSO fail due to strict tracking prevention!
        // So we inform the user to disable AdGuard.
        if (error.code === 'auth/popup-blocked') {
          throw new Error('popup-blocked');
        } else if (error.message?.includes('Cross-Origin-Opener-Policy')) {
          try {
            console.log('Falling back to redirect...');
            const provider = new GoogleAuthProvider();
            await signInWithRedirect(auth, provider);
          } catch (redirectError) {
             console.error('Sign in with redirect error', redirectError);
             throw redirectError;
          }
        } else {
           throw error;
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
