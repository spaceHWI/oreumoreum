// 멀티플레이 (#7): 서버 주소(balance.js NET.server 또는 주소창 ?server=…)가 있을 때만 켜짐. 없으면 아무것도 바꾸지 않음
// - 로그인: 구글 ID 토큰 → 서버 세션 토큰. 손님은 지금처럼 이 기기에만 저장
// - 계정 저장: 이 기기에는 '<키>.acct' 로 사본을 두고, 바뀌면 모아서 서버에 PUT /save. 서버가 귤·장비를 확인해 바로잡은 값을 돌려줌
// - 방: WebSocket 로비. net.js 가 쓰던 room 캐퍼빌리티와 같은 모양(onPeers·presence)으로 바꿔 끼움
// - 쓰레기: 더미 남은 수는 방이 주인. trash 저장소의 takeOne·putBack·seen 을 방으로 이어 줌
import { NET } from './balance.js';
import { HEAP_SIG } from './trash.js';

const BASE = __DEV__ ? 'oreumoreum.dev' : 'oreumoreum.v1';
const SK = BASE + '.sess';
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } } };

// 서버 주소: ?server=주소 (탭 세션 동안 기억) · ?server=0 지움 · 없으면 NET.server
export function serverUrl() {
  let s = '';
  try {
    const q = new URLSearchParams(location.search).get('server');
    if (q === '0') sessionStorage.removeItem('oreum.server'); else if (q) sessionStorage.setItem('oreum.server', q);
    s = sessionStorage.getItem('oreum.server') || '';
  } catch (e) { s = ''; }
  s = s || NET.server || '';
  return /^https?:\/\/[^\s]+$/.test(s) ? s.replace(/\/+$/, '') : '';
}
const SRV = serverUrl();
export const ONLINE = !!SRV;

// 세션: { t: 토큰, exp, srv, sub }
let sess = null;
try { const o = JSON.parse(ls.get(SK) || 'null'); if (o && o.t && o.exp > Date.now() && o.srv === SRV) sess = o; } catch (e) { sess = null; }
if (!ONLINE) sess = null;
export const loggedIn = () => !!sess;
const ACCT_KEY = BASE + '.acct';

// main.js 저장 키: 로그인했으면 계정 사본
export const saveKey = (base) => (sess ? ACCT_KEY : base);
export function loadSave(key) {
  let s = {};
  try { s = JSON.parse(ls.get(key) || '{}') || {}; } catch (e) { s = {}; }
  if (sess && s._acct && s._acct !== sess.sub) s = {}; // 다른 계정 사본
  return s;
}

const subOf = (token) => { try { const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(p + '==='.slice((p.length + 3) % 4))).s; } catch (e) { return null; } };
async function api(path, { method = 'GET', body, keepalive = false, token = sess?.t } = {}) {
  const r = await fetch(SRV + path, { method, keepalive, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'http ' + r.status); e.status = r.status; throw e; }
  return j;
}
const strip = (s) => { const o = { ...s }; delete o._rev; delete o._acct; return o; };
function writeCache(save, rev, sub) { ls.set(ACCT_KEY, JSON.stringify({ ...(save || {}), _rev: rev || 0, _acct: sub })); }

