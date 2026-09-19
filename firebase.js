// firebase.js — database connection. Nothing else lives here.
// Every other module imports { db } from this file.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDoVAWH_X3en2YRrzJyziQ1GJmTKnsT5mo",
  authDomain: "redlinestudio-d23eb.firebaseapp.com",
  projectId: "redlinestudio-d23eb",
  storageBucket: "redlinestudio-d23eb.firebasestorage.app",
  messagingSenderId: "607461283587",
  appId: "1:607461283587:web:8cb21bca8872f1e59b3b36"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
