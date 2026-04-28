import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBqhyw46AEbGknzCtGIrrW74GphP8BIOTY",
  authDomain: "ana-app-d162f.firebaseapp.com",
  projectId: "ana-app-d162f",
  storageBucket: "ana-app-d162f.firebasestorage.app",
  messagingSenderId: "542296853595",
  appId: "1:542296853595:web:c2698471c73cb9c141c37e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Cloud Firestore y exportarlo para el AppContext
export const db = getFirestore(app);