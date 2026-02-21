// ============================================
// auth.js - FIREBASE AUTH + SIGNUP BONUS
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// ============================================
// FIREBASE CONFIG (YOUR ACTUAL CONFIG)
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyD8XdS12Yxmnt4smaC5B33Zfs_46X4R0NA",
  authDomain: "nmedia-stockfootage.firebaseapp.com",
  projectId: "nmedia-stockfootage",
  storageBucket: "nmedia-stockfootage.firebasestorage.app",
  messagingSenderId: "932305719254",
  appId: "1:932305719254:web:845cc2ac393757fe685e77"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ============================================
// DEVICE FINGERPRINT (Anti-abuse)
// ============================================
function getDeviceFingerprint() {
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
// SIGN IN WITH EMAIL/PASSWORD
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
          signInError.code === 'auth/invalid-credential' ||
          signInError.code === 'auth/wrong-password') {
        
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        isNewUser = true;
        console.log('✅ New account created');
        
        // Send verification email
        await sendEmailVerification(userCredential.user);
        console.log('📧 Verification email sent');
      } else {
        throw signInError;
      }
    }
    
    const user = userCredential.user;
    const deviceId = getDeviceFingerprint();
    
    if (isNewUser) {
      // NEW USER - CREATE IN BACKEND
      const createResult = await createUserInBackend(
        user.email,
        '',
        true, // welcomeBonus (will only give if email verified)
        user.emailVerified,
        deviceId
      );
      
      if (createResult.needsVerification) {
        alert('📧 Verification Email Sent!\n\nPlease check your email inbox (including spam folder) and click the verification link to receive your $5 welcome bonus.');
      } else if (createResult.welcomeBonus) {
        showNotification('🎉 Account created! $5 bonus added!', 'success');
      }
      
    } else {
      // EXISTING USER - JUST LOAD DATA
      await window.loadUserData(user.email);
    }
    
    window.updateWalletDisplay();
    window.closeLoginModal();
    
  } catch (error) {
    console.error('Email auth error:', error);
    
    let errorMessage = 'Sign-in failed';
    if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password too weak (min 6 chars)';
    } else if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email already registered';
    } else {
      errorMessage = 'Sign-in failed: ' + error.message;
    }
    
    showNotification(errorMessage, 'error');
  }
};

// ============================================
// LOGOUT
// ============================================
window.logout = async function() {
  try {
    await signOut(auth);
    
    if (window.currentUser) {
      window.currentUser.email = null;
      window.currentUser.wallet = 0;
      window.currentUser.isLoggedIn = false;
      window.currentUser.purchases = [];
   }
    window.updateWalletDisplay();
    showNotification('Logged out successfully');
     // ⭐ RELOAD PAGE after short delay (so notification shows)
    setTimeout(() => {
      window.location.reload();
    }, 800); // 800ms = 0.8 seconds
    
    
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Logout failed', 'error');
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
        if (window.currentUser) {
          window.currentUser.wallet = 5;
        }
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
// GRANT BONUS AFTER EMAIL VERIFICATION
// ============================================
async function grantWelcomeBonusAfterVerification(email, deviceId) {
  try {
    const url = CONFIG.API_URL + 
      '?action=grantWelcomeBonus' +
      '&email=' + encodeURIComponent(email) +
      '&deviceId=' + encodeURIComponent(deviceId);
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success && window.currentUser) {
      window.currentUser.wallet = result.wallet;
      window.updateWalletDisplay();
    }
    
    return result;
  } catch (error) {
    console.error('Bonus grant error:', error);
  }
}

// ============================================
// AUTH STATE LISTENER
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
    } else if (user.email) {
      // Mark as unverified
      localStorage.setItem('sf_unverified_' + user.email, 'true');
    }
    
    // Load user data
    await window.loadUserData(user.email);
    window.updateWalletDisplay();
    
  } else {
    console.log('🔓 User signed out');
    
    if (window.currentUser) {
      window.currentUser.email = null;
      window.currentUser.wallet = 0;
      window.currentUser.isLoggedIn = false;
    }
    
    window.updateWalletDisplay();
  }
});


// ============================================
// FORGOT PASSWORD
// ============================================

window.handleForgotPassword = async function() {
  const email = document.getElementById('authEmail').value.trim();
  
  if (!email) {
    alert('Please enter your email address first, then click "Forgot Password"');
    return;
  }
  
  // Confirm they want to reset
  const confirmed = confirm(
    `Send password reset email to:\n${email}\n\nClick OK to continue.`
  );
  
  if (!confirmed) return;
  
  try {
    // ⭐ Firebase sends the reset email automatically
    await sendPasswordResetEmail(auth, email);
    
    // Show success message with instructions
    showPasswordResetModal(email);
    
    console.log('✅ Password reset email sent to:', email);
    
  } catch (error) {
    console.error('Password reset error:', error);
    
    let errorMessage = 'Failed to send reset email';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email address';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many attempts. Please wait a few minutes and try again.';
    }
    
    alert('❌ ' + errorMessage);
  }
};

// ============================================
// SHOW PASSWORD RESET CONFIRMATION
// ============================================
function showPasswordResetModal(email) {
  const modalHTML = `
    <div id="passwordResetModal" style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    ">
      <div style="
        background: #1F2933;
        border: 2px solid #F97316;
        border-radius: 16px;
        padding: 40px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      ">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 64px; margin-bottom: 10px;">🔑</div>
          <h2 style="color: #F97316; font-size: 28px; margin: 0 0 10px 0;">Password Reset Email Sent!</h2>
        </div>
        
        <div style="color: #F3F4F6; line-height: 1.6; margin-bottom: 25px;">
          <p style="margin: 0 0 15px 0;">We've sent a password reset link to:</p>
          <p style="
            background: rgba(249,115,22,0.1);
            border: 1px solid #F97316;
            padding: 12px;
            border-radius: 8px;
            font-weight: bold;
            color: #F97316;
            margin: 0 0 15px 0;
          ">${email}</p>
          
          <p style="margin: 0 0 10px 0;"><strong style="color: #F97316;">Next Steps:</strong></p>
          <ol style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Check your email inbox (and spam folder)</li>
            <li style="margin-bottom: 8px;">Click the password reset link</li>
            <li style="margin-bottom: 8px;">Set your new password</li>
            <li style="margin-bottom: 8px;">Return here and sign in with your new password</li>
          </ol>
          
          <p style="margin: 15px 0 0 0; font-size: 13px; color: #9CA3AF;">
            💡 The reset link expires in 1 hour
          </p>
        </div>
        
        <button onclick="document.getElementById('passwordResetModal').remove(); window.closeLoginModal();" style="
          width: 100%;
          background: #F97316;
          color: white;
          border: none;
          padding: 16px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#FB923C'" onmouseout="this.style.background='#F97316'">
          Got It! I'll Check My Email
        </button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ============================================
// NOTIFICATION HELPER
// ============================================
function showNotification(message, type = 'success') {
  if (window.showNotification) {
    window.showNotification(message, type);
  } else {
    console.log('📢', message);
  }
}

console.log('✅ Auth module loaded with signup bonus + anti-abuse');
console.log('   - signInWithEmail:', typeof window.signInWithEmail);
console.log('   - signInWithGoogle:', typeof window.signInWithGoogle);
console.log('   - logout:', typeof window.logout);
