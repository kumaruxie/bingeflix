// ==========================================================================
// AXON OTT / BingeFlix - Supabase Cloud Auth & Cross-Device Sync Module
// High-performance Postgres-backed Auth, Watchlist & Continue-Watching Sync.
// Resilient local-first fallback if Supabase credentials are not yet entered.
// ==========================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_ANON_KEY.includes('your_supabase_anon_key')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

// ==========================================================================
// Local Storage Fallback Helpers
// ==========================================================================
function getLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem('bingeflix_users_db') || '[]');
  } catch {
    return [];
  }
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem('bingeflix_users_db', JSON.stringify(users));
  } catch {}
}

// ==========================================================================
// Authentication Engine
// ==========================================================================

/**
 * Sign up a new user with Email, Password, Display Name and Avatar
 */
export async function signUpWithEmail(email, password, name, avatar = 'goku') {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim() || cleanEmail.split('@')[0];

  if (!isSupabaseConfigured) {
    // Local-First Fallback Mode
    const users = getLocalUsers();
    if (users.some(u => u.email && u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists.');
    }
    const newUser = {
      id: 'local_usr_' + Date.now(),
      email: cleanEmail,
      name: cleanName,
      username: cleanName,
      password,
      avatar,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    saveLocalUsers(users);
    localStorage.setItem('bingeflix_current_user', JSON.stringify(newUser));
    return { user: newUser, session: null };
  }

  // Cloud Supabase Auth: Check if email is already registered (1 account per Gmail/email)
  try {
    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingEmail) {
      throw new Error(`An account with the email "${cleanEmail}" already exists. Please sign in instead.`);
    }
  } catch (err) {
    if (err.message && err.message.includes('already exists')) throw err;
  }

  // Cloud Supabase Auth: Check if username is already taken
  try {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', cleanName)
      .maybeSingle();

    if (existingUser) {
      throw new Error(`The username "${cleanName}" is already taken. Please choose another username.`);
    }
  } catch (err) {
    if (err.message && err.message.includes('already taken')) throw err;
  }

  let authRes;
  try {
    authRes = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName,
          username: cleanName,
          avatar
        }
      }
    });
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('rate limit')) {
      throw new Error('Supabase Email Rate Limit reached! Please turn OFF "Confirm email" in Supabase Dashboard (Auth > Providers > Email) for instant registration.');
    }
    throw err;
  }

  const { data, error } = authRes;
  if (error) {
    if (error.message && error.message.toLowerCase().includes('rate limit')) {
      throw new Error('Supabase Email Rate Limit reached! Please turn OFF "Confirm email" in Supabase Dashboard (Auth > Providers > Email) for instant registration.');
    }
    throw error;
  }

  const authUser = data.user;
  if (!authUser) {
    throw new Error('Registration failed. Please check your details.');
  }

  // Supabase returns empty identities array if user with this email already exists
  if (Array.isArray(authUser.identities) && authUser.identities.length === 0) {
    throw new Error(`An account with the email "${cleanEmail}" already exists. Please sign in instead.`);
  }

  const userProfile = {
    id: authUser.id,
    email: cleanEmail,
    name: cleanName,
    username: cleanName,
    avatar,
    createdAt: authUser.created_at
  };

  // Upsert profile in public.profiles table if session is active
  if (data.session) {
    try {
      await supabase.from('profiles').upsert({
        id: authUser.id,
        email: cleanEmail,
        username: cleanName,
        avatar_url: avatar,
        updated_at: new Date().toISOString()
      });
    } catch (profileErr) {
      console.warn('[Supabase] Profile creation warning:', profileErr.message);
    }
  }

  localStorage.setItem('bingeflix_current_user', JSON.stringify(userProfile));
  return { 
    user: userProfile, 
    session: data.session,
    needsEmailConfirmation: !data.session 
  };
}

/**
 * Sign in with Email or Username and Password
 */
