// 멀티플레이 (#7): 서버 주소(balance.js NET.server 또는 주소창 ?server=…)가 있을 때만 켜짐. 없으면 아무것도 바꾸지 않음
// - 로그인: 구글 ID 토큰 → 서버 세션 토큰. 손님은 지금처럼 이 기기에만 저장
// - 계정 저장: 이 기기에는 '<키>.acct' 로 사본을 두고, 바뀌면 모아서 서버에 PUT /save. 서버가 귤·장비를 확인해 바로잡은 값을 돌려줌
// - 방: WebSocket 로비. net.js 가 쓰던 room 캐퍼빌리티와 같은 모양(onPeers·presence)으로 바꿔 끼움
// - 쓰레기: 더미 남은 수는 방이 주인. trash 저장소의 takeOne·putBack·seen 을 방으로 이어 줌
import { NET } from './balance.js';
import { HEAP_SIG } from './trash.js';
import { bootShow } from './bootbar.js';

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
export const serverHost = () => { try { return SRV ? new URL(SRV).host : ''; } catch (e) { return ''; } };

// 세션: { t: 토큰, exp, srv, sub }
let sess = null;
try { const o = JSON.parse(ls.get(SK) || 'null'); if (o && o.t && o.exp > Date.now() && o.srv === SRV) sess = o; } catch (e) { sess = null; }
if (!ONLINE) sess = null;
export const loggedIn = () => !!sess;
const ACCT_KEY = BASE + '.acct';

// main.js 저장 키: 로그인했으면 계정 사본
export const saveKey = (base) => (sess ? ACCT_KEY : base);
export let guestExpired = false; // 손님 기록이 7일 넘어 지워진 채로 열림 (#94)
const KEEP_SET = ['gfx', 'gfxV3', 'perf', 'introSound', 'music']; // 지워도 남기는 설정(소리·그래픽)
export function loadSave(key) {
  let s = {};
  try { s = JSON.parse(ls.get(key) || '{}') || {}; } catch (e) { s = {}; }
  if (sess && s._acct && s._acct !== sess.sub) s = {}; // 다른 계정 사본
  if (!sess) { // 손님 (#94): 마지막 접속에서 keepDays 일이 지났으면 지우고 처음부터. 값이 없던 예전 저장은 지금으로 채움(바로 지우지 않음)
    const t = Number(s.lastSeen);
    if (Number.isFinite(t) && t > 0 && Date.now() - t > NET.keepDays * 864e5) {
      const keep = {}; for (const k of KEEP_SET) if (s[k] !== undefined) keep[k] = s[k];
      s = keep; guestExpired = Object.keys(JSON.parse(ls.get(key) || '{}') || {}).some((k) => !KEEP_SET.includes(k));
    }
    s.lastSeen = Date.now();
  }
  return s;
}
export const stampGuest = (s) => { if (!sess) s.lastSeen = Date.now(); }; // 저장할 때마다 마지막 접속 갱신

