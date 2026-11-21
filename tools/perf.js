// 성능 재기 (#79): node tools/perf.js [phone|desk|all] [시나리오,...] [--out 파일.json]
// 헤드리스 크롬(swiftshader 소프트웨어 GL)으로 dist/index.html(PERF_PAGE 로 바꿈) 을 GitHub Pages 처럼 서버에 올려 열고, 정해진 길을 걸으며 잰다.
//  - phone: 390×844(폰 UA → 게임이 LOW), CPU 4배 느리게, 첫 화면은 4G(9Mbps·RTT 170ms) 조건
//  - desk: 1440×900, CPU 그대로
// 재는 것: 프레임 시간(평균·1% 낮은 값 fps), draw call·삼각형(최대·평균), renderer.info 텍스처·지오메트리 수, JS 힙, 첫 화면 시간, 내려받는 크기
// 주의: 소프트웨어 GL 이라 fps 는 실제 GPU 보다 훨씬 낮게 나온다. 전·후 비교용으로 쓰고, draw call·삼각형·메모리는 그대로 믿어도 된다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');

const args = process.argv.slice(2);
const outI = args.indexOf('--out'); const OUT = outI >= 0 ? args.splice(outI, 2)[1] : null;
const which = args[0] || 'all';
const SCEN_ALL = ['day', 'night', 'rain', 'clean', 'battle', 'crowd'];
const SCEN = args[1] ? args[1].split(',') : SCEN_ALL;
const STATION_T = +(process.env.PERF_T || 3.5); // 길목마다 재는 시간(초)
const CROWD = +(process.env.PERF_CROWD || 30); // crowd 시나리오 인원 (#7 부하 재기)

// 정적 서버 (GitHub Pages 처럼 html·js 만 gzip 으로 보냄. 모델 .bin 은 그대로, #85)
const ROOT = path.join(process.cwd(), 'dist');
const sizes = {};
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const raw = fs.readFileSync(f), text = /\.(html|js|json)$/.test(f), gz = text ? zlib.gzipSync(raw, { level: 9 }) : raw;
  const type = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript; charset=utf-8' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream';
  sizes[req.url] = { raw: raw.length, gz: gz.length };
  res.writeHead(200, { 'content-type': type, ...(text ? { 'content-encoding': 'gzip' } : {}), 'content-length': gz.length, 'cache-control': 'no-store' });
  res.end(gz);
});

