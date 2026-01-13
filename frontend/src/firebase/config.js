import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from "firebase/analytics";

// Firebase yapılandırma
// Bu değerler .env dosyasından okunur
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDFfT47L8vSRgc2GieoDGAUY1V025N5YVs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "semadb-e2a17.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "semadb-e2a17",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "semadb-e2a17.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "24360079468",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:24360079468:web:844257b654ca15e9b54849",
  measurementId: "G-4JF1WXYEYS"
}

// Firebase'i başlat
const app = initializeApp(firebaseConfig)

// Firebase servislerini export et
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app