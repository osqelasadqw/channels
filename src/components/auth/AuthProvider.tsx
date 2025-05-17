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
import { serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

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
          console.log("Firebase user authenticated:", firebaseUser);
          
          // ვამოწმებთ არსებობს თუ არა მომხმარებელი Firestore-ში
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            console.log("User does not exist in Firestore, creating a new document");
            
            // შევქმნათ ახალი დოკუმენტი ყველა საჭირო მონაცემით
            await setDoc(userRef, {
              email: firebaseUser.email || "",
              name: firebaseUser.displayName || "",
              photoURL: firebaseUser.photoURL || null,
              admin: false,
              isAdmin: false,
              roles: { admin: false },
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
            });
            
            console.log("New user document created successfully");
          } else {
            console.log("User exists in Firestore, updating lastLogin");
            
            // განვაახლოთ ბოლო შესვლის დრო და სხვა ცარიელი ველები
            await createOrUpdateUser(firebaseUser.uid, {
              lastLogin: serverTimestamp(),
              // თუ ეს ველები არ არსებობს, დავამატოთ
              ...(!userDoc.data()?.email ? { email: firebaseUser.email || "" } : {}),
              ...(!userDoc.data()?.name ? { name: firebaseUser.displayName || "" } : {}),
              ...(!userDoc.data()?.photoURL ? { photoURL: firebaseUser.photoURL || undefined } : {}),
              ...(!userDoc.data()?.roles ? { roles: { admin: false } } : {})
            });
          }
          
          // Firestore-ში შევამოწმებთ არის თუ არა მომხმარებელი ადმინისტრატორი
          const isAdmin = await isUserAdmin(firebaseUser.uid);
          console.log("User admin status:", isAdmin);
          
          // დავაყენოთ მომხმარებლის ობიექტი
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || undefined,
            isAdmin
          });
        } catch (error) {
          console.error("Error in auth state change handler:", error);
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