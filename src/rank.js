// 랭킹 (#11): 치운 쓰레기 수. 오늘·이번 주·전체. 서버는 전투 오름 하나 (#98, 예전 깨끗한 오름 기록은 합쳐서 한 줄)
// - 로그인했으면 서버(GET /rank) 위 50명과 내 순위. 내 줄은 강조하고 화면 밖이면 맨 아래(위)에 붙어 있음
// - 서버가 없거나 손님이면 이 기기의 내 기록(오늘·이번 주·전체)만 + '로그인하면 랭킹에 올라가요'
// - 버린 뒤 오늘 순위가 오르면 작은 토스트, 오늘 10위·1위 안이면 업적 이벤트 rank-top10·rank-top1 (하루 한 번)
// 닉네임은 늘 textContent 로만 (#84)
import { RANK } from './balance.js';
import { kstDay } from './rankday.js';

const RANGE_LABEL = { day: '오늘', week: '이번 주', all: '전체' };

// account: online.js createAccount (없으면 null), store: 쓰레기 저장소(없으면 null),
// face(look): 머리 아이콘 svg 문자열, el: { box, list, note, range }
const SRV = 'battle';
export function createRank({ account, store, face, toast, ach, save, persist, el, onOpen }) {
  const st = { srv: SRV, range: 'day', seq: 0, last: {}, lastCheck: 0, open: false };
  const online = () => !!account?.loggedIn;
  if (!save.rankAch || typeof save.rankAch !== 'object') save.rankAch = {};

  function seg(box, items, cur, pick) {
    box.innerHTML = '';
    for (const [id, label] of items) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = id;
      b.setAttribute('aria-pressed', String(id === cur)); b.addEventListener('click', () => pick(id)); box.append(b);
    }
  }
  function tabs() {
    seg(el.range, Object.entries(RANGE_LABEL), st.range, (id) => { st.range = id; render(); });
    el.range.hidden = !online(); // 손님: 세 기록을 한꺼번에 보여 줌
  }
  const row = ({ rank, n, nick, look, me, out }) => {
    const li = document.createElement('li'); li.className = 'rk-row' + (me ? ' me' : '') + (out ? ' out' : '') + (rank && rank <= RANK.medals ? ' medal m' + rank : '');
    const no = document.createElement('span'); no.className = 'rk-no'; no.textContent = rank ? String(rank) : '-';
    const fc = document.createElement('span'); fc.className = 'rk-face'; fc.innerHTML = face(look || ''); // 그림은 정해진 모양만 (look 은 서버가 목록으로 확인한 값)
    const nm = document.createElement('span'); nm.className = 'rk-nick'; nm.textContent = nick || '이름 없는 러너';
    const c = document.createElement('b'); c.className = 'rk-n'; c.textContent = n.toLocaleString('ko-KR');
    li.append(no, fc, nm, c); return li;
  };
  const myNick = () => save.nick || '나';
  const myLook = () => { const h = save.outfit?.gear?.hair; return h ? `${h}|${save.look?.skin || 0}` : ''; };
  async function render() {
    tabs();
    const seq = ++st.seq; el.list.innerHTML = '';
    if (!online()) {
      const r = store ? store.localRank(st.srv) : { day: 0, week: 0, all: 0 };
      el.list.classList.add('local');
      for (const k of ['day', 'week', 'all']) { const li = document.createElement('li'); li.className = 'rk-mine'; const a = document.createElement('span'); a.textContent = RANGE_LABEL[k]; const b = document.createElement('b'); b.textContent = r[k].toLocaleString('ko-KR'); li.append(a, b); el.list.append(li); }
      el.note.textContent = '로그인하면 랭킹에 올라가요';
      return;
    }
    el.list.classList.remove('local');
    el.note.textContent = '불러오는 중…';
    try {
      const r = await account.rank(st.range, st.srv);
      if (seq !== st.seq) return;
      el.list.innerHTML = '';
      r.top.forEach((x) => el.list.append(row(x)));
      if (!r.top.some((x) => x.me)) el.list.append(row({ rank: r.me.rank, n: r.me.n, nick: myNick(), look: myLook(), me: true, out: true }));
      el.note.textContent = r.top.length ? `${r.total.toLocaleString('ko-KR')}명이 치웠어요` : '아직 아무도 치우지 않았어요';
      if (st.range === 'day') noteDay(st.srv, r.me);
      el.list.querySelector('.me:not(.out)')?.scrollIntoView({ block: 'nearest' });
    } catch (e) {
      if (seq === st.seq) el.note.textContent = '랭킹을 불러오지 못했어요';
    }
  }
  function open() {
    onOpen?.();
    st.range = 'day';
    el.box.hidden = false; render();
  }
  // 오늘 순위 기록 → 업적 (하루 한 번)
  function noteDay(srv, me) {
    if (!me?.rank) return;
    const d = kstDay(), A = save.rankAch;
    if (me.rank <= 10 && A.t10 !== d) { A.t10 = d; persist(); ach.emit('rank-top10'); }
    if (me.rank === 1 && A.t1 !== d) { A.t1 = d; persist(); ach.emit('rank-top1'); }
  }
  // 기준 순위: 들어올 때 한 번. 버린 뒤에는 지난번(들어올 때·지난 버리기) 순위와 비교 (줍는 동안 저장이 먼저 올라가도 오른 것을 놓치지 않게)
  async function prime() {
    if (!online()) return;
    const srv = SRV;
    try { const me = (await account.rankMe(srv)).day; if (!st.last[srv]) st.last[srv] = { d: kstDay(), rank: me.rank || 0 }; if (me.rank) noteDay(srv, me); } catch (e) { /* 다음 버리기 때 */ }
  }
  // 버린 뒤: 저장을 바로 보내고 오늘 순위가 오르면 토스트
  async function afterDump() {
    if (!online()) return;
    const t = performance.now(); if (t - st.lastCheck < RANK.checkGapMs) return; st.lastCheck = t;
    const srv = SRV, d = kstDay();
    try {
      let prev = st.last[srv]?.d === d ? st.last[srv].rank : null;
      if (prev == null) prev = (await account.rankMe(srv)).day.rank || 0; // 처음이면 보내기 전 순위를 먼저
      await account.push();
      const me = (await account.rankMe(srv)).day;
      noteDay(srv, me);
      st.last[srv] = { d, rank: me.rank || 0 };
      if (me.rank && (!prev || me.rank < prev)) toast(prev ? `오늘 ${prev}위 → ${me.rank}위` : `오늘 ${me.rank}위`);
    } catch (e) { /* 순위는 다음에 */ }
  }
  return { open, render, afterDump, prime, state: () => ({ ...st, online: online() }) };
}