export async function signInWithEmail(identifier, password) {
  const cleanId = (identifier || '').trim();

  if (!isSupabaseConfigured) {
    // Local-First Fallback Mode
    const users = getLocalUsers();
    const found = users.find(u => 
      (u.email && u.email.toLowerCase() === cleanId.toLowerCase() || (u.username && u.username.toLowerCase() === cleanId.toLowerCase())) && 
      u.password === password
    );
    if (!found) {
      throw new Error('Invalid email/username or password. Please check your credentials.');
    }
    localStorage.setItem('bingeflix_current_user', JSON.stringify(found));
    return { user: found, session: null };
  }

  // Cloud Supabase Auth: Resolve username to email if needed
  let loginEmail = cleanId.toLowerCase();
  if (!cleanId.includes('@')) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .ilike('username', cleanId)
        .maybeSingle();

      if (profile && profile.email) {
        loginEmail = profile.email;
      } else {
        throw new Error(`No account found with username "${cleanId}".`);
      }
    } catch (err) {
      if (err.message && err.message.includes('No account found')) throw err;
    }
  }

  let signInRes;
  try {
    signInRes = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password
    });
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('email not confirmed')) {
      throw new Error('Email not confirmed! Please check your Gmail/Email to confirm your account, or turn OFF "Confirm email" in Supabase Dashboard (Auth > Providers > Email) for instant password login.');
    }
    throw err;
  }

  const { data, error } = signInRes;
  if (error) {
    if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
      throw new Error('Email not confirmed! Please check your Gmail/Email to confirm your account, or turn OFF "Confirm email" in Supabase Dashboard (Auth > Providers > Email) for instant password login.');
    }
    throw error;
  }

  const authUser = data.user;
  let userProfile = {
    id: authUser.id,
    email: authUser.email,
    name: (authUser.user_metadata && (authUser.user_metadata.name || authUser.user_metadata.username)) || authUser.email.split('@')[0],
    username: (authUser.user_metadata && (authUser.user_metadata.username || authUser.user_metadata.name)) || authUser.email.split('@')[0],
    avatar: (authUser.user_metadata && authUser.user_metadata.avatar) || 'goku'
  };

  // Fetch updated profile from public.profiles
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profile) {
      userProfile = {
        ...userProfile,
        name: profile.username || userProfile.name,
        username: profile.username || userProfile.username,
        avatar: profile.avatar_url || userProfile.avatar
      };
    }
  } catch (err) {
    console.warn('[Supabase] Profile fetch notice:', err);
  }

  localStorage.setItem('bingeflix_current_user', JSON.stringify(userProfile));
  return { user: userProfile, session: data.session };
}

/**
 * Check if a username is available in Supabase
 * @param {string} username 
 * @returns {Promise<{ available: boolean, state: string, message: string }>}
 */
export async function checkUsernameAvailability(username) {
  const clean = (username || '').trim();
  if (!clean || clean.length < 3) {
    return { available: false, state: 'short', message: 'Min 3 characters' };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
    return { available: false, state: 'invalid', message: 'Letters, numbers, _ only' };
  }

  if (!isSupabaseConfigured) {
    const users = getLocalUsers();
    const taken = users.some(u => (u.username && u.username.toLowerCase() === clean.toLowerCase()) || (u.name && u.name.toLowerCase() === clean.toLowerCase()));
    return { available: !taken, state: taken ? 'taken' : 'available', message: taken ? 'Username taken' : 'Username available' };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', clean)
      .maybeSingle();

    if (error) {
      return { available: true, state: 'available', message: 'Username available' };
    }

    if (data) {
      return { available: false, state: 'taken', message: 'Username taken' };
    }
    return { available: true, state: 'available', message: 'Username available' };
  } catch {
    return { available: true, state: 'available', message: 'Username available' };
  }
}

/**
 * Check if an email is already registered in Supabase
 * @param {string} email
 * @returns {Promise<{ available: boolean, state: string, message: string }>}
 */
export async function checkEmailAvailability(email) {
  const clean = (email || '').trim().toLowerCase();
  if (!clean || !clean.includes('@') || !clean.includes('.')) {
    return { available: false, state: 'invalid', message: 'Enter valid email' };
  }

  if (!isSupabaseConfigured) {
    const users = getLocalUsers();
    const taken = users.some(u => u.email && u.email.toLowerCase() === clean);
    return { available: !taken, state: taken ? 'taken' : 'available', message: taken ? 'Email already in use' : 'Email available' };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', clean)
      .maybeSingle();

    if (error) {
      return { available: true, state: 'available', message: 'Email available' };
    }

    if (data) {
      return { available: false, state: 'taken', message: 'Email already registered' };
    }
    return { available: true, state: 'available', message: 'Email available' };
  } catch {
    return { available: true, state: 'available', message: 'Email available' };
  }
}

/**
 * Send Password Reset Email (Supabase Recovery)
 */
export async function sendPasswordResetEmail(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Please enter your registered email address.');

  if (!isSupabaseConfigured) {
    const users = getLocalUsers();
    const found = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (!found) throw new Error('No registered account found with this email.');
    return { success: true, message: 'Password reset link simulated.' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${window.location.origin}/#recovery`
  });

  if (error) throw error;
  return { success: true, message: 'Password recovery email sent! Check your inbox for the reset link.' };
}

/**
 * Update User Password (used after recovery link)
 */
export async function updateUserPassword(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  if (!isSupabaseConfigured) {
    return { success: true };
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
  return { success: true, user: data.user };
}

/**
 * Sign Out
 */
export async function signOutSupabase() {
  localStorage.removeItem('bingeflix_current_user');
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Supabase] Signout notice:', e);
    }
  }
}

