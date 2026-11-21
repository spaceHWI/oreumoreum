// 상황에 맞는 팁 (#66): 일이 생기면 한 줄 팁을 한 번 보여 준다
// 팁은 아래 표 한 곳. 줄만 더하면 늘어난다.
//  id    : 저장에 쓰는 이름 (바꾸지 않는다)
//  when  : (S) => 참이면 지금 보여 줄 만한 상황. S 는 main.js 가 주는 상태 (아래 snapshot 참고). 일이 한 번 일어났을 때만 쓰는 팁은 S.ev.<이름>
//  ic    : TIP_ICON 의 아이콘 이름
//  text  : 한 줄 문구
//  go    : 눌렀을 때 갈 곳 (main.js 의 go 핸들러 이름): shop · cleanhouse · dex · heap(가까운 더미 쪽 표시) · stream · stone · map(오름 지도, #136)
import { ic } from './icons.js';
export const TIP = { sec: 4, gap: 30, rare: { max: 3, chance: 0.4 }, evLife: 25, idleSec: 120, eventsMax: 12 };

const P = (d) => `<path d="${d}"/>`;
export const TIP_ICON = {
  bag: ic('bag'),
  shop: ic('shop'),
  heart: ic('heart'),
  shirt: ic('wear'),
  bow: ic('bow'),
  flower: ic('bloom'),
  hand: ic('pick'),
  book: ic('dex'),
  fish: ic('fish'),
  fork: ic('eat'),
  arrow: ic('arrow-down'),
  peak: ic('zone'),
};

// 한가할 때 '가까운 쓰레기 더미는 이쪽이에요'(예전 'idle')는 감독의 실마리로 옮김 (#176, game/director.js heapHint)
export const TABLE = [
  { id: 'bagFull', when: (S) => S.bagFull && !S.bagOften, ic: 'bag', text: '배낭이 가득 찼어요. 클린하우스에서 버려요', go: 'cleanhouse' },
  { id: 'bagOften', when: (S) => S.bagFull && S.bagOften && S.bagTier < 5, ic: 'bag', text: '귤을 모아 장비점에서 더 큰 배낭을 사 보세요', go: 'shop' },
  { id: 'canBuy', when: (S) => S.canBuy, ic: 'shop', text: '장비점에서 살 수 있는 장비가 생겼어요', go: 'shop' },
  { id: 'stoneFree', when: (S) => S.stoneFree, ic: 'fork', text: '스톤의 첫 식사는 공짜예요', go: 'stone' },
  { id: 'hpLow', when: (S) => S.hpLow && !S.enemyNear, ic: 'heart', text: '스톤에서 식사하면 HP가 빨리 돌아와요', go: 'stone' },
  { id: 'carried', when: (S) => S.ev.carried, ic: 'shirt', text: 'LEAP 에서 티셔츠·잠바를 갖추면 더 잘 버텨요', go: 'leap' },
  { id: 'hardEnemy', when: (S) => S.enemyNear && !S.hasBow, ic: 'bow', text: '장비점 귤 활이 있으면 훨씬 쉬워요', go: 'shop' },
  { id: 'firstHeap', when: (S) => S.ev.heapClear, ic: 'flower', text: '구역을 다 치우면 꽃밭이 돼요' },
  { id: 'dumper', when: (S) => S.ev.dumper, ic: 'hand', text: '버리기 전에 귤을 던져 쫓아낼 수 있어요' },
  { id: 'rareFirst', when: (S) => S.ev.rare, ic: 'book', text: '드문 것은 도감에 실려요', go: 'dex' },
  { id: 'nearStream', when: (S) => S.nearStream, ic: 'fish', text: '개울가에서는 낚시를 할 수 있어요', go: 'stream' },
  { id: 'buffEnd', when: (S) => S.ev.buffEnd, ic: 'fork', text: '버프가 끝났어요. 스톤에서 다시 식사해요', go: 'stone' },
  { id: 'charge', when: (S) => S.ev.charge, ic: 'hand', text: '버튼을 길게 눌렀다 놓으면 모아 쏘기' }, // #129 첫 적을 쫓아낸 뒤
  { id: 'crow', when: (S) => S.ev.crow, ic: 'bag', text: '배낭이 가득 차면 까마귀가 노려요. 클린하우스에 버리세요', go: 'cleanhouse' }, // #163 처음 까마귀가 올 때
  { id: 'zoneUp', when: (S) => S.ev.zoneUp, ic: 'peak', text: '위로 갈수록 어려워져요', go: 'map' }, // #136 튜토리얼 뒤 처음 정낭(초보→중수)을 지날 때
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
  const tipEvName = (id) => ({ carried: 'carried', firstHeap: 'heapClear', dumper: 'dumper', rareFirst: 'rare', buffEnd: 'buffEnd', zoneUp: 'zoneUp', charge: 'charge', crow: 'crow' })[id];
  return { event, update, off: (v) => { T().off = v ? 1 : 0; persist(); }, isOff: () => !!T().off, seen: () => structuredClone(T().seen), reset: () => { T().seen = {}; last = -1e9; persist(); }, TABLE };
}