/* 첫 화면 계정 칸 (#281): 메일은 로그인할 때 구글 ID 토큰에서 읽어 '앞 3글자***@도메인' 으로만 이 기기 세션에 둔다 (원래 주소는 남기지 않음, 서버도 모름) */
export const maskMail = (m) => { const s = String(m || ''), i = s.lastIndexOf('@'); return i < 1 || i === s.length - 1 ? '' : s.slice(0, Math.min(3, i)) + '***' + s.slice(i); };
const mailOf = (cred) => {
  if (typeof cred !== 'string') return '';
  if (cred.startsWith('fake:')) return maskMail(cred.slice(5) + '@test.local'); /* 로컬 검사용 가짜 계정 */
  try { const p = cred.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); const j = JSON.parse(decodeURIComponent(escape(atob(p + '==='.slice((p.length + 3) % 4))))); return maskMail(j.email); } catch (e) { return ''; }
};
const subOf = (token) => { try { const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(p + '==='.slice((p.length + 3) % 4))).s; } catch (e) { return null; } };
async function api(path, { method = 'GET', body, keepalive = false, token = sess?.t } = {}) {
  const r = await fetch(SRV + path, { method, keepalive, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'http ' + r.status); e.status = r.status; e.data = j; throw e; }
  return j;
}
// 의견 보내기 (#77): 서버가 있으면 글 묶음을 POST /feedback (로그인 안 해도 됨)
export const postFeedback = ONLINE ? (items) => api('/feedback', { method: 'POST', body: { items } }) : null;
// 받은 의견 보기 (#96): 어드민만. before 가 있으면 그 id 보다 오래된 50개
export const getFeedback = ONLINE ? (before = 0) => api('/feedback' + (before ? `?before=${before | 0}` : '')) : null;
// 귤 맞춤 기록·운영자 귤 보내기 (#188): 어드민만
export const adminApi = ONLINE ? { clamps: (days = 30) => api('/admin/clamps?days=' + (days | 0)), grants: () => api('/admin/grants'), filegrants: () => api('/admin/filegrants'), grant: (sub, n, why) => api('/admin/grant', { method: 'POST', body: { sub, n, why } }), metrics: (days = 14) => api('/admin/metrics?days=' + (days | 0)) } : null;
// 돌탑 소원 (#127): 읽기·기도·신고는 손님도, 쓰기·내 소식은 로그인만. admin* 은 어드민만
export const wishApi = ONLINE ? {
  list: (c) => api('/wish?c=' + encodeURIComponent(c)), put: (c, text) => api('/wish', { method: 'POST', body: { c, text } }),
  pray: (id) => api('/wish/pray', { method: 'POST', body: { id } }), report: (id) => api('/wish/report', { method: 'POST', body: { id } }),
  news: () => api('/wish/news'), adminList: () => api('/admin/wishes'), admin: (id, act) => api('/admin/wish', { method: 'POST', body: { id, act } }),
} : null;
// 지금 접속 (#186): 어드민만. 숫자만 돌아옴 (총인원·방별·로그인/손님·오늘 최고)
export const getOnline = ONLINE ? () => api('/admin/online') : null;
// 이용 통계 보낼 곳 (#121, metrics.js mtFlush): 서버가 없으면 ''
export const metricsUrl = ONLINE ? SRV + '/m' : '';
// 철 이벤트 (#180): 서버 날짜·모두의 트리 합계 (로그인 안 해도 됨)
export const getSeason = ONLINE ? () => api('/season', { token: null }) : null;
const strip = (s) => { const o = { ...s }; delete o._rev; delete o._acct; delete o.lastSeen; return o; };
function writeCache(save, rev, sub) { ls.set(ACCT_KEY, JSON.stringify({ ...(save || {}), _rev: rev || 0, _acct: sub })); }