const PROFILES = {
  phone: { tier: 1, cores: 6, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', cpu: 4, net: { offline: false, latency: 170, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 } },
  desk: { tier: 2, cores: 8, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, net: null },
};

const fmt = (v, d = 0) => (v == null ? '-' : Number(v).toFixed(d));

// 페이지 안: 길목·조작 도우미를 심는다
const HELPERS = () => {
  const o = window.__oreum;
  const P = o.player;
  const st = [];
  const at = (name, x, z) => st.push({ name, x, z });
  at('들머리', o.spots.start.x, o.spots.start.z);
  const lot = o.street?.layout?.lot(1); if (lot) at('가게 거리', lot.front.x, lot.front.z);
  if (o.jeong?.center) at('정낭', o.jeong.center.x, o.jeong.center.z);
  const minis = o.cleanhouse?.minis?.() || [];
  const m = (id) => minis.find((c) => c.id === id);
  if (m('skirt')) at('자락', m('skirt').fx, m('skirt').fz);
  if (m('rest')) at('능선', m('rest').fx, m('rest').fz);
  if (m('crater')) at('굼부리', m('crater').fx, m('crater').fz);
  const s = o.spots.photo?.stone; if (s) at('정상', s.x, s.z);
  window.__perf = { st, drive: null };
  // 매 프레임: 다음 길목 쪽으로 걸어감(위치를 직접 옮김) + 프레임 시간·draw call 기록
  const rec = { dts: [], calls: [], tris: [], cpu: [], on: false };
  window.__perf.rec = rec;
  let last = performance.now();
  const tick = (now) => {
    const dt = (now - last) / 1000; last = now;
    const d = window.__perf.drive;
    if (d) {
      const dx = d.tx - P.pos.x, dz = d.tz - P.pos.z, L = Math.hypot(dx, dz);
      if (L > 0.5) { const k = Math.min(L, d.speed * Math.min(dt, 0.1)) / L; const x = P.pos.x + dx * k, z = P.pos.z + dz * k; P.pos.set(x, o.groundAt(x, z), z); P.visY = P.pos.y; P.heading = Math.atan2(dx, dz); o.cam.yaw = P.heading + Math.PI; }
    }
    const cpu = window.__cpuAcc; window.__cpuAcc = 0;
    if (rec.on) { rec.dts.push(dt); rec.cpu.push(cpu); const i = o.renderer.info.render; rec.calls.push(i.calls); rec.tris.push(i.triangles); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return st.map((s) => s.name);
};

const PAGE = process.env.PERF_PAGE || 'index.html';
const pageUrl = (prof) => `http://127.0.0.1:${server.address().port}/${PAGE}?${(process.env['PERF_QS_' + prof.key] ?? process.env.PERF_QS) ?? `tier=${prof.tier}&perf`}#namsongi`;
async function setup(p, prof) {
  // 처음 온 사람 → 서버 고르기·캐릭터 고르기를 지나 튜토리얼 끝낸 상태로 저장하고 다시 엶
  await p.evaluate(() => { const o = window.__oreum; o.save.server = 'clean'; o.save.entered = 1; o.save.look = { sex: 'm', skin: 0 }; o.save.hairs = o.save.hairs || {}; o.save.tut = { step: 99, done: true, v: 3 }; o.save.jeong = 1; o.save.soundOff = 1; o.save.tipsSeen = o.save.tipsSeen || {}; });
  await p.evaluate(() => { const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')); const s = window.__oreum.save; localStorage.setItem(k || 'oreumoreum.v1', JSON.stringify(s)); });
}

async function enterGame(p) {
  await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 180000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.cam.mode = 'follow'; document.body.classList.remove('tut'); for (const id of ['tut-toast', 'intro-help', 'intro']) { const e = document.getElementById(id); if (e) e.hidden = true; } });
  return p.evaluate(HELPERS);
}

async function measureRoute(p, label, opts = {}) {
  const stations = await p.evaluate(() => window.__perf.st);
  const rows = [];
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i], n = stations[i + 1] || stations[i - 1];
    await p.evaluate(({ s, n }) => { const o = window.__oreum, P = o.player; P.pos.set(s.x, o.groundAt(s.x, s.z), s.z); P.visY = P.pos.y; window.__perf.drive = { tx: n.x, tz: n.z, speed: 7 }; o.snap?.(); }, { s, n });
    if (opts.each) await p.evaluate(opts.each, CROWD);
    await p.waitForTimeout(900); // 채우기·LOD 가 자리 잡게
    await p.evaluate(() => { const r = window.__perf.rec; r.dts.length = r.calls.length = r.tris.length = r.cpu.length = 0; r.on = true; });
    await p.waitForTimeout(STATION_T * 1000);
    const r = await p.evaluate(() => { const r = window.__perf.rec; r.on = false; return { dts: r.dts.slice(), calls: r.calls.slice(), tris: r.tris.slice(), cpu: r.cpu.slice() }; });
    rows.push({ station: s.name, ...summarize(r) });
  }
  await p.evaluate(() => { window.__perf.drive = null; });
  const all = { station: '전체', fps: avg(rows.map((r) => r.fps)), low1: Math.min(...rows.map((r) => r.low1)), calls: Math.max(...rows.map((r) => r.calls)), callsAvg: avg(rows.map((r) => r.callsAvg)), tris: Math.max(...rows.map((r) => r.tris)), cpu: avg(rows.map((r) => r.cpu)), cpuMax: Math.max(...rows.map((r) => r.cpuMax)), frames: rows.reduce((s, r) => s + r.frames, 0) };
  const mem = await p.evaluate(() => { const i = window.__oreum.renderer.info; return { tex: i.memory.textures, geo: i.memory.geometries, prog: i.programs?.length || 0, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; });
  return { label, rows, all, mem };
}
const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
function summarize({ dts, calls, tris, cpu }) {
  if (!dts.length) return { fps: 0, low1: 0, calls: 0, callsAvg: 0, tris: 0, frames: 0, cpu: 0, cpuMax: 0 };
  const cs = cpu.slice().sort((a, b) => b - a);
  const ms = dts.map((d) => d * 1000).sort((a, b) => b - a);
  const mean = avg(ms), worst = ms.slice(0, Math.max(1, Math.ceil(ms.length * 0.01)));
  return { fps: 1000 / mean, low1: 1000 / avg(worst), frames: ms.length, calls: Math.max(...calls), callsAvg: avg(calls), tris: Math.max(...tris), cpu: avg(cpu), cpuMax: cs[Math.min(cs.length - 1, Math.floor(cs.length * 0.05))] };
}

const SCENARIOS = {
  day: { name: '낮', prep: async (p) => p.evaluate(() => { window.__oreum.setTod(13); window.__oreum.setWeather('clear'); }) },
  night: { name: '밤', prep: async (p) => p.evaluate(() => { window.__oreum.setTod(22); window.__oreum.setWeather('clear'); }) },
  rain: { name: '비', prep: async (p) => p.evaluate(() => { window.__oreum.setTod(13); window.__oreum.setWeather('rain'); }) },
  clean: { name: '다 치운 뒤(꽃)', prep: async (p) => p.evaluate(() => { const o = window.__oreum; o.setTod(13); o.setWeather('clear'); o.trash.api.heaps.forEach((h, i) => o.trash.setHeap(i, 0)); o.bloom?.finish?.(); }) },
  battle: { name: '전투 오름 몹 4 + 트럭', battle: true, prep: async (p) => p.evaluate(() => { window.__oreum.setTod(13); window.__oreum.setWeather('clear'); }),
    each: () => { const o = window.__oreum, t = o.life.enemies.test; t.clear(); o.dumpers?.clear(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; t.spawn(['boar', 'dog', 'piglet', 'alien'][k], Math.sin(a) * 9, Math.cos(a) * 9); } o.dumpers?.near('truck', 14); } },
  crowd: { name: `다른 사람 ${CROWD}명`, prep: async (p) => p.evaluate(() => { window.__oreum.setTod(13); window.__oreum.setWeather('clear'); }),
    each: (CROWD) => { const o = window.__oreum, P = o.player, f = o.net.test?.fake; if (!f) return; for (let k = 0; k < CROWD; k++) { const a = k * 2.4, r = 4 + (k % 10) * 3.5 + Math.floor(k / 10) * 2; f({ peer: 'fake' + k, presence: { x: P.pos.x + Math.sin(a) * r, z: P.pos.z + Math.cos(a) * r, h: a, nick: '러너' + k, pose: 'move', spd: k % 3 ? 3 : 0, o: null } }); } } },
  // #172 동료 3명과 다른 사람 3명을 견줌 (길목마다 내 앞에 세움). mates3 = 동료 셋, peers3 = 동료를 끄고 다른 사람 셋
  mates3: { name: '동료 3명', prep: async (p) => p.evaluate(() => { const o = window.__oreum; o.setTod(13); o.setWeather('clear'); if (o.save.mates) o.save.mates.off = 0; }),
    each: () => { const o = window.__oreum; ['sunja', 'minsu', 'jenny'].forEach((id) => o.buddies?.come(id)); } },
  peers3: { name: '다른 사람 3명', prep: async (p) => p.evaluate(() => { const o = window.__oreum; o.setTod(13); o.setWeather('clear'); if (o.save.mates) o.save.mates.off = 1; }),
    each: () => { const o = window.__oreum, P = o.player, f = o.net.test?.fake; if (!f) return; for (let k = 0; k < 3; k++) { const a = P.heading + (k - 1) * 0.6; f({ peer: 'fake' + k, presence: { x: P.pos.x + Math.sin(a) * 4, z: P.pos.z + Math.cos(a) * 4, h: a, nick: '러너' + k, pose: 'move', spd: 0, o: null } }); } } },
};

async function runProfile(b, key) {
  const prof = { ...PROFILES[key], key };
  const ctx = await b.newContext({ viewport: prof.viewport, deviceScaleFactor: prof.deviceScaleFactor, isMobile: !!prof.isMobile, hasTouch: !!prof.hasTouch, userAgent: prof.userAgent });
  // 매 프레임 JS 가 쓴 시간(rAF 콜백 합) = CPU 쪽 비용. 소프트웨어 GL 의 그리기 시간과 따로 본다
  await ctx.addInitScript((n) => { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => n }); }, prof.cores); // 이 컨테이너는 코어 2개라 실제 기기 값으로
  await ctx.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__cpuAcc = 0; window.requestAnimationFrame = (cb) => raf((t) => { const a = performance.now(); try { cb(t); } finally { window.__cpuAcc += performance.now() - a; } }); });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  if (prof.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu });
  // 첫 화면: 4G 조건(폰) 으로 깨끗하게 열어 시작 버튼이 뜨고 첫 프레임이 그려질 때까지
  if (prof.net) await cdp.send('Network.emulateNetworkConditions', prof.net);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  let bytes = 0; cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
  const t0 = Date.now();
  await p.goto(pageUrl(prof));
  const tDom = Date.now() - t0;
  await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 0, null, { timeout: 240000, polling: 50 });
  const tFirst = Date.now() - t0, bytesFirst = bytes;
  // 따로 받는 모델(#85)까지 다 받을 때까지 (예전 한 파일 빌드는 assets 가 없음 → 바로)
  await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 240000, polling: 100 });
  await p.waitForTimeout(300);
  const load = { dom: tDom, first: tFirst, bytes: bytesFirst, all: Date.now() - t0, bytesAll: bytes, heap: await p.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null)) };
  if (prof.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await setup(p, prof);
  const out = { profile: key, load, scen: [], errs };
  let battle = false;
  for (const k of SCEN) {
    const sc = SCENARIOS[k]; if (!sc) continue;
    if (!!sc.battle !== battle || !out.scen.length) {
      battle = !!sc.battle;
      await p.evaluate((b) => { const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')); const s = JSON.parse(localStorage.getItem(k)); s.server = b ? 'battle' : 'clean'; localStorage.setItem(k, JSON.stringify(s)); }, battle);
      await p.reload();
      await enterGame(p);
    }
    await sc.prep(p);
    await p.waitForTimeout(800);
    const r = await measureRoute(p, sc.name, { each: sc.each });
    out.scen.push(r);
    if (k === 'crowd' || k === 'peers3') await p.evaluate(() => { const n = window.__oreum.net; for (const id of [...n.peersById.keys()]) n.test?.drop(id); });
    console.error(`[${key}] ${sc.name}: ${fmt(r.all.fps, 1)}fps 1%${fmt(r.all.low1, 1)} cpu ${fmt(r.all.cpu, 1)}ms calls≤${r.all.calls} tris≤${r.all.tris} frames ${r.all.frames}`);
  }
  out.quality = await p.evaluate(() => ({ level: window.__oreum.quality.level, pr: window.__oreum.quality.pr, tier: window.__oreum.quality.tier }));
  await ctx.close();
  return out;
}

function table(res) {
  const L = [];
  for (const r of res) {
    L.push(`\n### ${r.profile === 'phone' ? '폰 390×844 · CPU 4배 느리게' : '데스크톱 1440×900'} (단계 ${r.quality?.tier ?? r.quality?.level}, 픽셀 배율 ${r.quality?.pr})`);
    L.push(`첫 화면 ${(r.load.first / 1000).toFixed(1)}초 (문서 ${(r.load.dom / 1000).toFixed(1)}초) · 처음 받는 양 ${(r.load.bytes / 1048576).toFixed(2)}MB · 전체 ${((r.load.bytesAll ?? r.load.bytes) / 1048576).toFixed(2)}MB (다 받음 ${((r.load.all ?? r.load.first) / 1000).toFixed(1)}초) · JS 힙 ${r.load.heap ?? '-'}MB`);
    L.push('| 상황 | 평균 fps* | 1% 낮은 fps* | JS ms/프레임 평균(상위5%) | draw call 최대(평균) | 삼각형 최대 | 텍스처·지오메트리 | JS 힙 |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const s of r.scen) L.push(`| ${s.label} | ${fmt(s.all.fps, 1)} | ${fmt(s.all.low1, 1)} | ${fmt(s.all.cpu, 1)} (${fmt(s.all.cpuMax, 1)}) | ${s.all.calls} (${fmt(s.all.callsAvg)}) | ${(s.all.tris / 1000).toFixed(0)}k | ${s.mem.tex}·${s.mem.geo} | ${s.mem.heap ?? '-'}MB |`);
    const d = r.scen[0]; if (d) { L.push(`\n길목별(${d.label}): ` + d.rows.map((x) => `${x.station} ${x.calls}call·${(x.tris / 1000).toFixed(0)}k·${fmt(x.cpu, 1)}ms`).join(' · ')); }
    if (r.errs.length) L.push('페이지 오류: ' + r.errs.slice(0, 3).join(' / '));
  }
  return L.join('\n');
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const res = [];
  for (const k of which === 'all' ? ['phone', 'desk'] : [which]) res.push(await runProfile(b, k));
  await b.close(); server.close();
  const files = Object.entries(sizes).map(([u, s]) => `${u} ${(s.raw / 1024).toFixed(0)}KB (gzip ${(s.gz / 1024).toFixed(0)}KB)`);
  const md = table(res) + '\n\n파일별: ' + files.join(' · ') + '\n\n* fps 는 소프트웨어 GL(swiftshader, 코어 2개) 값이라 실제 GPU 보다 훨씬 낮다. 전·후 비교용';
  console.log(md);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ res, sizes, md }, null, 1));
})();
