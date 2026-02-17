// js/auth.js — Firebase Authentication
// Fill in YOUR values from Firebase Console Step 1.1

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup,
         createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID'
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    await loadUserData(firebaseUser.email);
    updateWalletDisplay();
  } else {
    currentUser = { email: null, wallet: 0, isLoggedIn: false };
    updateWalletDisplay();
  }
});

window.signInWithGoogle = async () => {
  try { await signInWithPopup(auth, provider); closeLoginModal(); }
  catch(e) { showNotification('Sign-in failed', 'error'); }
};

window.signInWithEmail = async (email, password) => {
  try { await signInWithEmailAndPassword(auth, email, password); closeLoginModal(); }
  catch(e) {
    if (e.code === 'auth/user-not-found') {
      await createUserWithEmailAndPassword(auth, email, password);
      closeLoginModal();
    } else { showNotification('Sign-in failed: ' + e.message, 'error'); }
  }
};

window.logout = async () => { await signOut(auth); showNotification('Logged out'); };