/**
 * Get currently authenticated user
 */
export async function getActiveUser() {
  // Check local cache for instant UI rendering (0ms)
  let cachedUser = null;
  try {
    const raw = localStorage.getItem('bingeflix_current_user');
    if (raw) cachedUser = JSON.parse(raw);
  } catch {}

  if (!isSupabaseConfigured) {
    return cachedUser;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return null;
    }

    const authUser = session.user;
    let user = {
      id: authUser.id,
      email: authUser.email,
      name: (authUser.user_metadata && authUser.user_metadata.name) || authUser.email.split('@')[0],
      username: (authUser.user_metadata && authUser.user_metadata.name) || authUser.email.split('@')[0],
      avatar: (authUser.user_metadata && authUser.user_metadata.avatar) || 'goku'
    };

    // Refresh profile in background
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        user.name = profile.name || user.name;
        user.username = profile.name || user.username;
        user.avatar = profile.avatar || user.avatar;
      }
    } catch {}

    localStorage.setItem('bingeflix_current_user', JSON.stringify(user));
    return user;
  } catch (err) {
    return cachedUser;
  }
}

/**
 * Listen for auth state transitions
 */
export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      const user = await getActiveUser();
      callback(user, event);
    } else {
      callback(null, event);
    }
  });
  return () => subscription.unsubscribe();
}

/**
 * Update user's username and anime avatar in Supabase and local cache
 * @param {string} userId 
 * @param {{ username?: string, name?: string, avatar?: string }} updates 
 * @returns {Promise<any>}
 */
export async function updateUserProfile(userId, { username, name, avatar }) {
  const cleanUsername = (username || name || '').trim();

  // Local fallback mode
  if (!isSupabaseConfigured) {
    const users = getLocalUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx >= 0) {
      if (cleanUsername) {
        const taken = users.some((u, i) => i !== idx && u.username && u.username.toLowerCase() === cleanUsername.toLowerCase());
        if (taken) throw new Error(`The username "${cleanUsername}" is already taken.`);
        users[idx].username = cleanUsername;
        users[idx].name = cleanUsername;
      }
      if (avatar) users[idx].avatar = avatar;
      saveLocalUsers(users);
      localStorage.setItem('bingeflix_current_user', JSON.stringify(users[idx]));
      return users[idx];
    }
    const current = JSON.parse(localStorage.getItem('bingeflix_current_user') || '{}');
    if (cleanUsername) current.username = cleanUsername, current.name = cleanUsername;
    if (avatar) current.avatar = avatar;
    localStorage.setItem('bingeflix_current_user', JSON.stringify(current));
    return current;
  }

  // Cloud Supabase: check if new username is already taken by someone else
  if (cleanUsername) {
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .neq('id', userId)
        .maybeSingle();

      if (existing) {
        throw new Error(`The username "${cleanUsername}" is already taken. Please choose another.`);
      }
    } catch (err) {
      if (err.message && err.message.includes('already taken')) throw err;
    }
  }

  const profileUpdates = { updated_at: new Date().toISOString() };
  if (cleanUsername) {
    profileUpdates.username = cleanUsername;
  }
  if (avatar) {
    profileUpdates.avatar_url = avatar;
  }

  try {
    await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId);
  } catch (err) {
    console.warn('[Supabase] Profile table update warning:', err);
  }

  // Update Supabase Auth user metadata
  const metaUpdates = {};
  if (cleanUsername) {
    metaUpdates.name = cleanUsername;
    metaUpdates.username = cleanUsername;
  }
  if (avatar) {
    metaUpdates.avatar = avatar;
  }

  try {
    await supabase.auth.updateUser({
      data: metaUpdates
    });
  } catch (err) {
    console.warn('[Supabase] Auth metadata update warning:', err);
  }

  // Update local storage
  const current = JSON.parse(localStorage.getItem('bingeflix_current_user') || '{}');
  const updatedUser = {
    ...current,
    name: cleanUsername || current.name,
    username: cleanUsername || current.username,
    avatar: avatar || current.avatar
  };
  localStorage.setItem('bingeflix_current_user', JSON.stringify(updatedUser));
  return updatedUser;
}

// ==========================================================================
// Watchlist Cloud Synchronization
// ==========================================================================

