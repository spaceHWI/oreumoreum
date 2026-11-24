// 폰 발열 재기 (#271): node tools/perfrun.js [--base <git ref>] [--dist <폴더>] [--sec 20] [--scen field,idle,street,arena]
// 폰 화면(390×844, 배율 3, 터치)·보통 단계(?tier=1, 흔한 폰)로 dist/test.html 을 열고 장면마다 --sec 초 동안 잰다:
//   그린 프레임 수, 그리는 수(draw call 평균), 그린 픽셀 수(그리기 버퍼 폭×높이 합), 그림자 지도 다시 그린 수와 그 픽셀(지도 크기²)
//   '일' = 화면 픽셀 + 그림자 지도 픽셀. 목표 비교는 '일' 로 한다 (그림자 지도도 폰 GPU 가 그리는 픽셀)
//   안티에일리어싱(MSAA)의 샘플은 '일' 에 넣지 않는다 (#276: 폰도 켬, PERF.aaPhone). 켜졌는지는 줄 끝 'AA' 로 따로 적는다
// 소프트웨어 GL 은 1초에 10프레임 남짓이라 그대로는 상한(30)이 보이지 않는다. 그래서 Playwright 가짜 시계(page.clock)로
//   60Hz rAF 를 흉내 내 '기기가 따라가 준다면' 몇 번 그리는지를 센다 (가짜 1초 = rAF 60번. 실제로는 더 오래 걸림)
// 장면: fire 숙소 마당 불멍(밤, 앉아서, #290) · field 들판을 W 누른 채 걷기(1초마다 방향 바꿈·포인터 움직임) · idle 들판에 서서 입력 없음 · street 가게 거리 걷기 · arena 서바이벌 판(구역 1)
// --base <ref>: 그 커밋을 임시 폴더에 받아 빌드해 '앞' 으로 같이 재고 앞·뒤 표를 냄 (예: --base origin/dev). 열은 못 재니 '그린 픽셀 수' 를 일의 양으로 본다
// 목표 (#271): 폰 기본 설정에서 초당 그린 픽셀 수가 앞의 절반 아래
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const SEC = +opt('--sec', 20), SCEN = opt('--scen', 'field,idle,street,arena').split(','), BASE = opt('--base', null);

function buildBase(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perfrun-'));
  execSync(`git worktree add --detach ${dir} ${ref}`, { stdio: 'ignore' });
  fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(dir, 'node_modules'));
  execSync('node build.mjs', { cwd: dir, stdio: 'ignore' });
  return { dist: path.join(dir, 'dist'), done: () => { try { execSync(`git worktree remove --force ${dir}`, { stdio: 'ignore' }); } catch (e) { /* 남아도 됨 */ } } };
}