/* ---------- 계정 ---------- */
// getSave: 지금 저장 객체, writeLocal: 이 기기에 바로 씀, onFix({coins,total}): 서버가 바로잡은 값, toast, entered(): 이미 입장했는지
// ver: 게임 버전(귤 맞춤 기록용, #188), onGift(g): 운영자가 보낸 귤 { id, n, why } (#188)
export function createAccount({ getSave, writeLocal, onFix, toast, entered, ver = '', onGift = () => {} }) {
  let timer = 0, busy = false, again = false, keepUntil = 0, lastPush = 0, lastBody = '', admin = false, checked = false;
  // 서버가 새 토큰을 주면 바꿔 끼움 (#84: 세션 수명 NET.sessionDays, 남은 날이 적으면 /me 가 새로 줌)
  const renew = (r) => { if (sess && r && typeof r.token === 'string' && r.exp > Date.now()) { sess = { ...sess, t: r.token, exp: r.exp }; ls.set(SK, JSON.stringify(sess)); } };
  const listeners = [];
  const changed = () => listeners.forEach((f) => f());
  async function start() {
    if (!ONLINE || !sess) return;
    try {
      const me = await api('/me');
      keepUntil = me.keepUntil; admin = !!me.admin; checked = true; renew(me); changed();
      const s = getSave();
      if (me.nickRen) s.nickRen = me.nickRen; // 이름 바꾼 횟수·날은 서버 값 (#162)
      if (me.save && (me.rev || 0) > (s._rev || 0) && !entered()) { writeCache(me.save, me.rev, sess.sub); location.reload(); return; } // 다른 기기에서 더 해 둔 기록
      gifts(me.gifts);
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
    const nSold = Array.isArray(s.sold) ? s.sold.length : 0; // 판 것 목록 (#188): 서버가 받으면 보낸 만큼 지움 (그사이 판 것은 남김)
    try {
      const r = await api('/save', { method: 'PUT', body: { save: strip(s), ver }, keepalive });
      lastBody = body; s._rev = r.rev; s._acct = sess.sub; keepUntil = r.keepUntil || keepUntil;
      if (nSold && Array.isArray(s.sold)) { s.sold.splice(0, nSold); if (!s.sold.length) delete s.sold; }
      gifts(r.gifts);
      if (r.fix?.reload) { const me = await api('/me'); writeCache(me.save, me.rev, sess.sub); toast('기록을 서버 값으로 맞췄어요'); setTimeout(() => location.reload(), 1200); return; }
      if (r.fix && (r.fix.coins != null || r.fix.total != null || r.fix.mealFree || 'season' in r.fix || r.fix.nick || r.fix.gift || r.fix.lv || r.fix.tok)) onFix(r.fix);
      writeLocal();
      changed();
    } catch (e) {
      if (e.status === 401) { sess = null; ls.del(SK); toast('로그인이 풀렸어요. 이번에는 이 기기에만 저장돼요'); changed(); }
    } finally {
      busy = false; if (again) { again = false; dirty(); }
    }
  }
  // 운영자가 보낸 귤 (#188): 받은 id 를 save.giftGot 에 남겨 같은 것을 두 번 받지 않음. 다음 저장에 실려 서버가 받은 것으로 침
  function gifts(list) {
    if (!Array.isArray(list) || !list.length) return;
    const s = getSave(), got = Array.isArray(s.giftGot) ? s.giftGot : (s.giftGot = []);
    let any = false;
    for (const g of list) { const id = Number(g?.id), n = Math.floor(Number(g?.n)); if (!(id > 0) || !(n > 0) || got.includes(id)) continue; got.push(id); any = true; onGift({ id, n, why: String(g.why || '') }); }
    if (got.length > 100) got.splice(0, got.length - 100);
    if (any) { writeLocal(); dirty(); }
  }
  function dirty() { if (!sess || timer) return; timer = setTimeout(() => { timer = 0; push(); }, NET.saveDebounce); }
  const flush = () => { if (sess && timer) push(true); };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  async function login(credential, { localSave, hasProgress, ask }) {
    const r = await api('/auth/google', { method: 'POST', body: { credential }, token: null });
    const sub = subOf(r.token);
    const s = { t: r.token, exp: r.exp, srv: SRV, sub, m: mailOf(credential) };
    let migrate = false;
    if (!r.hasSave && hasProgress) migrate = await ask(); // 처음 로그인한 계정이면 기기 기록을 옮길지 한 번 묻기
    if (migrate) await api('/save', { method: 'PUT', body: { save: strip(localSave), migrate: true }, token: r.token });
    const me = await api('/me', { token: r.token });
    sess = s; ls.set(SK, JSON.stringify(s));
    writeCache(me.save || { nick: localSave.nick }, me.rev, sub);
    bootShow('계정 기록 불러오는 중'); location.reload();
  }
  /* 로그아웃 (#281): 남은 저장을 서버에 먼저 보내고(3초까지), 서버 토큰을 버리고(POST /logout), 이 기기의 토큰·계정 사본을 지운 뒤 손님으로 다시 열기.
     서버에 다 보냈는지 모르면 계정 사본은 남김(계정 번호가 붙어 있어 손님 저장과 섞이지 않고, 같은 계정으로 다시 로그인하면 이어짐) */
  async function logout() {
    if (!sess) return;
    bootShow('로그아웃하는 중');
    clearTimeout(timer); timer = 0;
    let synced = false;
    try { await Promise.race([push(), new Promise((r) => setTimeout(r, 3000))]); synced = !busy && lastBody === JSON.stringify(strip(getSave())); } catch (e) { synced = false; }
    const t = sess?.t; if (t) fetch(SRV + '/logout', { method: 'POST', keepalive: true, headers: { authorization: 'Bearer ' + t } }).catch(() => {}); // 이 토큰은 서버에서도 버림 (#84)
    sess = null; ls.del(SK); if (synced) ls.del(ACCT_KEY);
    location.reload();
  }
  async function deleteMe() {
    if (!sess) return false;
    await api('/me', { method: 'DELETE' });
    sess = null; ls.del(SK); ls.del(ACCT_KEY);
    location.reload();
    return true;
  }
  // 이름 바꾸기 (#162): 귤을 서버에 먼저 맞춘 뒤 POST /nick. 실패는 e.message(bad|same|day|price|coins), e.data.price
  async function rename(nick, price) {
    if (!sess) throw new Error('login');
    for (let i = 0; i < 30 && busy; i++) await new Promise((ok) => setTimeout(ok, 100));
    await push();
    const r = await api('/nick', { method: 'POST', body: { nick, price } });
    const s = getSave(); s._rev = r.rev; lastBody = '';
    return r;
  }
  // 랭킹 (#11): 로그인했을 때만. 서버가 확인한 치운 양으로 셈
  const rank = (range, srv) => api(`/rank?range=${encodeURIComponent(range)}&srv=${encodeURIComponent(srv)}`);
  const rankMe = (srv) => api(`/rank/me?srv=${encodeURIComponent(srv)}`);
  const daysLeft = () => (keepUntil ? Math.max(0, Math.ceil((keepUntil - Date.now()) / 864e5)) : NET.keepDays);
  return { start, push, dirty, rename, rank, rankMe, login, logout, deleteMe, daysLeft, on: (f) => listeners.push(f), get loggedIn() { return !!sess; }, get token() { return sess?.t || null; }, get sub() { return sess?.sub || null; }, get mail() { return sess?.m || ''; }, get admin() { return !!sess && admin; }, get checked() { return !sess || checked; } };
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
// 로그아웃 묻기 (#281) → Promise<boolean>. 이 기기 저장이 어떻게 되는지 한 줄
export function askLogout() {
  return new Promise((done) => {
    const d = document.createElement('div'); d.className = 'overlay acct-ask'; d.id = 'acct-ask-out'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', '로그아웃');
    d.innerHTML = '<div class="panel"><p><b>로그아웃할까요?</b><br><span class="acct-ask-sub">계정 기록은 서버에 남아요. 이 기기는 손님으로 돌아가요</span></p><div class="row"><button type="button" class="btn" data-v="0">그대로 두기</button><button type="button" class="btn primary" data-v="1">로그아웃</button></div></div>';
    d.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b && e.target !== d) return; d.remove(); done(!!b && b.dataset.v === '1'); });
    document.body.append(d);
    d.querySelector('[data-v="0"]').focus();
  });
}
// 계정 칸 (#281): 프로필 동그라미(이름 첫 글자, 사진은 쓰지 않음)·이름·'구글 계정으로 로그인됨'(가린 메일) + 로그아웃. 첫 화면과 설정 창이 같이 씀
export function acctCard({ nick, mail, onLogout }) {
  const c = document.createElement('div'); c.className = 'acct-card';
  const n = String(nick || '').trim(), first = Array.from(n)[0] || '?';
  const av = document.createElement('span'); av.className = 'acct-av'; av.setAttribute('aria-hidden', 'true'); av.textContent = first.toUpperCase();
  const meta = document.createElement('span'); meta.className = 'acct-meta';
  const b = document.createElement('b'); b.className = 'acct-nick'; b.textContent = n || '이름 없음';
  const sm = document.createElement('small'); sm.className = 'acct-mail'; sm.textContent = '구글 계정으로 로그인됨' + (mail ? ' · ' + mail : '');
  meta.append(b, sm);
  const out = document.createElement('button'); out.type = 'button'; out.className = 'btn small acct-logout'; out.textContent = '로그아웃';
  out.addEventListener('click', (e) => { e.stopPropagation(); onLogout?.(); });
  c.append(av, meta, out);
  return c;
}
// box: 첫 화면 안 자리, enterBtn: '시작' 버튼, onLogout: 로그아웃 단추(묻기는 부른 쪽이)
export function mountLogin({ box, enterBtn, account, localSave, hasProgress, toast, onLogout }) {
  if (!ONLINE || !box) return;
  box.hidden = false;
  if (account.loggedIn) { box.textContent = ''; box.append(acctCard({ nick: localSave.nick, mail: account.mail, onLogout })); return; }
  const note = '<p class="acct-beta">손님으로 하는 중 · 로그인하면 기록이 남아요</p>';
  box.innerHTML = note + (NET.googleClientId ? '<div class="acct-gis" id="acct-gis"><div class="btn gbtn" aria-hidden="true"><svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span class="gtxt">Google 계정으로 로그인</span></div><div class="gov" id="acct-gov"></div></div>' : '');
  enterBtn.textContent = '손님으로 하기';
  enterBtn.classList.add('guest-go');
  enterBtn.dataset.guest = '1';
  const doLogin = async (cred) => {
    const gt = box.querySelector('.gtxt'), gb = box.querySelector('#acct-gis');
    if (gt) gt.textContent = '로그인 중…'; gb?.classList.add('busy');
    try { await account.login(cred, { localSave, hasProgress, ask: askMigrate }); } catch (e) { toast('로그인하지 못했어요. 잠시 후 다시 해 주세요'); if (gt) gt.textContent = '로그인하지 못했어요. 다시 눌러 보세요'; gb?.classList.remove('busy'); setTimeout(() => { if (gt && gb && !gb.classList.contains('busy')) gt.textContent = 'Google 계정으로 로그인'; }, 3000); }
  };
  mountLogin.fake = (name = 'tester') => doLogin('fake:' + name); // 확인용 (서버 FAKE_AUTH=1 일 때만 통함)
  if (!NET.googleClientId) return;
  loadGis().then((g) => {
    if (!g?.accounts?.id) return;
    g.accounts.id.initialize({ client_id: NET.googleClientId, callback: (r) => doLogin(r.credential), ux_mode: 'popup' });
    const gis = box.querySelector('#acct-gis'), ov = box.querySelector('#acct-gov'), gtxt = box.querySelector('.gtxt');
    if (!gis || !ov) return;
    // 보이는 건 직접 그린 버튼, 그 위에 투명한 GSI 버튼을 같은 너비로 덮어 누름만 받는다 (#102). 너비가 바뀌면 다시 그림
    let lastW = 0;
    const draw = () => {
      const w = Math.max(200, Math.min(400, Math.round(gis.clientWidth)));
      if (w === lastW) return; lastW = w; ov.textContent = '';
      g.accounts.id.renderButton(ov, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko', width: w, logo_alignment: 'left' });
    };
    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(gis); else addEventListener('resize', draw);
    ov.addEventListener('pointerdown', () => { gtxt.textContent = '로그인 중…'; gis.classList.add('busy'); });
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
        const tk = token();
        // 토큰은 주소창(서버 로그에 남음) 대신 하위 프로토콜로 (#84). 서버는 'oreum' 으로 답함
        ws = tk ? new WebSocket(SRV.replace(/^http/, 'ws') + '/ws?' + q, ['oreum', 't.' + tk]) : new WebSocket(SRV.replace(/^http/, 'ws') + '/ws?' + q);
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
          else if (m.t === 'idle') { closed = true; fire('idle', m); } // 오래 멈춰 서버가 내보냄 (#157): 다시 붙지 않고 쉬는 화면 (누르면 wake)
          else if (m.t === 'ban' || m.t === 'kick') { backoff = Math.max(backoff, (m.sec || 60) * 1000); fire(m.t, m); } // 끊김 (#84): 풀릴 때까지 기다렸다 다시
          else fire(m.t, m);
        };
        ws.onclose = (e) => {
          if (e?.code === 4004 && !closed) { closed = true; fire('idle', {}); } // idle 메시지를 못 받았어도 닫는 까닭 코드로 (#157)
          gone();
          if (!closed) { setTimeout(connect, backoff); backoff = Math.min(30000, backoff * 2); }
        };
      }
      function gone() {
        open = false; myId = null;
        if (known.size) { const left = [...known.keys()].map((peer) => ({ peer })); known.clear(); emit([], [], left); }
        closeCb?.(); fire('close', {});
      }
      connect();
      return {
        onPeers(cb, onClose) { peersCb = cb; closeCb = onClose; },
        presence(obj) { if (open) ws.send(JSON.stringify({ t: 'p', d: obj })); return Promise.resolve(); },
        send(msg) { if (open) ws.send(JSON.stringify(msg)); return open; },
        on, close() { closed = true; ws?.close(); },
        // 쉬러 가기 (#157): 방에서 나감(다시 붙지 않음) / 다시 들어옴 (같은 방·채널, 핸들러 그대로)
        sleep() { if (closed) return; closed = true; const w = ws; if (w) { w.onmessage = null; w.onclose = null; try { w.close(1000, 'rest'); } catch (e) { /* 이미 닫힘 */ } } gone(); }, // 닫힘 알림을 기다리지 않고 바로 (다시 들어올 때 옛 연결 값이 섞이지 않게)
        wake() { if (!closed) return; closed = false; backoff = 1000; connect(); },
        get asleep() { return closed; },
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
  room.on('h', (m) => { if (!live) return; one(m.h, m.n); const k = Math.min(NET.takeAsk, m.no === true ? 1 : m.no | 0); for (let i = 0; i < k; i++) trash.undoTake?.(m.h); }); // no: 방이 거절한 수 → 배낭에서 그만큼 되돌림 (#84, #137 여럿)
  room.on('hs', (m) => { if (live) for (const [h, n] of m.hs) one(h, n); });
  room.on('close', () => { live = false; });
  // 한 번에 여러 개 줍는 도구(#137 흡입기 초당 32개)를 위해 같은 틱 안의 줍기는 더미마다 묶어 {t:'take', h, n} 하나로 보냄
  const pend = new Map(); let flushQ = false;
  const flush = () => { flushQ = false; if (live) for (const [h, n0] of pend) for (let n = n0; n > 0; n -= NET.takeMax) { const k = Math.min(n, NET.takeMax); room.send(k > 1 ? { t: 'take', h, n: k } : { t: 'take', h }); } pend.clear(); }; // 방이 한 메시지에 takeMax 개까지만 받으므로 나눠 보냄 (#144)
  st.takeOne = (h) => { const ok = o.takeOne(h); if (ok && live) { pend.set(h, (pend.get(h) || 0) + 1); if (!flushQ) { flushQ = true; queueMicrotask(flush); } } return ok; };
  // 동료 줍기 (#172): 방에는 {t:'btake', h} 로 (번 몫에 안 셈, 서버도 마지막 BUDDIES.keep 은 남김). 옛 서버는 모르는 메시지라 넘김 → 다음 hs 로 되돌아옴
  if (st.nibble) { const nib = st.nibble; st.nibble = (h) => { const ok = nib(h); if (ok && live) room.send({ t: 'btake', h }); return ok; }; }
  // 다시 쌓기 (#131): 방장만이 아니라 각자 둘레 투기꾼·몹이 쌓은 것을 보냄. 받아 줄지는 방이 정함(움직이는 사람·방 전체 한도), 못 받으면 {t:'h'} 로 되돌아옴
  st.putBack = (h, n) => {
    if (!live) return o.putBack(h, n);
    const add = o.putBack(h, n); if (add) room.send({ t: 'put', h, n: add }); return add;
  };
  st.seen = () => (live ? seen : o.seen());
  st.setSeen = (t) => { if (live) seen = t; o.setSeen(t); };
  st.roomLive = () => live; // 방에 붙어 있으면 빈 동안 몫은 방이 채움 (탭을 오래 숨겼다 와도 내 화면에서 채우지 않음)
  return { get live() { return live; } };
}