export async function syncWatchlistToCloud(userId, watchlist) {
  if (!Array.isArray(watchlist)) return;
  localStorage.setItem('bingeflix_watchlist', JSON.stringify(watchlist));

  if (!isSupabaseConfigured || !userId) return;

  try {
    for (const movie of watchlist) {
      if (!movie || !movie.id) continue;
      await supabase.from('user_watchlist').upsert({
        user_id: userId,
        media_id: String(movie.id),
        title: movie.title || movie.name || 'Untitled',
        poster_path: movie.poster_path || '',
        media_type: movie.media_type || (movie.isTv ? 'tv' : 'movie'),
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id,media_id' });
    }
  } catch (e) {
    console.warn('[Supabase] Watchlist sync notice:', e.message);
  }
}

export async function fetchWatchlistFromCloud(userId) {
  let localList = [];
  try {
    localList = JSON.parse(localStorage.getItem('bingeflix_watchlist') || '[]');
  } catch {}

  if (!isSupabaseConfigured || !userId) return localList;

  try {
    const { data, error } = await supabase
      .from('user_watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const cloudList = data.map(d => ({
        id: isNaN(d.media_id) ? d.media_id : Number(d.media_id),
        title: d.title,
        name: d.title,
        poster_path: d.poster_path,
        media_type: d.media_type,
        isTv: d.media_type === 'tv'
      }));
      localStorage.setItem('bingeflix_watchlist', JSON.stringify(cloudList));
      return cloudList;
    }
  } catch (e) {
    console.warn('[Supabase] Fetch watchlist notice:', e.message);
  }

  return localList;
}

// ==========================================================================
// Continue Watching Cloud Synchronization
// ==========================================================================

export async function recordContinueWatchingToCloud(userId, item) {
  if (!item || !item.id) return;

  // 1. Immediate local persistence
  let localList = [];
  try {
    localList = JSON.parse(localStorage.getItem('bingeflix_continue_watching') || '[]');
  } catch {}

  const entry = {
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    isTv: Boolean(item.isTv),
    season: item.season || 1,
    episode: item.episode || 1,
    progress: item.progress || 0,
    currentTime: item.currentTime || item.progressSeconds || 0,
    duration: item.duration || item.durationSeconds || 0,
    progressSeconds: item.progressSeconds || item.currentTime || 0,
    durationSeconds: item.durationSeconds || item.duration || 0,
    updatedAt: Date.now()
  };

  localList = localList.filter(e => e.id !== entry.id);
  localList.unshift(entry);
  if (localList.length > 20) localList = localList.slice(0, 20);
  localStorage.setItem('bingeflix_continue_watching', JSON.stringify(localList));

  // 2. Background Cloud Sync
  if (!isSupabaseConfigured || !userId) return;

  try {
    await supabase.from('user_continue_watching').upsert({
      user_id: userId,
      media_id: String(entry.id),
      title: entry.title || 'Untitled',
      poster_path: entry.poster_path || '',
      backdrop_path: entry.backdrop_path || '',
      media_type: entry.isTv ? 'tv' : 'movie',
      season: Number(entry.season || 1),
      episode: Number(entry.episode || 1),
      progress: Math.round(Number(entry.progress || 0)),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,media_id' });
  } catch (err) {
    console.warn('[Supabase] Continue watching sync notice:', err.message);
  }
}

export async function fetchContinueWatchingFromCloud(userId) {
  let localList = [];
  try {
    localList = JSON.parse(localStorage.getItem('bingeflix_continue_watching') || '[]');
  } catch {}

  if (!isSupabaseConfigured || !userId) return localList;

  try {
    const { data, error } = await supabase
      .from('user_continue_watching')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const cloudList = data.map(d => ({
        id: isNaN(d.media_id) ? d.media_id : Number(d.media_id),
        title: d.title,
        name: d.title,
        poster_path: d.poster_path,
        backdrop_path: d.backdrop_path,
        isTv: d.media_type === 'tv',
        media_type: d.media_type,
        season: d.season || 1,
        episode: d.episode || 1,
        progress: d.progress || 0,
        updatedAt: new Date(d.updated_at).getTime()
      }));
      localStorage.setItem('bingeflix_continue_watching', JSON.stringify(cloudList));
      return cloudList;
    }
  } catch (err) {
    console.warn('[Supabase] Fetch continue watching notice:', err.message);
  }

  return localList;
}

export async function clearContinueWatchingInCloud(userId) {
  localStorage.removeItem('bingeflix_continue_watching');
  if (!isSupabaseConfigured || !userId) return;
  try {
    await supabase.from('user_continue_watching').delete().eq('user_id', userId);
  } catch (err) {
    console.warn('[Supabase] Clear continue watching error:', err.message);
  }
}



/**
 * Clear local session data for completely clean fresh testing
 */
export function clearAllAuthSessions() {
  localStorage.removeItem('bingeflix_current_user');
  localStorage.removeItem('bingeflix_users_db');
  localStorage.removeItem('bingeflix_watchlist');
  localStorage.removeItem('bingeflix_continue_watching');
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      localStorage.removeItem(key);
    }
  }
}
