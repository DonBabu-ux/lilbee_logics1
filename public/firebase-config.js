import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAkMFYizmJ4dd8G8oJ9uw1JdgzwhtmsENU",
    authDomain: "lilbee-logics.firebaseapp.com",
    projectId: "lilbee-logics",
    storageBucket: "lilbee-logics.appspot.com",
    messagingSenderId: "1012945029777",
    appId: "1:1012945029777:web:2f0e0f0e0f0e0f0e",
    databaseURL: "https://lilbee-logics-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export { auth, db, rtdb };
