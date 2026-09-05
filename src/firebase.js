// ==========================================================================
// BingeFlix - Firebase Live Cloud Auth & Firestore Sync Module
// ==========================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

// Secure Firebase Configuration via environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBBUrSt0nBcKcg21sShUWqJ_BPLUNEINh8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "bingeflix-7b30f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bingeflix-7b30f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "bingeflix-7b30f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "839516474748",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:839516474748:web:88639597084274c170e8f9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-GB7KHZPLL8"
};

let app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
let auth = getAuth(app);
let db = getFirestore(app);

export function initFirebase() {
  return { isReady: true, auth, db };
}

export function isFirebaseReady() {
  return !!(auth && db);
}

// Persistent Device ID generator & tracker (Enforces max 4 devices)
export function getDeviceId() {
  let devId = localStorage.getItem('bingeflix_device_id');
  if (!devId) {
    devId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem('bingeflix_device_id', devId);
  }
  return devId;
}

// 2. Create Account with Email & Password
export async function registerWithEmail(email, password, username) {
  if (!isFirebaseReady()) {
    throw new Error('MISSING_FIREBASE_KEY');
  }

  try {
    // Check if username already taken in Firestore 'users' collection
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new Error(`USERNAME_TAKEN`);
    }

    // Create auth user
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    await updateProfile(user, { displayName: username });

    const userData = {
      uid: user.uid,
      email: user.email,
      username: username.toLowerCase(),
      watchlist: [],
      watchHistory: [],
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    };

    // Store in Firestore
    await setDoc(doc(db, 'users', user.uid), userData);

    return { success: true, user: userData, firebaseUser: user };
  } catch (err) {
    console.error('[Firebase Register Error]:', err);
    throw err;
  }
}

// 3. Sign In with Email or Username
export async function loginWithEmailOrUsername(identifier, password) {
  if (!isFirebaseReady()) {
    throw new Error('MISSING_FIREBASE_KEY');
  }

  try {
    let emailToUse = identifier.trim();

    // If identifier is not an email, lookup email by username
    if (!identifier.includes('@')) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', identifier.toLowerCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error('USER_NOT_FOUND');
      }
      emailToUse = snap.docs[0].data().email;
    }

    const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
    const user = cred.user;

    // Fetch user profile from Firestore
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    let userData = snap.exists() ? snap.data() : { uid: user.uid, email: user.email, username: user.displayName || user.email.split('@')[0], watchlist: [], watchHistory: [] };

    await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });

    return { success: true, user: userData, firebaseUser: user };
  } catch (err) {
    console.error('[Firebase Login Error]:', err);
    throw err;
  }
}

// 4. Sign Out
export async function logoutFirebase() {
  if (auth) {
    await signOut(auth);
  }
}

// ==========================================================================
// Firestore Sync Functions (Watchlist & Watch History)
// ==========================================================================

// Fetch full user data from Cloud Firestore (Non-blocking with strict timeout)
export async function fetchUserDataFromCloud(uid) {
  if (!isFirebaseReady() || !uid) return null;
  try {
    const fetchPromise = (async () => {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      return snap.exists() ? snap.data() : null;
    })();

    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 1200));
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    console.warn('[Firestore] Fetch user data notice:', err);
    return null;
  }
}

// Sync Watchlist
export async function syncWatchlistToCloud(uid, watchlist) {
  if (!isFirebaseReady() || !uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { watchlist }, { merge: true });
    console.log('[Firestore] Watchlist synced for', uid);
  } catch (err) {
    console.error('[Firestore] Watchlist sync error:', err);
  }
}

// Record Watch History into Cloud Firestore
export async function recordMovieWatchToCloud(uid, movie) {
  if (!isFirebaseReady() || !uid || !movie) return;
  try {
    const userRef = doc(db, 'users', uid);
    const historyItem = {
      id: movie.id,
      title: movie.title || movie.name,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      vote_average: movie.vote_average,
      watchedAt: new Date().toISOString(),
    };

    // Fetch current user doc to avoid duplicate adjacent history
    const snap = await getDoc(userRef);
    let currentHistory = [];
    if (snap.exists()) {
      currentHistory = snap.data().watchHistory || [];
    }
    // Remove any previous entry of this movie so it moves to top
    currentHistory = currentHistory.filter(item => item.id !== movie.id);
    currentHistory.unshift(historyItem);
    // Keep last 30 movies
    if (currentHistory.length > 30) currentHistory = currentHistory.slice(0, 30);

    await setDoc(userRef, { watchHistory: currentHistory }, { merge: true });
    console.log('[Firestore] Watch History updated in Cloud for user:', uid, movie.title);
  } catch (err) {
    console.error('[Firestore] Watch history error:', err);
  }
}

