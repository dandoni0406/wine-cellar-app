import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA-plj8VkiSYq2qtsOVWf-MufyTl0cQbPg",
  authDomain: "wine-cellar-app-478ce.firebaseapp.com",
  projectId: "wine-cellar-app-478ce",
  storageBucket: "wine-cellar-app-478ce.firebasestorage.app",
  messagingSenderId: "616445456205",
  appId: "1:616445456205:web:f5f930a5bd6d033a809104",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