async function measure(b, dist, scen) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  const url = 'file://' + path.join(dist, 'test.html') + '?tier=1&aa=1#namsongi' /* file:// 는 기본 AA 끔 (#286): 재기는 실제처럼 켜고 */;
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 180000 });
  await p.clock.install(); await p.clock.resume(); /* 가짜 시계를 처음부터 (흐르는 채로): 재기 시작 때 performance.now 가 뒤로 가지 않게 (앞 빌드는 뒤로 가면 dt 가 음수) */
  await p.goto(url); await ready();
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await ready();
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(2500);
  await p.evaluate((scen) => {
    const o = window.__oreum; document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
    o.setTod(13); o.setWeather('clear'); o.pace?.pacing && (o.pace.pacing.test.first.done = true);
    if (scen === 'street') o.street?.go(0, 20); else if (scen === 'arena') { o.swarm?.start(1); } else if (scen === 'fire') { o.shopGate?.open?.('inn'); o.setTod(21); if (o.fire) { o.fire.go(); o.fire.sit(); } else o.street?.go(0, 58); } /* #290 숙소 마당 불멍: 밤에 앉아 불을 봄 (예전 판은 숙소 앞) */ else o.tp(-60, 40, Math.PI / 2);
    if (o.hp) { o.hp.max = 1e6; o.hp.hp = 1e6; }
    const r = o.renderer, sm = r.shadowMap, r0 = sm.render; window.__pr = { sh: 0, spx: 0, px: 0, calls: 0, n: 0 };
    sm.render = function (...a) { if (sm.enabled && (sm.autoUpdate || sm.needsUpdate) && a[0]?.length) { window.__pr.sh++; for (const l of a[0]) if (l.castShadow) window.__pr.spx += l.shadow.mapSize.x * l.shadow.mapSize.y; } return r0.apply(this, a); };
    const r1 = r.render.bind(r); r.render = (s, c) => { const res = r1(s, c); if (!c || c.isPerspectiveCamera) { const P = window.__pr, cv = r.domElement; P.px += cv.width * cv.height; P.calls += r.info.render.calls; P.n++; } return res; };
  }, scen);
  await p.mouse.move(200, 400);
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 3000));
  const f0 = await p.evaluate(() => { window.__pr.sh = window.__pr.spx = window.__pr.px = window.__pr.calls = window.__pr.n = 0; return window.__oreum.renderer.info.render.frame; });
  const walk = scen !== 'idle';
  if (walk) await p.keyboard.down('KeyW');
  const t0 = Date.now();
  for (let s = 0; s < SEC; s++) {
    if (walk) { await p.mouse.move(200 + (s % 2) * 30, 400); await p.evaluate((s) => { const o = window.__oreum; o.player.heading += (s % 4 < 2 ? 0.6 : -0.6); if (o.swarm?.picking?.()) o.swarm.pick(0); }, s); }
    await p.clock.runFor(1000);
  }
  if (walk) await p.keyboard.up('KeyW');
  const r = await p.evaluate((f0) => { const o = window.__oreum, P = window.__pr; return { frames: o.renderer.info.render.frame - f0, px: P.px, spx: P.spx, calls: P.n ? P.calls / P.n : 0, sh: P.sh, pr: o.quality.pr, cap: o.fps?.state?.().cap ?? null, mode: o.fps?.state?.().mode ?? '', aa: !!o.renderer.getContext().getContextAttributes()?.antialias }; }, f0);
  r.real = Math.round((Date.now() - t0) / 1000); r.errs = errs.length;
  await p.close(); return r;
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const runs = [['뒤', path.join(process.cwd(), 'dist')]]; let base = null;
  if (BASE) { process.stdout.write(`앞(${BASE}) 빌드 중… `); base = buildBase(BASE); runs.unshift(['앞', base.dist]); console.log('끝'); }
  else if (opt('--dist', null)) runs.unshift(['앞', path.resolve(opt('--dist'))]);
  const res = {};
  for (const scen of SCEN) for (const [tag, dist] of runs) {
    const r = await measure(b, dist, scen); (res[scen] ||= {})[tag] = r;
    console.log(`${scen} ${tag}: 프레임 ${r.frames} (${(r.frames / SEC).toFixed(1)}/s, 상한 ${r.cap ?? '-'} ${r.mode}) · 그리기 ${r.calls.toFixed(0)} · 픽셀 ${(r.px / SEC / 1e6).toFixed(1)}M/s · 그림자 ${r.sh}번 ${(r.spx / SEC / 1e6).toFixed(1)}M/s · 배율 ${r.pr} · AA ${r.aa ? '켬' : '끔'} · 실제 ${r.real}초${r.errs ? ' · 오류 ' + r.errs : ''}`);
  }
  await b.close(); base?.done();
  const rows = []; let bad = 0;
  for (const scen of SCEN) {
    const A = res[scen]['앞'], B = res[scen]['뒤'];
    const row = { 장면: scen, '프레임/s 뒤': +(B.frames / SEC).toFixed(1), '그리기 뒤': Math.round(B.calls), '픽셀 M/s 뒤': +(B.px / SEC / 1e6).toFixed(1), '그림자/s 뒤': +(B.sh / SEC).toFixed(1), '일 M/s 뒤': +((B.px + B.spx) / SEC / 1e6).toFixed(1) };
    if (A) Object.assign(row, { '프레임/s 앞': +(A.frames / SEC).toFixed(1), '픽셀 M/s 앞': +(A.px / SEC / 1e6).toFixed(1), '그림자/s 앞': +(A.sh / SEC).toFixed(1), '일 M/s 앞': +((A.px + A.spx) / SEC / 1e6).toFixed(1), '일 뒤/앞': +((B.px + B.spx) / ((A.px + A.spx) || 1)).toFixed(2) });
    if (A && (B.px + B.spx) / ((A.px + A.spx) || 1) >= 0.5) bad++;
    if (B.errs) bad++;
    rows.push(row);
  }
  console.table(rows);
  if (BASE || opt('--dist', null)) console.log(bad ? `목표(픽셀 절반 아래) 못 미친 장면 ${bad}` : '모든 장면 픽셀 절반 아래');
  process.exit(bad && (BASE || opt('--dist', null)) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
