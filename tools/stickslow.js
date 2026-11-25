// 스틱을 조금만 당긴 걸음 검사 (#313): node tools/stickslow.js [csv폴더]  (먼저 node build.mjs)
// 폰에서 손가락 흉내(CDP 터치)로 떠다니는 스틱을 10%·20%·30%·100% 로 3초씩 당기며 손가락 떨림(±3px)을 섞는다.
// 프레임마다 스틱 크기·이동 속도·걷기 애니메이션(켜짐/꺼짐)을 적어, 걷기↔서기 바뀜 수·멈칫(속도가 0 가까이 떨어졌다 다시 오름) 수·속도 고름을 센다.
// 당긴 정도가 클수록 빨라야 하고(곡선), 당긴 동안 걷기 애니메이션이 한 번 켜진 뒤 꺼지지 않아야 한다. 폴더를 주면 frames-<당김>.csv 로 남김
const { chromium, devices } = require('playwright');
const fs = require('fs');
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
const OUT = process.argv[2] || '';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  const until = async (fn, ms, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await E(fn, arg).catch(() => false)) return true; await W(100); } return false; };
  await p.goto(URL); await until(() => !!window.__oreum?.ticks, 30000);
  await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1, fsTip: 1 }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((x) => localStorage.getItem(x)) || 'oreumoreum.dev'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await until(() => !!window.__oreum?.ticks, 30000); await p.click('#enter').catch(() => {}); await W(2500);
  if (await E(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(800); }
  if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) { await p.click('#fs-tip-x').catch(() => {}); await W(400); }
  await E(() => { window.__oreum.setTod(14); });
  const cdp = await ctx.newCDPSession(p);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const vw = await E(() => [innerWidth, innerHeight]);
  const R = await E(() => { const S = window.__oreum.stick.STICK; return Math.max(S.rMin, Math.min(S.rMax, Math.min(innerWidth, innerHeight) * S.rK)); });
  /* 프레임 기록: 실제 화면 그리기 틀마다 */
  await E(() => { const o = window.__oreum; o._rec = null; const f = () => { if (o._rec) { const j = o.joy, r = o.runner; o._rec.push([performance.now(), Math.hypot(j.x, j.y), o.player.speed, r.walking ? +r.walking() : +(o.player.speed > 0.1), o.player.pos.x, o.player.pos.z]); } requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const res = {};
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const pull of [0.1, 0.2, 0.3, 1]) {
    await W(600);
    const x = vw[0] * 0.25, y = vw[1] * 0.78, d = pull * R;
    await T('touchStart', [[x, y, 1]]); await W(40);
    for (let k = 1; k <= 3; k++) { await T('touchMove', [[x, y - d * k / 3, 1]]); await W(30); }
    await E(() => { window.__oreum._rec = []; });
    const t1 = Date.now();
    while (Date.now() - t1 < 3000) { const jx = (rnd() - 0.5) * 6, jy = (rnd() - 0.5) * 6; await T('touchMove', [[x + jx, y - d + jy, 1]]); await W(30); }
    const rec = await E(() => { const r = window.__oreum._rec; window.__oreum._rec = null; return r; });
    await T('touchEnd', []); await W(500);
    /* 셈: 첫 0.6초(오르는 동안)는 빼고 */
    const t0 = rec[0][0], body = rec.filter((r) => r[0] - t0 > 600);
    let flips = 0, dips = 0, low = false; for (let i = 1; i < body.length; i++) { if (body[i][3] !== body[i - 1][3]) flips++; }
    const sp = body.map((r) => r[2]), mean = sp.reduce((s, v) => s + v, 0) / sp.length;
    for (const v of sp) { if (!low && v < mean * 0.35) { low = true; dips++; } else if (low && v > mean * 0.7) low = false; }
    const sd = Math.sqrt(sp.reduce((s, v) => s + (v - mean) ** 2, 0) / sp.length);
    const dist = Math.hypot(rec[rec.length - 1][4] - rec[0][4], rec[rec.length - 1][5] - rec[0][5]);
    res[pull] = { flips, dips, mean, cv: mean > 0.01 ? sd / mean : 0, dist, frames: rec.length };
    console.log(`   당김 ${pull * 100 | 0}%: 프레임 ${rec.length}, 평균 속도 ${mean.toFixed(2)}m/s (흔들림 ${(res[pull].cv * 100).toFixed(0)}%), 걷기↔서기 바뀜 ${flips}, 멈칫 ${dips}, 간 거리 ${dist.toFixed(1)}m`);
    if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/frames-${pull * 100 | 0}.csv`, 'ms,stick,speed,walk,x,z\n' + rec.map((r) => [(r[0] - t0).toFixed(0), r[1].toFixed(3), r[2].toFixed(3), r[3], r[4].toFixed(2), r[5].toFixed(2)].join(',')).join('\n')); }
  }
  ok(res[0.1].mean < 0.05 || (res[0.1].flips === 0 && res[0.1].dips === 0), '10%(죽은 구역 근처): 서 있거나, 걷는다면 끊기지 않음');
  for (const k of [0.2, 0.3]) ok(res[k].flips === 0 && res[k].dips === 0 && res[k].cv < 0.25, `${k * 100}%: 걷기↔서기 바뀜 0·멈칫 0·속도 고름 (바뀜 ${res[k].flips}, 멈칫 ${res[k].dips}, 흔들림 ${(res[k].cv * 100).toFixed(0)}%)`);
  ok(res[0.2].mean > 0.1 && res[0.2].mean < res[0.3].mean && res[0.3].mean < res[1].mean, `당길수록 빨라짐 (${[0.2, 0.3, 1].map((k) => res[k].mean.toFixed(2)).join(' < ')})`);
  /* 죽은 구역 여유·곡선 (input.js joyShape), 서기↔걷기 여유 (runner walking) */
  const L = await E(() => {
    const o = window.__oreum, j = o.joy, sh = o.stick.joyShape; if (!sh) return null;
    const was = j.active; j.active = true; const on = [];
    for (const m of [0.2, 0.13, 0.17, 0.12, 0.16, 0.11, 0.09, 0.13, 0.14, 0.16]) { sh(m); on.push(+j.on); }
    const mag = [0.12, 0.2, 0.3, 0.6, 0.75, 1].map((m) => { sh(0.2); sh(m); return +j.mag.toFixed(3); });
    j.active = was; sh(0);
    const r = o.runner, w = []; for (const s of [0, 0.3, 0.15, 0.08, 0.2, 0.05, 0.2]) { r.animate(0.016, { speed: s, running: false, pose: 'move', t: 0, soft: true }); w.push(+r.walking()); }
    return { on: on.join(''), mag, w: w.join('') };
  });
  ok(L && L.on === '1111110001', `스틱 여유: 0.15 넘어 켜고 0.1 아래로 내려가야 끔 (${L && L.on})`);
  ok(L && L.mag.every((v, i) => i === 0 || i === 5 || v > L.mag[i - 1]) && L.mag[4] === 1 && L.mag[5] === 1, `당긴 만큼 속도 비율이 곡선으로 오름 (${L && L.mag.join(' ')})`);
  ok(L && L.w === '0111100', `걷기 애니메이션 여유: 0.25 넘어 켜고 0.06 아래로 끔, 꺼진 뒤 0.2 로는 안 켬 (${L && L.w})`);
  ok(errs === 0, '페이지 오류 0');
  await b.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
