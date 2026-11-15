// 걸으면서 배우는 튜토리얼. 글 대신 그림 힌트, UI는 쓸 일이 생길 때 하나씩 나타남.
// 지점 좌표는 맵 설정(spots.tut)에서 받는다: gyul, hareubang, jump, cairn, speed, fork(없으면 speed 뒤에 끝)

const I = {
  keys: `<g fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3" stroke-linejoin="round"><rect x="40" y="10" width="30" height="30" rx="6"/><rect x="6" y="46" width="30" height="30" rx="6"/><rect x="40" y="46" width="30" height="30" rx="6"/><rect x="74" y="46" width="30" height="30" rx="6"/></g><g fill="#fff" font-family="Jua, sans-serif" font-size="17" text-anchor="middle"><text x="55" y="31">W</text><text x="21" y="67">A</text><text x="55" y="67">S</text><text x="89" y="67">D</text></g>`,
  joy: `<circle cx="55" cy="45" r="34" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/><circle class="bob-x" cx="55" cy="45" r="16" fill="#f6a53a" stroke="#fff" stroke-width="3"/>`,
  drag: `<path class="bob-x" d="M30 60 l0 -30 a6 6 0 0 1 12 0 l0 18 l4 -8 a6 6 0 0 1 11 3 l0 5 a6 6 0 0 1 11 2 l0 4 a6 6 0 0 1 10 4 l-2 22 q-2 12 -14 12 h-20 q-10 0 -14 -9z" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M14 22 h-8 M104 22 h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M8 22 l6 -5 M8 22 l6 5 M110 22 l-6 -5 M110 22 l-6 5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  gyul: `<circle cx="55" cy="60" r="18" fill="#f6a53a" stroke="#fff" stroke-width="3"/><path d="M55 42 q4 -8 12 -7" fill="none" stroke="#7fae5a" stroke-width="4" stroke-linecap="round"/><path class="bob-y" d="M55 8 v18 M47 20 l8 8 8 -8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  throw: `<path d="M18 70 q30 -60 70 -40" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 5"/><circle class="bob-x" cx="22" cy="68" r="9" fill="#f6a53a" stroke="#fff" stroke-width="3"/><rect x="80" y="30" width="22" height="46" rx="9" fill="#6f6a62" stroke="#fff" stroke-width="3"/><rect x="76" y="22" width="30" height="12" rx="4" fill="#5a554d" stroke="#fff" stroke-width="3"/><circle cx="87" cy="46" r="2.5" fill="#fff"/><circle cx="95" cy="46" r="2.5" fill="#fff"/>`,
  jump: `<path d="M8 70 q24 -10 48 0 q24 10 48 0" fill="none" stroke="#79b0c6" stroke-width="5" stroke-linecap="round"/><g class="bob-y"><circle cx="55" cy="22" r="7" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3"/><path d="M55 29 v14 M45 36 l10 -4 10 4 M55 43 l-8 14 M55 43 l8 14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  stone: `<ellipse cx="55" cy="72" rx="26" ry="9" fill="#b9b3a6" stroke="#fff" stroke-width="3"/><ellipse cx="55" cy="58" rx="19" ry="7" fill="#cfc9bc" stroke="#fff" stroke-width="3"/><ellipse cx="55" cy="46" rx="13" ry="5.5" fill="#b9b3a6" stroke="#fff" stroke-width="3"/><ellipse class="bob-y" cx="55" cy="26" rx="9" ry="5" fill="#cfc9bc" stroke="#fff" stroke-width="3"/>`,
  speed: `<circle cx="66" cy="18" r="7" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="3"/><path d="M30 76 l14 -20 12 8 4 -22 16 10 h12 M42 42 l10 -14 16 6 8 12 M16 50 h12 M8 62 h16 M20 38 h10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  fork: `<rect x="51" y="30" width="8" height="48" fill="#8a6a48" stroke="#fff" stroke-width="3"/><path d="M10 22 l10 -10 h32 v20 h-32z" fill="#efe3c2" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M100 36 l-10 -10 h-32 v20 h32z" fill="#efe3c2" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M26 28 q6 -12 12 0" fill="#7fae5a"/><path d="M70 42 l6 -12 6 12z" fill="#8fa3b6"/>`,
};
const svg = (inner) => `<svg viewBox="0 0 110 85" aria-hidden="true">${inner}</svg>`;

