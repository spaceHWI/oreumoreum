// 걸으면서 배우는 튜토리얼. 글 대신 그림 힌트, UI는 쓸 일이 생길 때 하나씩 나타남.
// 남송이오름 흐름(#17): 걷기 → 쓰레기 3개 줍기(배낭) → 클린하우스에 버리기(귤) → 상점에서 집게 → 돌탑에 돌 → 달리기 전환 → 끝(나머지 UI 전부)
// 맵 설정 spots.tut 에 trash(고정 쓰레기 자리)가 있을 때만 켜진다. 저장 키는 save.nsV2 (main.js)

const I = {
  keys: `<g fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3" stroke-linejoin="round"><rect x="40" y="10" width="30" height="30" rx="6"/><rect x="6" y="46" width="30" height="30" rx="6"/><rect x="40" y="46" width="30" height="30" rx="6"/><rect x="74" y="46" width="30" height="30" rx="6"/></g><g fill="#fff" font-family="Jua, sans-serif" font-size="17" text-anchor="middle"><text x="55" y="31">W</text><text x="21" y="67">A</text><text x="55" y="67">S</text><text x="89" y="67">D</text></g>`,
  joy: `<circle cx="55" cy="45" r="34" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/><circle class="bob-x" cx="55" cy="45" r="16" fill="#f6a53a" stroke="#fff" stroke-width="3"/>`,
  drag: `<path class="bob-x" d="M30 60 l0 -30 a6 6 0 0 1 12 0 l0 18 l4 -8 a6 6 0 0 1 11 3 l0 5 a6 6 0 0 1 11 2 l0 4 a6 6 0 0 1 10 4 l-2 22 q-2 12 -14 12 h-20 q-10 0 -14 -9z" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M14 22 h-8 M104 22 h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M8 22 l6 -5 M8 22 l6 5 M110 22 l-6 -5 M110 22 l-6 5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  gyul: `<circle cx="55" cy="60" r="18" fill="#f6a53a" stroke="#fff" stroke-width="3"/><path d="M55 42 q4 -8 12 -7" fill="none" stroke="#7fae5a" stroke-width="4" stroke-linecap="round"/><path class="bob-y" d="M55 8 v18 M47 20 l8 8 8 -8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  throw: `<path d="M18 70 q30 -60 70 -40" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 5"/><circle class="bob-x" cx="22" cy="68" r="9" fill="#f6a53a" stroke="#fff" stroke-width="3"/><rect x="80" y="30" width="22" height="46" rx="9" fill="#6f6a62" stroke="#fff" stroke-width="3"/><rect x="76" y="22" width="30" height="12" rx="4" fill="#5a554d" stroke="#fff" stroke-width="3"/><circle cx="87" cy="46" r="2.5" fill="#fff"/><circle cx="95" cy="46" r="2.5" fill="#fff"/>`,
  jump: `<path d="M8 70 q24 -10 48 0 q24 10 48 0" fill="none" stroke="#79b0c6" stroke-width="5" stroke-linecap="round"/><g class="bob-y"><circle cx="55" cy="22" r="7" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3"/><path d="M55 29 v14 M45 36 l10 -4 10 4 M55 43 l-8 14 M55 43 l8 14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  pick: `<ellipse cx="30" cy="70" rx="22" ry="7" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3"/><rect x="20" y="48" width="20" height="22" rx="6" fill="#d9eef5" stroke="#fff" stroke-width="3"/><path d="M62 68 l26 -34 M72 30 q10 4 14 14 M88 34 q-4 12 -14 16" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path class="bob-y" d="M30 8 v18 M22 20 l8 8 8 -8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  dump: `<path d="M10 78 v-34 l30 -22 l30 22 v34z" fill="#efe3c2" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><rect x="30" y="52" width="20" height="26" fill="#8a6a48" stroke="#fff" stroke-width="3"/><path class="bob-x" d="M80 30 h20 M92 22 l8 8 -8 8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="82" y="46" width="18" height="24" rx="7" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3"/>`,
  shop: `<rect x="12" y="46" width="52" height="30" rx="4" fill="#efe3c2" stroke="#fff" stroke-width="3"/><path d="M8 46 l8 -20 h44 l8 20z" fill="#e8a23a" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle class="bob-y" cx="88" cy="30" r="14" fill="#f6a53a" stroke="#fff" stroke-width="3"/><path d="M80 66 l16 -10 M80 56 l16 10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  stone: `<ellipse cx="55" cy="72" rx="26" ry="9" fill="#b9b3a6" stroke="#fff" stroke-width="3"/><ellipse cx="55" cy="58" rx="19" ry="7" fill="#cfc9bc" stroke="#fff" stroke-width="3"/><ellipse cx="55" cy="46" rx="13" ry="5.5" fill="#b9b3a6" stroke="#fff" stroke-width="3"/><ellipse class="bob-y" cx="55" cy="26" rx="9" ry="5" fill="#cfc9bc" stroke="#fff" stroke-width="3"/>`,
  speed: `<circle cx="66" cy="18" r="7" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3"/><path d="M30 76 l14 -20 12 8 4 -22 16 10 h12 M42 42 l10 -14 16 6 8 12 M16 50 h12 M8 62 h16 M20 38 h10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  fork: `<rect x="51" y="30" width="8" height="48" fill="#8a6a48" stroke="#fff" stroke-width="3"/><path d="M10 22 l10 -10 h32 v20 h-32z" fill="#efe3c2" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M100 36 l-10 -10 h-32 v20 h32z" fill="#efe3c2" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M26 28 q6 -12 12 0" fill="#7fae5a"/><path d="M70 42 l6 -12 6 12z" fill="#8fa3b6"/>`,
};
const svg = (inner) => `<svg viewBox="0 0 110 85" aria-hidden="true">${inner}</svg>`;

