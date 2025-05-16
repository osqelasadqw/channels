"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { 
  User as FirebaseUser, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "@/firebase/config";
import { User } from "@/types/user";
import { isUserAdmin, createOrUpdateUser } from "@/firebase/userRoles";
import { serverTimestamp } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          // Firestore-ში შევამოწმებთ არის თუ არა მომხმარებელი ადმინისტრატორი
          const isAdmin = await isUserAdmin(firebaseUser.uid);
          
          // განვაახლოთ მომხმარებლის დოკუმენტი Firestore-ში - მხოლოდ lastLogin განახლდება
          await createOrUpdateUser(firebaseUser.uid, {
            lastLogin: serverTimestamp(),
          });
          
          // დავაყენოთ მომხმარებლის ობიექტი
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || undefined,
            isAdmin
          });
        } catch (error) {
          console.error("Error checking admin status:", error);
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || undefined,
            isAdmin: false
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // პირველი რეგისტრაციის დროს შევქმნათ მომხმარებლის დოკუმენტი
      if (result.user) {
        await createOrUpdateUser(result.user.uid, {
          email: result.user.email || "",
          name: result.user.displayName || "",
          photoURL: result.user.photoURL || undefined,
          admin: false,
          roles: { admin: false },
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
      }
    } catch (err) {
      setError("Failed to sign in with Google");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await firebaseSignOut(auth);
    } catch (err) {
      setError("Failed to sign out");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}; 