/* ---------- 계정 ---------- */
// getSave: 지금 저장 객체, writeLocal: 이 기기에 바로 씀, onFix({coins,total}): 서버가 바로잡은 값, toast, entered(): 이미 입장했는지
export function createAccount({ getSave, writeLocal, onFix, toast, entered }) {
  let timer = 0, busy = false, again = false, keepUntil = 0, lastPush = 0, lastBody = '';
  const listeners = [];
  const changed = () => listeners.forEach((f) => f());
  async function start() {
    if (!ONLINE || !sess) return;
    try {
      const me = await api('/me');
      keepUntil = me.keepUntil; changed();
      const s = getSave();
      if (me.save && (me.rev || 0) > (s._rev || 0) && !entered()) { writeCache(me.save, me.rev, sess.sub); location.reload(); return; } // 다른 기기에서 더 해 둔 기록
      if (!me.save) push();
    } catch (e) {
      if (e.status === 401) { sess = null; ls.del(SK); toast('로그인이 풀렸어요. 이번에는 이 기기에만 저장돼요'); changed(); }
    }
  }
  async function push(keepalive = false) {
    if (!sess) return;
    if (busy && !keepalive) { again = true; return; }
    clearTimeout(timer); timer = 0; busy = true; lastPush = Date.now();
    const s = getSave(), body = JSON.stringify(strip(s));
    if (body === lastBody) { busy = false; return; } // 바뀐 것이 없으면 보내지 않음
    try {
      const r = await api('/save', { method: 'PUT', body: { save: strip(s) }, keepalive });
      lastBody = body; s._rev = r.rev; s._acct = sess.sub; keepUntil = r.keepUntil || keepUntil;
      if (r.fix?.reload) { const me = await api('/me'); writeCache(me.save, me.rev, sess.sub); toast('기록을 서버 값으로 맞췄어요'); setTimeout(() => location.reload(), 1200); return; }
      if (r.fix && (r.fix.coins != null || r.fix.total != null)) onFix(r.fix);
      writeLocal();
      changed();
    } catch (e) {
      if (e.status === 401) { sess = null; ls.del(SK); toast('로그인이 풀렸어요. 이번에는 이 기기에만 저장돼요'); changed(); }
    } finally {
      busy = false; if (again) { again = false; dirty(); }
    }
  }
  function dirty() { if (!sess || timer) return; timer = setTimeout(() => { timer = 0; push(); }, NET.saveDebounce); }
  const flush = () => { if (sess && timer) push(true); };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  async function login(credential, { localSave, hasProgress, ask }) {
    const r = await api('/auth/google', { method: 'POST', body: { credential }, token: null });
    const sub = subOf(r.token);
    const s = { t: r.token, exp: r.exp, srv: SRV, sub };
    let migrate = false;
    if (!r.hasSave && hasProgress) migrate = await ask(); // 처음 로그인한 계정이면 기기 기록을 옮길지 한 번 묻기
    if (migrate) await api('/save', { method: 'PUT', body: { save: strip(localSave), migrate: true }, token: r.token });
    const me = await api('/me', { token: r.token });
    sess = s; ls.set(SK, JSON.stringify(s));
    writeCache(me.save || { nick: localSave.nick }, me.rev, sub);
    location.reload();
  }
  function logout() { flush(); sess = null; ls.del(SK); location.reload(); }
  async function deleteMe() {
    if (!sess) return false;
    await api('/me', { method: 'DELETE' });
    sess = null; ls.del(SK); ls.del(ACCT_KEY);
    location.reload();
    return true;
  }
  const daysLeft = () => (keepUntil ? Math.max(0, Math.ceil((keepUntil - Date.now()) / 864e5)) : NET.keepDays);
  return { start, push, dirty, login, logout, deleteMe, daysLeft, on: (f) => listeners.push(f), get loggedIn() { return !!sess; }, get token() { return sess?.t || null; } };
}

