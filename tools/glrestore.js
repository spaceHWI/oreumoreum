// WebGL 잃음 되살리기 검사 (#304): node tools/glrestore.js $PWD [d|m]   (먼저 node build.mjs)
// 1. 잃었다 되살아남(WEBGL_lose_context): '화면을 다시 불러오는 중…' 한 줄 → 되살아나면 감추고 계속 그림. 기기 기억 aaOff, 자동 단계면 한 칸 내림, '[gl 되살아남]' 알림
// 2. 짧은 사이 또 잃고 돌아오지 않음: CRASH.glWait 뒤 저장하고 한 번 스스로 다시 불러옴(reloadFor 'gl' auto). 다시 연 뒤 단계가 낮아지고 '[gl 다시 불러옴]' 알림, 오류 글에 '켠Ns q단계'
// 3. 같은 탭에서 또 잃고 돌아오지 않음: 다시 불러오지 않고 '다시 불러오기' 단추 (되풀이 없음, #287)
// 4. 나눠 받기 계획: 폰은 하나씩(par 1), PC 는 두 개씩
const { chromium, devices } = require('playwright');
const DIR = process.argv[2] || process.cwd(), MODE = process.argv[3] === 'm' ? 'm' : 'd';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) { fails++; process.exitCode = 1; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(MODE === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 960, height: 600 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await p.addInitScript(() => {
    window.__posts = []; const f = window.fetch; window.fetch = function (u, o) { try { if (/feedback/.test(String(u))) window.__posts.push(String(o && o.body || '')); } catch (e) { /* 무시 */ } return f.apply(this, arguments); };
  });
  let navs = 0; p.on('framenavigated', (fr) => { if (fr === p.mainFrame()) navs++; });
  const URL0 = 'file://' + DIR + '/dist/test.html#namsongi';
  await p.goto(URL0); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer, null, { timeout: 60000 }); await sleep(3000);
  await p.click('#enter').catch(() => {}); await sleep(4000);
  const s0 = await p.evaluate(() => { const o = window.__oreum; return { tier: o.quality.tier, level: o.quality.level, auto: o.quality.auto, plan: o.gl.plan(), start: { ...o.gl.start } }; });
  console.log('시작', JSON.stringify(s0));
  ok(MODE === 'm' || s0.tier === 0 ? s0.plan.par === 1 && s0.plan.delay > 0 : s0.plan.par === 2, '나눠 받기 계획 ' + JSON.stringify(s0.plan));
  ok(!s0.start.drop && !s0.start.aaOff, '처음엔 낮춤 없음');

  // 1. 잃었다 되살아남
  const r1 = await p.evaluate(async () => {
    const o = window.__oreum, gl = o.renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context'), out = {};
    window.__ext = ext; ext.loseContext(); await new Promise((r) => setTimeout(r, 600));
    out.shown = !document.getElementById('gl-lost').hidden; out.text = document.getElementById('gl-lost-t').textContent; out.btn = !document.getElementById('gl-reload').hidden;
    ext.restoreContext(); await new Promise((r) => setTimeout(r, 1000)); const f0 = o.renderer.info.render.frame; await new Promise((r) => setTimeout(r, 2000)); /* three 가 되살릴 때 info 를 새로 만듦 */
    out.hidden = document.getElementById('gl-lost').hidden; out.frames = o.renderer.info.render.frame - f0; out.level = o.quality.level;
    out.mem = JSON.parse(localStorage.getItem('oreumoreum.gl') || 'null'); out.info = { ...o.gl.info };
    return out;
  });
  console.log('1', JSON.stringify(r1));
  ok(r1.shown && r1.text === '화면을 다시 불러오는 중…' && !r1.btn, '잃으면 한 줄 안내 (단추 없음)');
  ok(r1.hidden && r1.frames > 5, '되살아나면 감추고 계속 그림 (' + r1.frames + ' 프레임)');
  ok(r1.mem && r1.mem.aaOff === 1 && r1.mem.drop === 0, '기기 기억: aaOff, 아직 낮춤 없음');
  ok(!s0.auto || s0.level === 0 || r1.level === s0.level - 1, '자동 단계면 되살아난 뒤 한 칸 내림 ' + s0.level + '→' + r1.level);
  ok(r1.info.lost === 1 && r1.info.restored === 1, '이번 실행 잃음 1·되살아남 1');
  await sleep(1500);
  const posts1 = await p.evaluate(() => window.__posts.join('\n') + '\n' + Object.keys(localStorage).filter((k) => /\.fb$/.test(k)).map((k) => localStorage.getItem(k)).join('\n'));
  ok(/gl 되살아남/.test(posts1), "'[gl 되살아남]' 알림");
  ok(/켠\d+s q\d/.test(posts1), "오류 글에 '켠Ns q단계'");

  // 2. 짧은 사이 또 잃고 돌아오지 않음 → 한 번 스스로 다시 불러옴
  const navs0 = navs;
  await p.evaluate(() => { window.__ext.loseContext(); });
  await sleep(1000);
  const mid = await p.evaluate(() => JSON.parse(localStorage.getItem('oreumoreum.gl') || 'null'));
  ok(mid && mid.drop === 1, '짧은 사이 두 번 잃음 → 한 칸 낮춤 기억 (' + (mid && mid.drop) + ')');
  await p.waitForEvent('load', { timeout: 15000 }).catch(() => {});
  ok(navs > navs0, '돌아오지 않으면 스스로 다시 불러옴');
  await p.waitForFunction(() => window.__oreum && window.__oreum.renderer, null, { timeout: 60000 }); await sleep(3000);
  const s2 = await p.evaluate(() => { const o = window.__oreum; return { tier: o.quality.tier, start: { ...o.gl.start }, reloads: JSON.parse(sessionStorage.getItem('oreumoreum.reloads') || '[]') }; });
  console.log('2', JSON.stringify(s2));
  ok(s2.start.drop === 2 && s2.start.aaOff === 1, '다시 연 뒤 낮춤 2·AA 끔 기억');
  ok(s2.tier === Math.max(0, s0.tier - 2), '단계가 낮아짐 ' + s0.tier + '→' + s2.tier);
  ok(s2.reloads.filter((r) => r.why === 'gl' && r.auto).length === 1, "새로고침 까닭 'gl' auto 한 번");
  await p.click('#enter').catch(() => {}); await sleep(3000);
  const posts2 = await p.evaluate(() => window.__posts.join('\n') + '\n' + Object.keys(localStorage).filter((k) => /\.fb$/.test(k)).map((k) => localStorage.getItem(k)).join('\n'));
  ok(/gl 다시 불러옴/.test(posts2), "다음 시작에 '[gl 다시 불러옴]' 알림");

  // 3. 같은 탭에서 또 → 다시 불러오지 않고 단추
  const navs1 = navs;
  await p.evaluate(() => { const gl = window.__oreum.renderer.getContext(); window.__ext = gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
  await sleep(8000);
  const r3 = await p.evaluate(() => ({ text: document.getElementById('gl-lost-t').textContent, btn: !document.getElementById('gl-reload').hidden }));
  ok(navs === navs1, '같은 탭에서 두 번째는 스스로 다시 불러오지 않음');
  ok(r3.btn && /되살리지 못했어요/.test(r3.text), "'다시 불러오기' 단추");
  await p.evaluate(() => window.__ext.restoreContext()); await sleep(2000);
  ok(await p.evaluate(() => document.getElementById('gl-lost').hidden), '늦게라도 되살아나면 감춤');
  const bad = errs.filter((e) => !/webgl|context/i.test(e));
  ok(!bad.length, '페이지 오류 없음 ' + bad.join(' | '));
  console.log(fails ? `FAIL ${fails}` : '모두 통과');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
