// 레이저 과열 시간당 피해 (#200): node tools/heat.mjs
// 과열 없을 때와 견줘 몇 % 인지. 계속 쏘기(우두머리), 떼(1~3초 쏘고 0.3초 다음 대상 찾기), 등급 0~3. 이슈 값(가득 4초·과열 2.5초)과 지금 값을 같이
import { WEAPONS } from '../src/balance.js';
import { heatNew, heatStep, heatCanFire, heatMul } from '../src/laserheat.js';
const L = WEAPONS.find((w) => w.id === 'laser'), NOW = L.heat, ISSUE = { ...NOW, full: 4, lock: 2.5 };
function run(P, g, pattern, T = 600, dt = 1 / 60) {
  const H = heatNew(); let dmg = 0, t = 0, seg = 0, on = true, overs = 0, r = 1;
  while (t < T) {
    if (pattern === 'swarm') { seg -= dt; if (seg <= 0) { on = !on; r = (r * 9301 + 49297) % 233280; seg = on ? 1 + 2 * r / 233280 : 0.3; } } else on = true;
    const want = on, fire = want && heatCanFire(H);
    if (fire) dmg += L.dmg * heatMul(H, P) * dt;
    if (heatStep(H, dt, fire, P, g) === 'over') overs++;
    t += dt;
  }
  const base = pattern === 'swarm' ? null : L.dmg * T;
  return { dmg, overs, base };
}
const rows = [];
for (const [name, P] of [['이슈 값', ISSUE], ['지금 값', NOW]]) for (const pat of ['hold', 'swarm']) for (const g of [0, 3]) {
  const a = run(P, g, pat), b = run({ ...P, full: 1e9 }, g, pat);
  rows.push({ 값: name, 쏘기: pat === 'hold' ? '계속' : '떼(1~3초·0.3초 쉼)', 등급: g, '초당 피해': +(a.dmg / 600).toFixed(1), '과열 없을 때': +(b.dmg / 600).toFixed(1), '%': Math.round(a.dmg / b.dmg * 100), '과열 횟수(10분)': a.overs });
}
console.table(rows);
const mg = WEAPONS.find((w) => w.id === 'mg'), gun = WEAPONS.find((w) => w.id === 'gun'), bomb = WEAPONS.find((w) => w.id === 'bomb');
const lz = run(NOW, 0, 'hold').dmg / 600;
console.log('무기 순서(한 대상 초당): 총', +(gun.dmg / gun.cd).toFixed(1), '< 머신건', mg.dmg, '< 레이저(과열 포함)', +lz.toFixed(1), '< 폭탄', +(bomb.dmg / bomb.cd).toFixed(1), (gun.dmg / gun.cd < mg.dmg && mg.dmg < lz && lz < bomb.dmg / bomb.cd) ? '순서 그대로' : '순서 뒤집힘!');
// 계속 쏘기 → 과열 → 식음 → 다시 쏘기
const H = heatNew(); let t = 0, ev = [];
for (; t < 9; t += 0.05) { const f = heatCanFire(H); const e = heatStep(H, 0.05, f, NOW); if (e) ev.push(`${t.toFixed(2)}초 ${e}`); }
console.log('계속 누름:', ev.join(' → '));
