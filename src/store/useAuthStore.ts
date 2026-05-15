import { create } from 'zustand';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
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
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error('Sign in error', error);
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
