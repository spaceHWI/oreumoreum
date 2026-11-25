// 정상 물건 자리 (#308): node build.mjs && node tools/summitmap.js [출력=notes/shots/308] [이름표=after] [R=30]
// - 표지석 둘레 R m 안의 상호작용 자리(이름·표지석 기준 out/tan m)를 적고, 서로 너무 가까운 쌍(폰에서 누르는 범위 겹침)을 FAIL 로 알림
// - 금고(관리 초소)가 정상(표지석 SUMMIT_R m 안)에 없는지
// - 그림: 정상을 위에서 본 것(top), 걸어 올라와서 앞(walk)·뒤(back), 관리 초소(hut)·능선 길목 하르방(hare) → <출력>/<이름표>-*.jpg
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'notes/shots/308', TAG = process.argv[3] || 'after', R = +(process.argv[4] || 30);
const SUMMIT_R = 16;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 720, height: 540 } }); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html?aa=1#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  if (await E(() => !document.getElementById('look')?.hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await W(1000); }
  await E(() => { const o = window.__oreum; o.tut?.skipAll?.(); o.setTod?.(14); o.setWeather?.('clear'); o.pace?.test?.hold?.(); });
  await W(2500);
  const inv = await E((R) => {
    const o = window.__oreum, S = o.spots.photo.stone, out = o.spots.photo.out, tan = { x: -out.z, z: out.x };
    const rel = (q) => ({ o: +((q.x - S.x) * out.x + (q.z - S.z) * out.z).toFixed(1), t: +((q.x - S.x) * tan.x + (q.z - S.z) * tan.z).toFixed(1), d: +Math.hypot(q.x - S.x, q.z - S.z).toFixed(1) });
    const items = [];
    for (const it of o.interactables || []) { const q = it.pos; if (!q || !isFinite(q.x)) continue; const r = rel(q); if (r.d < R) items.push({ k: 'act', name: (typeof it.label === 'function' ? it.label() : it.label) || it.ic || '?', r: it.r || 0, x: q.x, z: q.z, ...r }); }
    for (const c of o.cairns || []) { const q = c.pos; if (q) { const r = rel(q); if (r.d < R) items.push({ k: 'cairn', name: c.name || c.id, r: 2.4, x: q.x, z: q.z, ...r }); } }
    for (const h of o.spots.hareubangs || []) { const r = rel(h.pos); if (r.d < R) items.push({ k: 'hareubang', name: '하르방', r: 1.2, x: h.pos.x, z: h.pos.z, ...r }); }
    const sp = o.summit?.spots?.(); if (sp?.scope) { const q = { x: sp.scope[0], z: sp.scope[2] }; items.push({ k: 'scope', name: '망원경', r: 0, x: q.x, z: q.z, ...rel(q) }); }
    if (sp?.note) { const q = { x: sp.note[0], z: sp.note[2] }; items.push({ k: 'note', name: '쪽지', r: 0, x: q.x, z: q.z, ...rel(q) }); }
    const safe = o.myst?.state?.().hut; if (safe) items.push({ k: 'safe', name: '금고(관리 초소)', r: 0, x: safe.x, z: safe.z, ...rel(safe) });
    return { stone: [S.x, S.z], items: items.sort((a, b) => a.d - b.d) };
  }, R);
  console.log('표지석', inv.stone.map((v) => v.toFixed(1)).join(','));
  console.log('종류       이름                       out    tan    거리  누르는 범위');
  for (const it of inv.items) console.log(`${it.k.padEnd(10)} ${String(it.name).slice(0, 22).padEnd(24)} ${String(it.o).padStart(6)} ${String(it.t).padStart(6)} ${String(it.d).padStart(6)}  ${it.r}`);
  /* 누르는 범위 겹침: 상호작용 둘이 서로 (작은 쪽 범위)보다 가깝거나 1.5 m 안이면 */
  const acts = inv.items.filter((i) => i.r > 0);
  const seen = new Set();
  for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) {
    const a = acts[i], c = acts[j]; if (a.name === c.name) continue;
    const key = [a.name, c.name].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    const d = Math.hypot(a.x - c.x, a.z - c.z), need = Math.max(3, Math.min(a.r, c.r));
    if (d < 0.1 && (a.k === 'cairn' || c.k === 'cairn')) continue; /* 돌탑 상호작용과 돌탑 자체 */
    if (a.d < SUMMIT_R + 4 && c.d < SUMMIT_R + 4) ok(d >= need, `${a.name} ↔ ${c.name} ${d.toFixed(1)} m (≥ ${need})`);
  }
  const safe = inv.items.find((i) => i.k === 'safe');
  const safeAll = await E(() => { const o = window.__oreum, s = o.myst?.state?.().hut, S = o.spots.photo.stone; return s ? Math.hypot(s.x - S.x, s.z - S.z) : null; });
  ok(safeAll == null || safeAll > SUMMIT_R, `금고는 정상(표지석 ${SUMMIT_R} m) 밖 (${safeAll == null ? '없음' : safeAll.toFixed(1) + ' m'})`);
  void safe;
  /* 그림 */
  await E(() => { let st = document.getElementById('__ms'); if (!st) { st = document.createElement('style'); st.id = '__ms'; document.head.append(st); } st.textContent = 'body > *:not(#view){visibility:hidden!important} #view{visibility:visible!important}'; });
  const camAt = (x, y, z, tx, ty, tz) => E(([x, y, z, tx, ty, tz]) => { const o = window.__oreum; o.cam.mode = 'free'; o.camObj.position.set(x, y, z); o.camObj.lookAt(tx, ty, tz); }, [x, y, z, tx, ty, tz]);
  const g = await E(() => { const o = window.__oreum, S = o.spots.photo.stone, out = o.spots.photo.out; return { x: S.x, z: S.z, y: o.groundAt(S.x, S.z), ox: out.x, oz: out.z }; });
  await E(([x, z]) => { const o = window.__oreum; o.player.pos.set(x, o.groundAt(x, z), z); o.player.target = null; o.snap?.(); }, [g.x - g.ox * 3, g.z - g.oz * 3]);
  await W(1500);
  const sh = async (n) => { await p.screenshot({ path: path.join(OUT, `${TAG}-${n}.jpg`), type: 'jpeg', quality: 60, timeout: 150000 }); console.log('그림', path.join(OUT, `${TAG}-${n}.jpg`)); };
  await camAt(g.x + g.ox * 2, g.y + 42, g.z + g.oz * 2 + 0.01, g.x - g.ox * 1, g.y, g.z - g.oz * 1); await W(2500); await sh('top');
  /* 걸어 올라오는 쪽(바깥 out 쪽 아래)에서 표지석과 굼부리 쪽을 봄 */
  await camAt(g.x + g.ox * 16, g.y + 4, g.z + g.oz * 16, g.x - g.ox * 6, g.y + 0.5, g.z - g.oz * 6); await W(2500); await sh('walk');
  await camAt(g.x - g.ox * 14, g.y + 5, g.z - g.oz * 14, g.x + g.ox * 2, g.y + 0.5, g.z + g.oz * 2); await W(2500); await sh('back');
  /* 옮긴 것: 관리 초소(금고)·능선 길목 하르방 */
  const hut = await E(() => window.__oreum.myst?.state?.().hut);
  if (hut) { const y = await E(([x, z]) => window.__oreum.groundAt(x, z), [hut.x, hut.z]); await camAt(hut.x + hut.fx * 9 + hut.fz * 4, y + 3.5, hut.z + hut.fz * 9 - hut.fx * 4, hut.x, y + 1, hut.z); await W(2500); await sh('hut'); }
  const hb = await E(() => { const o = window.__oreum, S = o.spots.photo.stone; const h = o.life.hareubangs.map((q) => q.pos).sort((a, c) => Math.hypot(a.x - S.x, a.z - S.z) - Math.hypot(c.x - S.x, c.z - S.z))[0]; return h && { x: h.x, z: h.z, y: o.groundAt(h.x, h.z), sx: S.x, sz: S.z }; });
  if (hb) { await camAt(hb.x + (hb.x - hb.sx) * 0.5, hb.y + 4, hb.z + (hb.z - hb.sz) * 0.5, hb.sx, hb.y, hb.sz); await W(2500); await sh('hare'); }
  ok(!errs, '페이지 오류 없음');
  await b.close();
  console.log(fails ? `FAIL ${fails}` : '모두 통과');
  process.exit(fails ? 1 : 0);
})();
