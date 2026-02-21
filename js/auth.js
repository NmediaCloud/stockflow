// ============================================
// SIGNUP WITH $5 BONUS + ANTI-ABUSE SYSTEM
// Frontend (auth.js) + Backend (Apps Script)
// ============================================

// ============================================
// PART 1: FRONTEND (auth.js)
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification, // ⭐ For verification
  onAuthStateChanged,
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ... rest of config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ============================================
// DEVICE FINGERPRINT (Anti-abuse)
// ============================================
function getDeviceFingerprint() {
  // Creates unique ID based on browser/device
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('fingerprint', 2, 2);
  
  const fingerprint = {
    canvas: canvas.toDataURL(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    plugins: Array.from(navigator.plugins).map(p => p.name).join(',')
  };
  
  // Create hash from fingerprint
  const fingerprintString = JSON.stringify(fingerprint);
  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

// ============================================
// SIGN IN WITH GOOGLE
// ============================================
window.signInWithGoogle = async function() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    console.log('✅ Google Sign-In:', user.email);
    
    // Google accounts are pre-verified
    const deviceId = getDeviceFingerprint();
    
    // Create user in backend (will check if new)
    const createResult = await createUserInBackend(
      user.email, 
      user.displayName || '', 
      true, // welcomeBonus
      true, // emailVerified (Google = verified)
      deviceId
    );
    
    if (createResult.welcomeBonus) {
      showNotification('🎉 Welcome! $5 bonus added to your wallet!', 'success');
    }
    
    await window.loadUserData(user.email);
    window.updateWalletDisplay();
    window.closeLoginModal();
    
  } catch (error) {
    console.error('Google Sign-In error:', error);
    showNotification('Sign-in failed: ' + error.message, 'error');
  }
};

// ============================================
// SIGN UP WITH EMAIL/PASSWORD
// ============================================
window.signInWithEmail = async function(email, password) {
  if (!email || !password) {
    showNotification('Please enter email and password', 'error');
    return;
  }

  try {
    let userCredential;
    let isNewUser = false;
    
    // Try sign in first
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Existing user signed in');
    } catch (signInError) {
      // Create new account
      if (signInError.code === 'auth/user-not-found' || 
          signInError.code === 'auth/invalid-credential') {
        
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        isNewUser = true;
        console.log('✅ New account created');
        
        // ⭐ SEND VERIFICATION EMAIL
        await sendEmailVerification(userCredential.user);
        console.log('📧 Verification email sent');
      } else {
        throw signInError;
      }
    }
    
    const user = userCredential.user;
    const deviceId = getDeviceFingerprint();
    
    if (isNewUser) {
      // ⭐ NEW USER - CREATE IN BACKEND
      const createResult = await createUserInBackend(
        user.email,
        '',
        true, // welcomeBonus (will only give if email verified)
        user.emailVerified,
        deviceId
      );
      
      if (createResult.needsVerification) {
        showNotification('📧 Please verify your email to receive $5 welcome bonus!', 'info');
      } else if (createResult.welcomeBonus) {
        showNotification('🎉 Account created! $5 bonus added!', 'success');
      }
      
    } else {
      // ⭐ EXISTING USER - JUST LOAD DATA
      await window.loadUserData(user.email);
    }
    
    window.updateWalletDisplay();
    window.closeLoginModal();
    
  } catch (error) {
    console.error('Email auth error:', error);
    
    let errorMessage = 'Sign-in failed';
    if (error.code === 'auth/invalid-email') errorMessage = 'Invalid email';
    else if (error.code === 'auth/weak-password') errorMessage = 'Password too weak (min 6 chars)';
    else if (error.code === 'auth/email-already-in-use') errorMessage = 'Email already registered';
    
    showNotification(errorMessage, 'error');
  }
};

// ============================================
// CREATE USER IN BACKEND
// ============================================
async function createUserInBackend(email, name, giveWelcomeBonus, emailVerified, deviceId) {
  try {
    const url = CONFIG.API_URL + 
      '?action=createUser' +
      '&email=' + encodeURIComponent(email) +
      '&name=' + encodeURIComponent(name) +
      '&welcomeBonus=' + giveWelcomeBonus +
      '&emailVerified=' + emailVerified +
      '&deviceId=' + encodeURIComponent(deviceId);
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success && result.isNewUser) {
      console.log('✅ New user created in backend');
      
      if (result.welcomeBonus) {
        window.currentUser.wallet = 5;
        window.updateWalletDisplay();
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Backend error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// LISTEN FOR EMAIL VERIFICATION
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('🔐 User authenticated:', user.email);
    
    // Check if email just got verified
    if (user.emailVerified) {
      const wasUnverified = localStorage.getItem('sf_unverified_' + user.email);
      
      if (wasUnverified) {
        // Email just verified! Give bonus
        console.log('✅ Email verified! Granting bonus...');
        
        const deviceId = getDeviceFingerprint();
        await grantWelcomeBonusAfterVerification(user.email, deviceId);
        
        localStorage.removeItem('sf_unverified_' + user.email);
        showNotification('🎉 Email verified! $5 added to your wallet!', 'success');
      }
    } else {
      // Mark as unverified
      localStorage.setItem('sf_unverified_' + user.email, 'true');
    }
    
    await window.loadUserData(user.email);
    window.updateWalletDisplay();
  }
});

// ============================================
// GRANT BONUS AFTER VERIFICATION
// ============================================
async function grantWelcomeBonusAfterVerification(email, deviceId) {
  try {
    const url = CONFIG.API_URL + 
      '?action=grantWelcomeBonus' +
      '&email=' + encodeURIComponent(email) +
      '&deviceId=' + encodeURIComponent(deviceId);
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success) {
      window.currentUser.wallet = result.wallet;
      window.updateWalletDisplay();
    }
    
    return result;
  } catch (error) {
    console.error('Bonus grant error:', error);
  }
}

console.log('✅ Auth with anti-abuse + $5 welcome bonus loaded');



// js/auth.js — Firebase Authentication
// Fill in YOUR values from Firebase Console Step 1.1

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup,
         createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
  
  apiKey: "AIzaSyD8XdS12Yxmnt4smaC5B33Zfs_46X4R0NA",
  authDomain: "nmedia-stockfootage.firebaseapp.com",
  projectId: "nmedia-stockfootage",
  storageBucket: "nmedia-stockfootage.firebasestorage.app",
  messagingSenderId: "932305719254",
  appId: "1:932305719254:web:845cc2ac393757fe685e77"

  
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

