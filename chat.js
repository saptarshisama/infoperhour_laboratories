/**
 * chat.js v2 — Firebase Realtime Chat
 *
 * SETUP (free, 5 min):
 * 1. Go to console.firebase.google.com → Add project → name "world-monitor"
 * 2. Realtime Database → Create database → TEST MODE → Enable
 * 3. Project Settings → Your apps → Web → Register → copy firebaseConfig
 * 4. Paste config below replacing the placeholders
 * 5. Database Rules → Publish this:
 *    { "rules": { "chat": { ".read": true, ".write": true } } }
 */

const CHAT = (() => {

  // ═════════════════════════════════════════════
  // ▼  PASTE YOUR FIREBASE CONFIG HERE  ▼
  // ═════════════════════════════════════════════
  const FIREBASE_CONFIG = {
    apiKey:            'YOUR_API_KEY',
    authDomain:        'YOUR_PROJECT.firebaseapp.com',
    databaseURL:       'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
    projectId:         'YOUR_PROJECT',
    storageBucket:     'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId:             'YOUR_APP_ID',
  };
  // ═════════════════════════════════════════════

  const MAX_MSGS       = 200;
  const TYPING_TTL_MS  = 3000;

  let db           = null;
  let username     = '';
  let userColor    = '';
  let typingTimer  = null;
  let initialized  = false;
  let isFirebase   = false;

  const COLORS = ['#22d3ee','#f59e0b','#a78bfa','#4ade80','#f472b6','#60a5fa','#fb923c','#34d399'];

  // ── DOM helpers ──────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function utcTime(ts) {
    const d = new Date(ts);
    return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
  }
  function scrollBottom() {
    const c = $('chat-msgs');
    if (c) c.scrollTop = c.scrollHeight;
  }

  // ── Render message ───────────────────────────────────────────────────
  function appendMsg(msg, isSelf) {
    const c = $('chat-msgs');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'cmsg';
    el.innerHTML = `
      <div class="cmsg-hdr">
        <div class="cavatar" style="background:${msg.color||'#64748b'}">${esc(msg.username).slice(0,2).toUpperCase()}</div>
        <span class="cuname" style="color:${msg.color||'#e2e8f0'}">${esc(msg.username)}</span>
        <span class="cts">${utcTime(msg.ts)}</span>
      </div>
      <div class="cbody">${esc(msg.text)}</div>`;
    c.appendChild(el);
    // Prune DOM
    const all = c.querySelectorAll('.cmsg');
    if (all.length > 120) all[0].remove();
    scrollBottom();
  }

  function appendSys(text) {
    const c = $('chat-msgs');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'csys';
    el.textContent = `— ${text} —`;
    c.appendChild(el);
    scrollBottom();
  }

  // ── Firebase init ─────────────────────────────────────────────────────
  function tryFirebase() {
    if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      isFirebase = true;
      return true;
    } catch (e) {
      console.warn('[CHAT] Firebase init failed:', e.message);
      return false;
    }
  }

  // ── Local mode (No Firebase) ─────────────────────────────────────────

  function runDemo() {
    const statusEl = $('chat-status');
    if (statusEl) { statusEl.textContent = 'local mode'; }
    appendSys('Firebase not configured. Waiting for cloud setup.');
    appendSys('Add your Firebase credentials in chat.js to enable real-time multiplayer chat across the cloud.');
    appendSys('For now, messages sent here will remain on your machine only.');
  }

  // ── Username modal ────────────────────────────────────────────────────
  function promptUsername() {
    const stored = localStorage.getItem('wm_username');
    if (stored) {
      username  = stored;
      userColor = localStorage.getItem('wm_color') || COLORS[0];
      $('name-modal').style.display = 'none';
      $('user-badge').textContent   = username;
      onReady();
      return;
    }

    $('name-modal').style.display = 'flex';
    const inp = $('name-in');
    const btn = $('name-confirm');

    const confirm = () => {
      const val = inp.value.trim().replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,20);
      if (!val) { inp.style.borderColor = '#ef4444'; return; }
      username  = val;
      userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      localStorage.setItem('wm_username', username);
      localStorage.setItem('wm_color', userColor);
      $('name-modal').style.display = 'none';
      $('user-badge').textContent   = username;
      onReady();
    };
    btn.addEventListener('click', confirm);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
    setTimeout(() => inp.focus(), 100);
  }

  // ── Firebase connect ─────────────────────────────────────────────────
  function connectFirebase() {
    const msgsRef    = db.ref('chat/messages');
    const presenceRef= db.ref(`chat/presence/${username}`);
    const typingRef  = db.ref(`chat/typing/${username}`);

    presenceRef.set({ online: true, ts: Date.now() });
    presenceRef.onDisconnect().remove();
    typingRef.onDisconnect().remove();

    // Online counter
    db.ref('chat/presence').on('value', snap => {
      const el = $('online-num');
      if (el) el.textContent = snap.numChildren();
    });

    // Typing indicators
    db.ref('chat/typing').on('value', snap => {
      const typers = [];
      snap.forEach(c => { if (c.key !== username) typers.push(c.key); });
      const row = $('typing-row');
      const txt = $('typing-txt');
      if (typers.length) {
        if (txt) txt.textContent = `${typers.slice(0,2).join(', ')} ${typers.length===1?'is':'are'} typing…`;
        if (row) row.style.display = '';
      } else {
        if (row) row.style.display = 'none';
      }
    });

    // Messages
    msgsRef.limitToLast(80).on('child_added', snap => {
      const m = snap.val();
      if (m) appendMsg(m, m.username === username);
    });

    // Connection status
    db.ref('.info/connected').on('value', snap => {
      const el = $('chat-status');
      if (!el) return;
      if (snap.val()) { el.textContent = 'connected'; el.classList.add('connected'); }
      else { el.textContent = 'reconnecting…'; el.classList.remove('connected'); }
    });

    initialized = true;
    appendSys(`Joined as ${username}`);
  }

  // ── Send message ─────────────────────────────────────────────────────
  function sendMsg() {
    const inp  = $('chat-in');
    const text = inp.value.trim();
    if (!text || !username) return;
    inp.value = '';

    if (isFirebase && db) {
      db.ref('chat/typing/' + username).remove();
      db.ref('chat/messages').push({ username, text, color: userColor, ts: Date.now() });
    } else {
      appendMsg({ username, text, color: userColor, ts: Date.now() }, true);
    }
  }

  // ── Input wiring ──────────────────────────────────────────────────────
  function wireInput() {
    const inp = $('chat-in');
    const btn = $('send-btn');
    btn?.addEventListener('click', sendMsg);
    inp?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
    inp?.addEventListener('input', () => {
      if (!isFirebase || !db) return;
      db.ref('chat/typing/' + username).set(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => db.ref('chat/typing/' + username).remove(), TYPING_TTL_MS);
    });
  }

  // ── On username ready ─────────────────────────────────────────────────
  function onReady() {
    wireInput();
    initialized = true;
    if (isFirebase) connectFirebase();
    else runDemo();
  }

  // ── Public init ───────────────────────────────────────────────────────
  function init() {
    tryFirebase();
    promptUsername();
  }

  return { init };
})();