// Clear Watch History in Cloud
export async function clearWatchHistoryInCloud(uid) {
  if (!isFirebaseReady() || !uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { watchHistory: [] }, { merge: true });
    console.log('[Firestore] Watch History cleared in Cloud for user:', uid);
  } catch (err) {
    console.error('[Firestore] Clear watch history error:', err);
  }
}

// Remove single item from Watch History in Cloud
export async function deleteMovieFromWatchHistoryInCloud(uid, movieId) {
  if (!isFirebaseReady() || !uid || !movieId) return;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const history = (snap.data().watchHistory || []).filter(item => item.id !== movieId);
      await setDoc(userRef, { watchHistory: history }, { merge: true });
    }
  } catch (err) {
    console.warn('[Firestore] Delete single history error:', err);
  }
}

// Update custom username and avatar in Cloud Firestore
export async function updateUserCustomUsernameInCloud(uid, username, avatar = 'goku') {
  if (!isFirebaseReady() || !uid || !username) return;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { 
      username: username.toLowerCase(), 
      hasCustomUsername: true,
      avatar: avatar 
    }, { merge: true });
    console.log('[Firestore] Profile updated in Cloud for user:', uid, username, avatar);
  } catch (err) {
    console.error('[Firestore] Username update error:', err);
  }
}

