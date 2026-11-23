// #283 가게·시설 창 한 장 모음 + 규격 재기: node build.mjs && node tools/winshot.js [out 폴더] [pc|phone|small|land ...]
//   창마다 그림(작게) + 표(창 폭·제목 줄·닫기 자리·주 버튼/보조 버튼 높이·글자·모서리·주 버튼 수)를 찍고, 화면 밖으로 넘치거나 겹친 버튼을 알림
//   out/<기기>-<창>.jpg, out/sheet-<기기>.html(한 장 모음), 표는 콘솔
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || 'notes/shots/283';
const want = process.argv.slice(3);
const MODES = {
  pc: { viewport: { width: 1280, height: 800 } },
  phone: { ...devices['iPhone 13'], isMobile: true },
  small: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  land: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
};
const WINS = [
  ['gear', (O) => O.street.open('gear')], ['stone', (O) => O.street.open('stone')], ['manjok', (O) => O.street.open('manjok')],
  ['salon', (O) => O.street.open('salon')], ['leap', (O) => O.street.open('leap')], ['ride', (O) => O.street.open('ride')],
  ['inn', (O) => O.street.open('inn')], ['tok', (O) => O.street.open('tok')], ['dir', (O) => O.street.open('dir')],
  ['tube', (O) => { const l = O.tube.list(); O.tube.reset(l.slice(0, 3).map((t) => t.id)); O.tube.open(l[0].id); }], ['bag', (O) => O.bag.open()], ['case', (O) => O.cases.file()],
  ['todo', () => document.getElementById('ach-chip')?.click()],
  ['menu', () => { document.getElementById('btn-menu').click(); }],
];
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let bad = 0;
  for (const [mode, opt] of Object.entries(MODES)) {
    if (want.length && !want.includes(mode)) continue;
    const ctx = await b.newContext(opt), p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 200)); });
    const E = (f, a) => p.evaluate(f, a), W = (ms) => p.waitForTimeout(ms);
    const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await ready();
    await E(() => { const O = window.__oreum; Object.assign(O.save, { entered: 1, server: 'battle', look: O.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, mealFree: 1, coins: 5000, shopGate: { init: 1, open: { gear: 1, manjok: 1, stone: 1, salon: 1, leap: 1, ride: 1, inn: 1 } } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum.v')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(O.save)); });
    await p.reload(); await ready(); await p.click('#enter').catch(() => {}); await W(4000);
    await E(() => { for (const id of ['fs-tip']) { const el = document.getElementById(id); if (el) el.hidden = true; } });
    const rows = [], files = [];
    for (const [name, open] of WINS) {
      await E(() => { window.__oreum.close?.(); document.querySelectorAll('.overlay:not(#intro)').forEach((o) => { if (o.id !== 'countdown' && o.id !== 'flash') o.hidden = true; }); const m = document.getElementById('menu'); if (m) m.hidden = true; });
      await W(200);
      try { await E(new Function('o', `return (${open.toString()})(window.__oreum)`), null); } catch (e) { console.log(mode, name, '열기 실패', e.message.slice(0, 80)); continue; }
      await W(700);
      const m = await E(() => {
        const W = innerWidth, H = innerHeight;
        const ov = [...document.querySelectorAll('.overlay, aside, #menu, .pop-menu')].filter((o) => !o.hidden && o.id !== 'intro' && o.getBoundingClientRect().width > 0 && getComputedStyle(o).display !== 'none' && getComputedStyle(o).visibility !== 'hidden').pop();
        if (!ov) return null;
        const pop = ov.querySelector('.pop') || ov;
        const R = pop.getBoundingClientRect(), cs = (el) => getComputedStyle(el);
        const btns = [...pop.querySelectorAll('button, .btn, .menu-card')].filter((x) => x.getBoundingClientRect().width > 0 && cs(x).visibility !== 'hidden');
        const close = btns.find((x) => /close|닫기/.test((x.id || '') + (x.getAttribute('aria-label') || '') + x.textContent.trim().slice(0, 3)));
        const prim = btns.filter((x) => x.classList.contains('primary'));
        const sec = btns.filter((x) => x.classList.contains('btn') && !x.classList.contains('primary') && x !== close);
        const d = (x) => x && `${Math.round(x.getBoundingClientRect().height)}/${parseFloat(cs(x).fontSize)}/${cs(x).borderTopLeftRadius}`;
        const off = []; for (const x of btns) { const r = x.getBoundingClientRect(); let sp = x.parentElement, clip = false; while (sp && sp !== pop.parentElement) { const o = cs(sp).overflowY; if (o === 'auto' || o === 'scroll') { clip = true; break; } sp = sp.parentElement; } if (!clip && (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1)) off.push((x.id || x.textContent.trim()).slice(0, 14)); }
        const cr = close && close.getBoundingClientRect();
        return { w: Math.round(R.width), pct: Math.round(R.width / W * 100), h: Math.round(R.height), close: cr ? `${cr.right > R.left + R.width * 0.6 ? '오른쪽' : '왼쪽'}${cr.top < R.top + 70 ? '위' : '아래'} ${Math.round(cr.width)}×${Math.round(cr.height)}` : '없음', prim: prim.length, primD: d(prim[0]) || '-', secD: d(sec[0]) || '-', radius: cs(pop).borderTopLeftRadius, off };
      });
      if (!m) { console.log(mode, name, '창이 안 열림'); continue; }
      const f = `${mode}-${name}.jpg`; files.push([name, f]);
      await p.screenshot({ path: `${OUT}/${f}`, type: 'jpeg', quality: 55, timeout: 150000 });
      rows.push([name, m]); if (m.off.length) bad++;
    }
    console.log(`\n[${mode}] 창 | 폭(px/%) | 높이 | 모서리 | 닫기 | 주 버튼 수 | 주 버튼 높이/글자/둥글기 | 보조 버튼 | 넘침`);
    for (const [n, m] of rows) console.log(`${n} | ${m.w}/${m.pct}% | ${m.h} | ${m.radius} | ${m.close} | ${m.prim} | ${m.primD} | ${m.secD} | ${m.off.join(',') || '-'}`);
    require('fs').writeFileSync(`${OUT}/sheet-${mode}.html`, `<!doctype html><meta charset="utf-8"><title>${mode}</title><style>body{margin:0;background:#222;display:flex;flex-wrap:wrap;gap:6px;padding:6px;font:12px sans-serif;color:#ddd}figure{margin:0}img{width:${mode === 'pc' ? 420 : 240}px;display:block}</style>${files.map(([n, f]) => `<figure><img src="${f}"><figcaption>${n}</figcaption></figure>`).join('')}`);
    console.log(mode, '페이지 오류', errs);
    if (errs) bad++;
    await ctx.close();
  }
  await b.close();
  console.log(bad ? `문제 ${bad}` : '통과');
  process.exit(bad ? 1 : 0);
})();
