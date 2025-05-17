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
  isAdmin?: boolean; // ალტერნატიული ველი admin-ისთვის
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
  console.log(`Attempting to create/update user document for: ${userId}`, userData);
  
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    // თუ მომხმარებელი არ არსებობს, შევქმნათ
    console.log(`Creating new user document for: ${userId}`);
    try {
      await setDoc(userRef, userData);
      console.log(`Successfully created user document for: ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error creating user document for: ${userId}`, error);
      throw error;
    }
  } else {
    // თუ მომხმარებელი არსებობს, განვაახლოთ
    console.log(`Updating existing user document for: ${userId}`);
    try {
      await updateDoc(userRef, userData);
      console.log(`Successfully updated user document for: ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error updating user document for: ${userId}`, error);
      throw error;
    }
  }
};

// შეამოწმებს მომხმარებელს არის თუ არა ადმინისტრატორი
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  try {
    console.log(`Checking admin status for user: ${userId}`);
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserDocument;
      // შევამოწმოთ როგორც პირდაპირ დოკუმენტის დონეზე, ასევე roles ობიექტის შიგნით
      const isAdmin = userData.admin === true || userData.isAdmin === true || userData.roles?.admin === true;
      console.log(`Admin status for user ${userId}: ${isAdmin}`);
      return isAdmin;
    }
    
    console.log(`User ${userId} not found, admin status: false`);
    return false;
  } catch (error) {
    console.error(`Error checking admin status for user: ${userId}`, error);
    return false;
  }
};

// მიანიჭებს ადმინისტრატორის როლს მომხმარებელს
export const assignAdminRole = async (userId: string): Promise<boolean> => {
  try {
    console.log(`Assigning admin role to user: ${userId}`);
    const userRef = doc(db, 'users', userId);
    // ორივე ადმინ ველი ვანახლოთ, რომ თავსებადი იყოს ორივე მიდგომასთან
    await updateDoc(userRef, {
      'admin': true,
      'isAdmin': true,
      'roles': { admin: true }
    });
    console.log(`Successfully assigned admin role to user: ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error assigning admin role to user: ${userId}`, error);
    return false;
  }
};

// მოხსნის ადმინისტრატორის როლს მომხმარებლისგან
export const removeAdminRole = async (userId: string): Promise<boolean> => {
  try {
    console.log(`Removing admin role from user: ${userId}`);
    const userRef = doc(db, 'users', userId);
    // ორივე ადმინ ველი ვანახლოთ, რომ თავსებადი იყოს ორივე მიდგომასთან
    await updateDoc(userRef, {
      'admin': false,
      'isAdmin': false,
      'roles': { admin: false }
    });
    console.log(`Successfully removed admin role from user: ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error removing admin role from user: ${userId}`, error);
    return false;
  }
}; 