/* ---------- 로그인 화면 ---------- */
let gisP = null;
function loadGis() {
  gisP ||= new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => ok(window.google); s.onerror = no; document.head.append(s); });
  return gisP;
}
// 기기 기록을 옮길지 묻는 작은 창 → Promise<boolean>
function askMigrate() {
  return new Promise((done) => {
    const d = document.createElement('div'); d.className = 'overlay acct-ask'; d.id = 'acct-ask';
    d.innerHTML = '<div class="panel"><p>이 기기에서 하던 기록이 있어요.<br>계정으로 옮길까요?</p><div class="row"><button type="button" class="btn" data-v="0">새로 시작</button><button type="button" class="btn primary" data-v="1">옮기기</button></div></div>';
    d.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; d.remove(); done(b.dataset.v === '1'); });
    document.body.append(d);
  });
}
// box: 첫 화면 안 자리, enterBtn: '시작' 버튼
export function mountLogin({ box, enterBtn, account, localSave, hasProgress, toast }) {
  if (!ONLINE || !box) return;
  box.hidden = false;
  const note = '<p class="acct-beta">베타 서비스예요. 7일 안에 다시 접속하지 않으면 기록이 사라져요.</p>';
  if (account.loggedIn) { box.innerHTML = note + '<p class="acct-who">구글 계정으로 저장 중</p>'; return; }
  box.innerHTML = note + (NET.googleClientId ? '<div class="acct-gis" id="acct-gis"></div>' : '');
  enterBtn.textContent = '손님으로 하기';
  enterBtn.dataset.guest = '1';
  const doLogin = async (cred) => {
    try { await account.login(cred, { localSave, hasProgress, ask: askMigrate }); } catch (e) { toast('로그인하지 못했어요. 잠시 후 다시 해 주세요'); }
  };
  mountLogin.fake = (name = 'tester') => doLogin('fake:' + name); // 확인용 (서버 FAKE_AUTH=1 일 때만 통함)
  if (!NET.googleClientId) return;
  loadGis().then((g) => {
    if (!g?.accounts?.id) return;
    g.accounts.id.initialize({ client_id: NET.googleClientId, callback: (r) => doLogin(r.credential), ux_mode: 'popup' });
    g.accounts.id.renderButton(box.querySelector('#acct-gis'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko', width: 260 });
  }).catch(() => { const g = box.querySelector('#acct-gis'); if (g) g.textContent = '구글 로그인을 불러오지 못했어요'; });
}

/* ---------- 방 (WebSocket) ---------- */
// net.js 의 room 캐퍼빌리티 자리에 그대로: lobby.join(name) → { onPeers(cb, onClose), presence(obj) }
// 더해서 send(msg)·on(type, fn)·id·host (쓰레기 더미 이어 주기에 씀)
export function createWsLobby({ token = () => null } = {}) {
  if (!ONLINE) return null;
  return {
    async join(name) {
      const handlers = {}; let peersCb = null, closeCb = null;
      const on = (t, f) => { (handlers[t] ||= []).push(f); };
      const fire = (t, m) => (handlers[t] || []).forEach((f) => { try { f(m); } catch (e) { /* 한 곳 오류가 다른 곳을 막지 않게 */ } });
      const known = new Map(); // id → presence
      let ws = null, ch = 0, myId = null, host = null, backoff = 1000, closed = false, open = false;
      const me = () => ({ peer: myId, sameTab: true, isMe: true, kind: 'viewer', presence: {} });
      const emit = (joined, updated, left) => peersCb && peersCb({ peers: [me(), ...[...known].map(([peer, presence]) => ({ peer, presence, kind: 'viewer' }))], joined, updated, left });
      function connect() {
        const q = new URLSearchParams({ room: String(name).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40), ch: String(ch) });
        const tk = token(); if (tk) q.set('token', tk);
        ws = new WebSocket(SRV.replace(/^http/, 'ws') + '/ws?' + q);
        ws.onmessage = (e) => {
          let m; try { m = JSON.parse(e.data); } catch (_) { return; }
          if (m.t === 'hi') { myId = m.id; host = m.host; open = true; backoff = 1000; emit([], [], []); fire('hi', m); }
          else if (m.t === 'u') {
            const joined = [], updated = [];
            for (const [id, d0] of m.p) { const old = known.get(id), d = old && !('o' in d0) ? { ...d0, o: old.o, nick: old.nick } : d0; const pr = { peer: id, presence: d, kind: 'viewer' }; (old ? updated : joined).push(pr); known.set(id, d); } // 옷·닉네임은 바뀐 때만 옴, 빈 값(null·false)은 빠져서 옴
            emit(joined, updated, []);
          } else if (m.t === 'l') { if (known.delete(m.id)) emit([], [], [{ peer: m.id }]); }
          else if (m.t === 'host') { host = m.id; fire('host', m); }
          else if (m.t === 'full') { ch = (ch + 1) % NET.maxCh; ws.onclose = null; ws.close(); connect(); } // 정원이 차면 다음 방(채널)
          else fire(m.t, m);
        };
        ws.onclose = () => {
          open = false; myId = null;
          if (known.size) { const left = [...known.keys()].map((peer) => ({ peer })); known.clear(); emit([], [], left); }
          closeCb?.(); fire('close', {});
          if (!closed) { setTimeout(connect, backoff); backoff = Math.min(30000, backoff * 2); }
        };
      }
      connect();
      return {
        onPeers(cb, onClose) { peersCb = cb; closeCb = onClose; },
        presence(obj) { if (open) ws.send(JSON.stringify({ t: 'p', d: obj })); return Promise.resolve(); },
        send(msg) { if (open) ws.send(JSON.stringify(msg)); return open; },
        on, close() { closed = true; ws?.close(); },
        get id() { return myId; }, get host() { return host; }, get isHost() { return !!myId && host === myId; }, get open() { return open; }, get ch() { return ch; },
      };
    },
  };
}

/* ---------- 쓰레기 더미를 방으로 ---------- */
// 더미 남은 수·마지막 접속 시각은 방이 주인. 다시 쌓기(투기꾼·트럭)는 방장 화면에서만 (다른 사람 화면의 투기꾼은 모양만)
export function linkTrash(trash, room) {
  const st = trash.store;
  const o = { takeOne: st.takeOne, putBack: st.putBack, seen: st.seen, setSeen: st.setSeen };
  let seen = 0, live = false, queued = false;
  const relayout = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; trash.relayout(); }, 0); };
  room.on('hi', (m) => {
    seen = m.seen || 0; live = m.sig === HEAP_SIG;
    if (!live) return; // 더미 구성이 다른 서버 → 혼자 하기처럼
    m.heaps.forEach((n, h) => { if (st.left(h) !== n) st.setLeft(h, n); });
    st.commit(); relayout();
  });
  const one = (h, n) => { if (st.left(h) !== n) { st.setLeft(h, n); relayout(); } };
  room.on('h', (m) => { if (live) one(m.h, m.n); });
  room.on('hs', (m) => { if (live) for (const [h, n] of m.hs) one(h, n); });
  room.on('close', () => { live = false; });
  st.takeOne = (h) => { const ok = o.takeOne(h); if (ok && live) room.send({ t: 'take', h }); return ok; };
  st.putBack = (h, n) => {
    if (!live) return o.putBack(h, n);
    if (!room.isHost) return 0;
    const add = o.putBack(h, n); if (add) room.send({ t: 'put', h, n: add }); return add;
  };
  st.seen = () => (live ? seen : o.seen());
  st.setSeen = (t) => { if (live) seen = t; o.setSeen(t); };
  return { get live() { return live; } };
}
