// Firebase კონფიგურაცია
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

// Firebase კონფიგურაცია
const firebaseConfig = {
  apiKey: "AIzaSyD92EjHS_Th7PfKiwZQyRbDDj6PmyLJTY0",
  authDomain: "projec-cca43.firebaseapp.com",
  databaseURL: "https://projec-cca43-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "projec-cca43",
  storageBucket: "projec-cca43.appspot.com",
  messagingSenderId: "198187490796",
  appId: "1:198187490796:web:120d4fa367e26b21a274c9",
  measurementId: "G-JQDC4K9T0K"
};

// Firebase ინიციალიზაცია
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

export { app, auth, db, storage, rtdb }; 