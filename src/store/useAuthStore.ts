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
        
        // Only fallback to redirect if popup is blocked or explicitly fails due to COOP.
        // Ignore if user just closed the popup manually.
        if (error.code === 'auth/popup-blocked' || error.message?.includes('Cross-Origin-Opener-Policy')) {
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