// Listen to Auth State
export function onAuthStateListener(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

// ==========================================================================
// Admin Panel: Paid Customer & Subscription Management
// ==========================================================================

const LOCAL_SUBSCRIBERS_KEY = 'bingeflix_subscribers';

// Helper: Get local fallback subscribers
export function getLocalSubscribers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SUBSCRIBERS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

// Helper: Save local subscribers
export function saveLocalSubscribers(list) {
  try {
    localStorage.setItem(LOCAL_SUBSCRIBERS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[LocalStorage] Save subscribers error:', e);
  }
}

// 1. Fetch All Paid Subscribers (Firestore with LocalStorage Fallback)
export async function fetchAllSubscribers() {
  let localList = getLocalSubscribers();

  if (!isFirebaseReady()) {
    return localList;
  }

  try {
    const subCol = collection(db, 'subscribers');
    const snap = await Promise.race([
      getDocs(subCol),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
    ]);

    if (snap && !snap.empty) {
      const cloudList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveLocalSubscribers(cloudList);
      return cloudList;
    }
  } catch (err) {
    console.warn('[Firestore] Subscribers fetch fallback to local:', err.message);
  }

  return localList;
}

// 2. Create New Paid Subscriber
export async function createPaidSubscriber(subscriberData) {
  const newId = subscriberData.id || 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date();
  const durationDays = parseInt(subscriberData.durationDays, 10) || 30;
  const expiryDate = subscriberData.plan === 'lifetime' 
    ? new Date(now.getTime() + 100 * 365 * 86400000).toISOString()
    : new Date(now.getTime() + durationDays * 86400000).toISOString();

  const subscriberRecord = {
    id: newId,
    username: subscriberData.username.trim().toLowerCase(),
    email: subscriberData.email ? subscriberData.email.trim().toLowerCase() : `${subscriberData.username.trim().toLowerCase()}@bingeflix.vip`,
    password: subscriberData.password.trim(),
    plan: subscriberData.plan || '1 Month',
    durationDays: durationDays,
    amount: subscriberData.amount || '199',
    paymentMethod: subscriberData.paymentMethod || 'UPI',
    note: subscriberData.note || 'Paid via UPI',
    status: 'active',
    avatar: subscriberData.avatar || 'goku',
    createdAt: now.toISOString(),
    expiresAt: expiryDate,
  };

  // 1. Save locally immediately
  let list = getLocalSubscribers();
  // Remove if exists
  list = list.filter(s => s.id !== newId && s.username !== subscriberRecord.username);
  list.unshift(subscriberRecord);
  saveLocalSubscribers(list);

  // 2. Sync to Firestore (Non-blocking)
  if (isFirebaseReady()) {
    try {
      const subDocRef = doc(db, 'subscribers', newId);
      await setDoc(subDocRef, subscriberRecord, { merge: true });
      console.log('[Firestore] Subscriber created:', newId);
    } catch (err) {
      console.warn('[Firestore] Create subscriber cloud warning:', err.message);
    }
  }

  return subscriberRecord;
}

// 3. Update Existing Subscriber
export async function updatePaidSubscriber(id, updates) {
  let list = getLocalSubscribers();
  const index = list.findIndex(s => s.id === id);
  if (index !== -1) {
    list[index] = { ...list[index], ...updates };
    saveLocalSubscribers(list);
  }

  if (isFirebaseReady()) {
    try {
      const subDocRef = doc(db, 'subscribers', id);
      await setDoc(subDocRef, updates, { merge: true });
    } catch (err) {
      console.warn('[Firestore] Update subscriber cloud warning:', err.message);
    }
  }

  return list[index];
}

// 4. Delete Subscriber
export async function deletePaidSubscriber(id) {
  let list = getLocalSubscribers();
  list = list.filter(s => s.id !== id);
  saveLocalSubscribers(list);

  if (isFirebaseReady()) {
    try {
      const subDocRef = doc(db, 'subscribers', id);
      await deleteDoc(subDocRef);
    } catch (err) {
      console.warn('[Firestore] Delete subscriber cloud warning:', err.message);
    }
  }

  return true;
}

// 5. Verify Subscriber Login (Handles custom subscriber accounts created by admin)
export async function verifySubscriberLogin(identifier, password) {
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  // Check local subscriber records first for instantaneous response
  let list = getLocalSubscribers();
  let found = list.find(s => 
    (s.username.toLowerCase() === cleanId || s.email.toLowerCase() === cleanId) && 
    s.password === cleanPass
  );

  // If not found locally, try fetching latest from Firestore
  if (!found && isFirebaseReady()) {
    try {
      const subs = await fetchAllSubscribers();
      found = subs.find(s => 
        (s.username.toLowerCase() === cleanId || s.email.toLowerCase() === cleanId) && 
        s.password === cleanPass
      );
    } catch (e) {
      console.warn('[Auth] Subscriber cloud check warning:', e);
    }
  }

  if (!found) {
    return { success: false, error: 'INVALID_CREDENTIALS' };
  }

  // Check subscription expiry
  const now = new Date();
  const expiry = new Date(found.expiresAt);
  const isExpired = now > expiry || found.status === 'suspended';
  const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // 4-Device Limit Check & Registration
  const devId = getDeviceId();
  let activeDevices = Array.isArray(found.activeDevices) ? found.activeDevices : [];
  if (!activeDevices.includes(devId)) {
    if (activeDevices.length >= 4) {
      activeDevices.shift(); // Drop oldest device to keep exactly max 4
    }
    activeDevices.push(devId);
    found.activeDevices = activeDevices;
    updatePaidSubscriber(found.id, { activeDevices });
  }

  return {
    success: true,
    isSubscriber: true,
    isExpired: isExpired,
    daysLeft: daysLeft,
    subscriber: found,
    user: {
      uid: found.id,
      username: found.username,
      email: found.email,
      avatar: found.avatar || 'goku',
      isSubscriber: true,
      plan: found.plan,
      expiresAt: found.expiresAt,
      daysLeft: daysLeft,
      status: found.status,
      activeDevices: activeDevices
    }
  };
}

// Update Username function (User can change their username)
export async function updateUserCustomUsername(userId, newUsername) {
  const cleanUsername = (newUsername || '').trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters long (letters, numbers, underscore only)');
  }

  let list = getLocalSubscribers();
  const duplicate = list.find(u => u.username.toLowerCase() === cleanUsername && (u.id !== userId && u.uid !== userId));
  if (duplicate) {
    throw new Error('This username is already taken. Please choose another.');
  }

  const user = list.find(u => u.id === userId || u.uid === userId);
  if (user) {
    user.username = cleanUsername;
    saveLocalSubscribers(list);
  }

  const cur = JSON.parse(localStorage.getItem('bingeflix_user') || 'null');
  if (cur && (cur.id === userId || cur.uid === userId)) {
    cur.username = cleanUsername;
    localStorage.setItem('bingeflix_user', JSON.stringify(cur));
  }

  if (isFirebaseReady()) {
    try {
      const docRef = doc(db, 'subscribers', userId);
      await setDoc(docRef, { username: cleanUsername }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Username update warning:', e.message);
    }
  }

  return cleanUsername;
}

