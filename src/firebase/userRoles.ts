import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './config';

// მომხმარებლის როლების ტიპი
export type UserRole = 'user' | 'admin';

// მომხმარებლის დოკუმენტის ტიპი Firestore-ში
export interface UserDocument {
  email: string;
  name: string;
  photoURL?: string;
  admin?: boolean; // პირდაპირ დოკუმენტში
  roles?: {
    admin?: boolean;
  };
  createdAt: any; // Firestore Timestamp
  lastLogin: any; // Firestore Timestamp
}

// შექმნის ან განაახლებს მომხმარებლის დოკუმენტს Firestore-ში
export const createOrUpdateUser = async (
  userId: string, 
  userData: Partial<UserDocument>
) => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    // თუ მომხმარებელი არ არსებობს, შევქმნათ
    return setDoc(userRef, userData);
  } else {
    // თუ მომხმარებელი არსებობს, განვაახლოთ
    return updateDoc(userRef, userData);
  }
};

// შეამოწმებს მომხმარებელს არის თუ არა ადმინისტრატორი
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserDocument;
      // შევამოწმოთ როგორც პირდაპირ დოკუმენტის დონეზე, ასევე roles ობიექტის შიგნით
      return userData.admin === true || userData.roles?.admin === true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// მიანიჭებს ადმინისტრატორის როლს მომხმარებელს
export const assignAdminRole = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    // ორივე ადმინ ველი ვანახლოთ, რომ თავსებადი იყოს ორივე მიდგომასთან
    await updateDoc(userRef, {
      'admin': true,
      'roles': { admin: true }
    });
    return true;
  } catch (error) {
    console.error('Error assigning admin role:', error);
    return false;
  }
};

// მოხსნის ადმინისტრატორის როლს მომხმარებლისგან
export const removeAdminRole = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    // ორივე ადმინ ველი ვანახლოთ, რომ თავსებადი იყოს ორივე მიდგომასთან
    await updateDoc(userRef, {
      'admin': false,
      'roles': { admin: false }
    });
    return true;
  } catch (error) {
    console.error('Error removing admin role:', error);
    return false;
  }
}; 