export function createTutorial({ save, persist, player, cam, isTouch, pts }) {
  const S = (save.tut ||= { step: 0, done: false });
  const steps = ['move', 'look', 'gyul', 'throw', 'jump', 'interact', 'speed', 'fork'];
  if (!pts) return { update() {}, notify() {}, skipAll() {}, active: false };
  const card = document.createElement('div'); card.id = 'tut-hint'; card.hidden = true; document.body.append(card);
  let cur = null, timer = 0, startPos = null, startYaw = null, coins0 = null, counters = { hareubang: 0, jump: 0, stone: 0, gait: 0, pickup: 0 };
  const P = pts; let origin = null;
  const at = (q, r) => near(q[0], q[1], r);
  const near = (x, z, r) => Math.hypot(player.pos.x - x, player.pos.z - z) < r;
  const show = (icon, pos) => { card.innerHTML = svg(I[icon]); card.className = 'pos-' + pos; card.hidden = false; };
  const hide = () => { card.hidden = true; };
  const unlock = (name) => { document.querySelectorAll(`[data-tut="${name}"]`).forEach((el) => { el.classList.add('tut-on'); el.classList.add('tut-pop'); setTimeout(() => el.classList.remove('tut-pop'), 900); }); };
  const begin = (name) => {
    cur = name; timer = 0; startPos = player.pos.clone(); startYaw = cam.yaw; coins0 = save.coins;
    if (name === 'move') { unlock('move'); show(isTouch ? 'joy' : 'keys', isTouch ? 'left' : 'center'); }
    if (name === 'look') show('drag', 'center');
    if (name === 'gyul') { unlock('gyul'); show('gyul', 'center'); }
    if (name === 'throw') { unlock('throw'); show('throw', 'right'); }
    if (name === 'jump') { unlock('jump'); show('jump', 'right'); }
    if (name === 'interact') { unlock('interact'); show('stone', 'right'); }
    if (name === 'speed') { unlock('speed'); show('speed', 'right'); }
    if (name === 'fork') show('fork', 'center');
  };
  const finish = () => { hide(); const i = steps.indexOf(cur); S.step = i + 1; persist(); cur = null; };
  // 각 단계의 시작 조건 / 완료 조건
  const startWhen = {
    move: () => true,
    look: () => true,
    gyul: () => at(P.gyul, 9),
    throw: () => at(P.hareubang, 9),
    jump: () => at(P.jump, 7),
    interact: () => at(P.cairn, 9),
    speed: () => at(P.speed, 8),
    fork: () => !P.fork || at(P.fork, 6),
  };
  // 해 보지 않고 지나쳐도 다음 지점에 닿으면 넘어감
  const doneWhen = {
    move: () => startPos.distanceTo(player.pos) > 5,
    look: () => Math.abs(cam.yaw - startYaw) > 0.5 || timer > 9,
    gyul: () => save.coins > coins0 || counters.pickup > 0,
    throw: () => counters.hareubang > 0 || timer > 25 || at(P.jump, 7),
    jump: () => counters.jump > 0 || at(P.cairn, 8),
    interact: () => counters.stone > 0 || at(P.speed, 6),
    speed: () => counters.gait > 0 || timer > 12,
    fork: () => false,
  };
  function update(dt) {
    if (S.done) return;
    timer += dt;
    origin ||= player.pos.clone();
    if (P.giveUp && origin.distanceTo(player.pos) > P.giveUp) { skipAll(); return; } // 길을 벗어나 멀리 가 버리면 그만 가르침
    if (cur) { if (doneWhen[cur]()) finish(); return; }
    const next = steps[S.step]; if (!next || (next === 'fork' && !P.fork)) { skipAll(); return; }
    if (startWhen[next]()) begin(next);
  }
  function notify(k) { counters[k] = (counters[k] || 0) + 1; }
  function skipAll() { S.done = true; persist(); hide(); document.querySelectorAll('[data-tut]').forEach((el) => el.classList.add('tut-on')); }
  return { update, notify, skipAll, get active() { return !S.done; } };
}