export function createTutorial({ save, persist, player, cam, isTouch, pts, addCoins }) {
  const S = (save.tut ||= { step: 0, done: false });
  const steps = ['move', 'pick', 'dump', 'shop', 'stone', 'run'];
  if (!pts || !pts.trash) return { update() {}, notify() {}, skipAll() {}, active: false };
  const card = document.createElement('div'); card.id = 'tut-hint'; card.hidden = true; document.body.append(card);
  let cur = null, timer = 0, startPos = null;
  const counters = { trash: 0, dump: 0, stone: 0, gait: 0 };
  const P = pts; let origin = null;
  const show = (icon, pos) => { card.innerHTML = svg(I[icon]); card.className = 'pos-' + pos; card.hidden = false; };
  const hide = () => { card.hidden = true; };
  const unlock = (name) => { document.querySelectorAll(`[data-tut="${name}"]`).forEach((el) => { if (el.classList.contains('tut-on')) return; el.classList.add('tut-on'); el.classList.add('tut-pop'); setTimeout(() => el.classList.remove('tut-pop'), 900); }); };
  const begin = (name) => {
    cur = name; timer = 0; startPos = player.pos.clone();
    if (name === 'move') { unlock('move'); show(isTouch ? 'joy' : 'keys', isTouch ? 'left' : 'center'); }
    if (name === 'pick') { unlock('interact'); unlock('bag'); show('pick', 'right'); }
    if (name === 'dump') show('dump', 'right');
    if (name === 'shop') {
      if (!S.paid && save.equip.tool < 2) { S.paid = 1; persist(); addCoins(P.reward || 100); } // 집게 값만큼 튜토리얼 보상
      show('shop', 'right');
    }
    if (name === 'stone') show('stone', 'right');
    if (name === 'run') { unlock('speed'); show('speed', 'right'); }
  };
  const finish = () => { hide(); S.step = steps.indexOf(cur) + 1; persist(); if (cur === 'dump') unlock('gyul'); cur = null; };
  // 각 단계의 완료 조건 (시작은 앞 단계가 끝나는 대로)
  const doneWhen = {
    move: () => startPos.distanceTo(player.pos) > 4,
    pick: () => counters.trash >= 3,
    dump: () => counters.dump > 0,
    shop: () => save.equip.tool >= 2,
    stone: () => counters.stone > 0,
    run: () => counters.gait > 0 || timer > 15,
  };
  function update(dt) {
    if (S.done) return;
    timer += dt;
    origin ||= player.pos.clone();
    if (P.giveUp && origin.distanceTo(player.pos) > P.giveUp) { skipAll(); return; } // 길을 벗어나 멀리 가 버리면 그만 가르침
    if (cur) { if (doneWhen[cur]()) finish(); return; }
    const next = steps[S.step]; if (!next) { skipAll(); return; }
    begin(next);
  }
  function notify(k, n = 1) { counters[k] = (counters[k] || 0) + n; }
  function skipAll() { S.done = true; persist(); hide(); document.body.classList.remove('tut'); document.querySelectorAll('[data-tut]').forEach((el) => el.classList.add('tut-on')); }
  return { update, notify, skipAll, get active() { return !S.done; } };
}
