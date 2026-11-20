// 상황에 맞는 팁 (#66): 일이 생기면 한 줄 팁을 한 번 보여 준다
// 팁은 아래 표 한 곳. 줄만 더하면 늘어난다.
//  id    : 저장에 쓰는 이름 (바꾸지 않는다)
//  when  : (S) => 참이면 지금 보여 줄 만한 상황. S 는 main.js 가 주는 상태 (아래 snapshot 참고). 일이 한 번 일어났을 때만 쓰는 팁은 S.ev.<이름>
//  ic    : TIP_ICON 의 아이콘 이름
//  text  : 한 줄 문구
//  go    : 눌렀을 때 갈 곳 (main.js 의 go 핸들러 이름): shop · cleanhouse · dex · heap(가까운 더미 쪽 표시) · stream · stone
export const TIP = { sec: 4, gap: 30, rare: { max: 3, chance: 0.4 }, evLife: 25, idleSec: 120, eventsMax: 12 };

const P = (d) => `<path d="${d}"/>`;
export const TIP_ICON = {
  bag: P('M8 8V6a4 4 0 0 1 8 0v2M5 8h14l-1 12H6L5 8z'),
  shop: P('M5 9l1-4h12l1 4M5 9v10h14V9M5 9h14M10 19v-5h4v5'),
  heart: P('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.600-7 10-7 10z'),
  shirt: P('M8 4l-5 3 2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 0 1-8 0z'),
  bow: P('M6 4c6 2 6 14 0 16M6 4v16M6 12h13M16 9l3 3-3 3'),
  flower: '<circle cx="12" cy="12" r="2.2"/>' + P('M12 3a3 3 0 0 1 0 6.600M12 21a3 3 0 0 1 0-6.600M3 12a3 3 0 0 1 6.600 0M21 12a3 3 0 0 0-6.600 0'),
  hand: P('M7 12V6a1.500 1.500 0 0 1 3 0v5M10 11V4.500a1.500 1.500 0 0 1 3 0V11M13 11V6a1.500 1.500 0 0 1 3 0v8c0 4-2 6-5 6-3 0-4-2-5-4l-1-3a1.500 1.500 0 0 1 2.500-1.500L8 14'),
  book: P('M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM8 17h11'),
  fish: P('M3 12c3-5 9-6 13-2l5-3v10l-5-3c-4 4-10 3-13-2zM8.500 11.500h.01'),
  fork: P('M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10'),
  arrow: P('M12 4v13M6 12l6 6 6-6'),
};

export const TABLE = [
  { id: 'bagFull', when: (S) => S.bagFull && !S.bagOften, ic: 'bag', text: '배낭이 가득 찼어요. 클린하우스에서 버려요', go: 'cleanhouse' },
  { id: 'bagOften', when: (S) => S.bagFull && S.bagOften && S.bagTier < 5, ic: 'bag', text: '귤을 모아 더 큰 배낭을 사 보세요', go: 'shop' },
  { id: 'canBuy', when: (S) => S.canBuy, ic: 'shop', text: '귤로 살 수 있는 장비가 생겼어요', go: 'shop' },
  { id: 'stoneFree', when: (S) => S.stoneFree, ic: 'fork', text: '스톤의 첫 식사는 공짜예요', go: 'stone' },
  { id: 'hpLow', when: (S) => S.hpLow && !S.enemyNear, ic: 'heart', text: '스톤에서 식사하면 HP가 빨리 돌아와요', go: 'stone' },
  { id: 'carried', when: (S) => S.ev.carried, ic: 'shirt', text: '티셔츠·잠바를 갖추면 더 잘 버텨요', go: 'shop' },
  { id: 'hardEnemy', when: (S) => S.enemyNear && !S.hasBow, ic: 'bow', text: '귤 활이 있으면 훨씬 쉬워요', go: 'shop' },
  { id: 'firstHeap', when: (S) => S.ev.heapClear, ic: 'flower', text: '구역을 다 치우면 꽃밭이 돼요' },
  { id: 'dumper', when: (S) => S.ev.dumper, ic: 'hand', text: '버리기 전에 귤을 던져 쫓아낼 수 있어요' },
  { id: 'rareFirst', when: (S) => S.ev.rare, ic: 'book', text: '드문 것은 도감에 실려요', go: 'dex' },
  { id: 'nearStream', when: (S) => S.nearStream, ic: 'fish', text: '개울가에서는 낚시를 할 수 있어요', go: 'stream' },
  { id: 'buffEnd', when: (S) => S.ev.buffEnd, ic: 'fork', text: '버프가 끝났어요. 스톤에서 다시 식사해요', go: 'stone' },
  { id: 'idle', when: (S) => S.idle >= TIP.idleSec, ic: 'arrow', text: '가까운 쓰레기 더미는 이쪽이에요', go: 'heap' },
];

export function createTips({ save, persist, show, state, today = () => new Date().toDateString(), rnd = Math.random }) {
  const T = () => (save.tips ||= { off: 0, seen: {} }); // 예전 저장에는 없음
  const ev = {}; let evT = 0, last = -1e9, clock = 0, acc = 0, bagFulls = [], wasFull = false;
  const seenOf = (id) => T().seen[id] || { n: 0, day: '' };
  function event(name) { ev[name] = evT = clock; }
  function can(tip) {
    const s = seenOf(tip.id);
    if (!s.n) return true;
    return s.n < TIP.rare.max && s.day !== today() && rnd() < TIP.rare.chance;
  }
  function fire(tip) {
    const s = seenOf(tip.id); T().seen[tip.id] = { n: s.n + 1, day: today() }; persist();
    last = clock; show(tip);
  }
  // dt 초마다 호출. 0.5초에 한 번만 확인
  function update(dt, getS) {
    clock += dt; acc += dt;
    if (acc < 0.5) return null; acc = 0;
    for (const k in ev) if (clock - ev[k] > TIP.evLife) delete ev[k];
    if (T().off || clock - last < TIP.gap) return null;
    const S = getS(); if (S.busy) return null;
    S.ev = ev;
    // 배낭이 가득 찬 횟수: 가득 참으로 바뀔 때마다 센다 (최근 10분)
    if (S.bagFull && !wasFull) { bagFulls.push(clock); bagFulls = bagFulls.filter((t) => clock - t < 600); }
    wasFull = S.bagFull; S.bagOften = bagFulls.length >= 3;
    for (const tip of TABLE) {
      let ok = false; try { ok = !!tip.when(S); } catch { ok = false; }
      if (!ok || !can(tip)) continue;
      if (tip.id === 'bagFull' || tip.id === 'bagOften') { if (!S.bagFull) continue; }
      fire(tip); delete ev[tipEvName(tip.id)]; return tip;
    }
    return null;
  }
  const tipEvName = (id) => ({ carried: 'carried', firstHeap: 'heapClear', dumper: 'dumper', rareFirst: 'rare', buffEnd: 'buffEnd' })[id];
  return { event, update, off: (v) => { T().off = v ? 1 : 0; persist(); }, isOff: () => !!T().off, seen: () => structuredClone(T().seen), reset: () => { T().seen = {}; last = -1e9; persist(); }, TABLE };
}
