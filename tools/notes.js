// 쪽지 넘겨 보기 확인 (#199). node build.mjs 뒤 node tools/notes.js [--shot]
//   쪽지 3장(+긴 글 하나)을 주운 순서로 넣고: 새로 주운 창은 맨 뒤에서 시작·◀ 로 앞 것, 버튼·←→·A·D·밀기로 넘김, 끝에서 멈춤, 넘겨 본 것도 읽음
//   도감에서 열면 그 쪽지부터, 종이 종류, 그림(img) 있으면 붙고 없으면 종이만, 긴 글은 창 안에서 스크롤·화면 밖으로 안 나감 (데스크톱·폰)
//   --shot: dist/notes-*.jpg
const { chromium } = require('playwright');
const fs = require('fs');
const SHOT = process.argv.includes('--shot');
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
// 그림 하나 (dist 에만, 확인용): 단색 PNG 를 webp 이름으로 (브라우저는 내용으로 읽음)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
fs.mkdirSync('dist/assets/notes', { recursive: true }); fs.writeFileSync('dist/assets/notes/n1c.webp', PNG);
async function run(b, vp, tag) {
  const p = await b.newPage({ viewport: vp, hasTouch: vp.width < 600 }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(5000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(2500);
  await p.evaluate(() => { const o = window.__oreum; o.tut.skipAll?.(); o.look?.close?.(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
  await p.waitForTimeout(600);
  const N = () => p.evaluate(() => window.__oreum.punkWorld.note.view());
  // 3장 + 긴 것, 주운 순서 n1a → n1c → n2a (n1c 는 그림)
  await p.evaluate(() => {
    const w = window.__oreum.punkWorld.note; w.reset(); w.list.find((n) => n.id === 'n1c').img = true;
    for (const id of ['n1a', 'n1c', 'n2a']) { w.give(id, true); window.__t = (window.__t || 0) + 1; }
    const s = window.__oreum.save.punk.notes; s.n1a = 1000; s.n1c = 2000; s.n2a = 3000;
  });
  // 새로 주운 쪽지 (조용히가 아니게): 맨 뒤에서 시작
  await p.evaluate(() => { const w = window.__oreum.punkWorld.note; const L = w.list.find((n) => n.id === 'n2f'); L.b = Array.from({ length: 40 }, (_, i) => `긴 줄 ${i + 1}번째 — 다음엔 진짜 안 버린다고 몇 번이고 다짐함`).join('\n'); w.give('n2f'); window.__oreum.save.punk.notes.n2f = 4000; w.close(); w.open('n2f'); });
  await p.waitForTimeout(300);
  let v = await N();
  ok(v.open && v.id === 'n2f' && v.count === '4 / 4' && v.prev && !v.next, `새 쪽지 창은 맨 뒤 (${v.count}), ◀ 됨·▶ 막힘`);
  ok(v.dotPrev, '앞에 안 읽은 쪽지가 있으면 ◀ 에 점');
  ok(v.overflow && v.fits, `긴 쪽지는 창 안에서 스크롤, 창이 화면 안 (${tag})`);
  if (SHOT) await p.screenshot({ path: `dist/notes-${tag}-long.jpg`, quality: 70 });
  // 버튼 ◀
  await p.click('#punk-note .pn-prev'); await p.waitForTimeout(350); v = await N();
  ok(v.id === 'n2a' && v.paper === 'pp-form' && v.count === '3 / 4', `◀ 버튼 → 과태료 고지서 (종이 ${v.paper})`);
  // 키 ← / A
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(350); v = await N();
  ok(v.id === 'n1c' && v.paper === 'pp-receipt', `← 키 → 마트 영수증 (종이 ${v.paper})`);
  await p.waitForTimeout(400); v = await N();
  ok(v.pic && v.img.endsWith('assets/notes/n1c.webp'), `그림 있는 쪽지는 그림이 붙음 (${v.img})`);
  const pos0 = await p.evaluate(() => window.__oreum.player.pos.x);
  await p.keyboard.down('KeyA'); await p.waitForTimeout(300); await p.keyboard.up('KeyA'); await p.waitForTimeout(300); v = await N();
  const pos1 = await p.evaluate(() => window.__oreum.player.pos.x);
  ok(v.id === 'n1a' && !v.pic && v.paper === 'pp-memo', `A 키 → 맛집 리스트 (그림 없음, 종이만)`);
  ok(Math.abs(pos1 - pos0) < 0.05, `창이 열린 동안 A 로 캐릭터가 움직이지 않음 (${(pos1 - pos0).toFixed(3)})`);
  // 처음에서 멈춤
  await p.keyboard.press('ArrowLeft'); await p.click('#punk-note .pn-prev', { force: true }).catch(() => {}); await p.waitForTimeout(200); v = await N();
  ok(v.id === 'n1a' && v.i === 0 && !v.prev, '처음에서 ◀ 는 멈춤');
  // 밀기 (왼쪽으로 밀면 다음)
  const swipe = async (dx) => { const box = await p.locator('#punk-note .pn-paper').boundingBox(), y = box.y + Math.min(80, box.height / 2), x0 = box.x + box.width / 2 - dx / 2; await p.mouse.move(x0, y); await p.mouse.down(); await p.mouse.move(x0 + dx / 2, y, { steps: 4 }); await p.mouse.move(x0 + dx, y, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(350); };
  await swipe(-140); v = await N();
  ok(v.id === 'n1c', `왼쪽으로 밀기 → 다음 (${v.id})`);
  await swipe(140); v = await N();
  ok(v.id === 'n1a', `오른쪽으로 밀기 → 이전 (${v.id})`);
  // 키 → / D, 끝에서 멈춤
  for (const k of ['ArrowRight', 'KeyD', 'ArrowRight', 'ArrowRight', 'KeyD']) { await p.keyboard.press(k); await p.waitForTimeout(120); }
  v = await N();
  ok(v.id === 'n2f' && !v.next && v.count === '4 / 4', `→·D 로 끝까지, 끝에서 ▶ 는 멈춤 (${v.count})`);
  const un = await p.evaluate(() => window.__oreum.punkWorld.note.unread());
  ok(un.length === 0, `넘겨서 본 쪽지도 읽음 처리 (안 읽음 ${un.length})`);
  ok(!(await N()).dotPrev && !(await N()).dotNext, '다 읽으면 점 없음');
  ok(v.turns >= 6, `넘김 횟수 ${v.turns}, 움직임 ${v.anim ? '있음' : '없음(저사양)'}`);
  // Esc 닫기
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); v = await N();
  ok(!v.open, 'Esc 로 닫힘');
  // 도감에서 열면 그 쪽지부터
  await p.evaluate(() => { window.__oreum.save.punk.unread = ['n2a']; });
  const fromDex = await p.evaluate(async () => {
    document.getElementById('ach-dex')?.click(); const o = window.__oreum;
    if (document.getElementById('dex').hidden) { const b = [...document.querySelectorAll('button')].find((x) => /도감/.test(x.textContent) && x.offsetParent); b?.click(); }
    await new Promise((r) => setTimeout(r, 300));
    const cell = [...document.querySelectorAll('#dex .dex-cell.note')].find((c) => c.querySelector('b')?.textContent === '과태료 고지서');
    cell?.click(); await new Promise((r) => setTimeout(r, 300));
    return { dex: !document.getElementById('dex').hidden, cell: !!cell, v: o.punkWorld.note.view() };
  });
  ok(fromDex.cell && fromDex.v.open && fromDex.v.id === 'n2a' && fromDex.v.count === '3 / 4' && fromDex.dex, `도감에서 열면 그 쪽지부터 (${fromDex.v.count}), 도감은 뒤에 그대로`);
  if (SHOT) await p.screenshot({ path: `dist/notes-${tag}-dex.jpg`, quality: 70 });
  await p.click('#punk-note-close'); await p.waitForTimeout(200);
  // 종이 종류가 모두 그려짐 (모든 쪽지를 한 번씩)
  const papers = await p.evaluate(async () => {
    const w = window.__oreum.punkWorld.note; document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
    for (const n of w.list) { w.give(n.id, true); }
    const seen = new Set(), bad = [];
    w.open(w.list[0].id);
    for (let i = 0; i < w.list.length; i++) { const v = w.view(); seen.add(v.paper); if (!v.fits) bad.push(v.id); w.go(1); }
    w.close(); return { seen: [...seen], bad, n: w.got().length };
  });
  ok(papers.seen.length >= 12 && !papers.bad.length, `종이 ${papers.seen.length}종 (${papers.seen.join(' ')}), 창이 화면 밖으로 나간 쪽지 ${papers.bad.length ? papers.bad.join(',') : '없음'}`);
  if (SHOT) {
    for (const id of ['n1c', 'n4b', 'n4c', 'n3d', 'n2e', 'n5f']) { await p.evaluate((i) => window.__oreum.punkWorld.note.open(i), id); await p.waitForTimeout(400); await p.screenshot({ path: `dist/notes-${tag}-${id}.jpg`, quality: 70 }); }
  }
  ok(!errs.length, `페이지 오류 없음 ${errs.slice(0, 2).join(' | ')}`);
  await p.close();
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(b, { width: 1100, height: 700 }, 'pc');
  await run(b, { width: 390, height: 700 }, 'phone');
  await b.close();
})();
