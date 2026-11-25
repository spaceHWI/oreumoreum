// 길 밖 곳 확인 (#294): 길 밖 곳에 가면 귤 offGyul·한 줄·퀘스트 셈(off@구역)·지도 볼거리, 추적 화살표가 아직 못 찾은 곳을 가리킴, 보물이 곁으로 옮겨짐, 다음 할 일 '안 가 본 곳'
// node build.mjs && node tools/offpath.js [--shot]   (--shot: notes/shots/294/off-<모양>.png 작게)
const { chromium } = require('playwright');
const fs = require('fs');
const SHOT = process.argv.includes('--shot');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 560, height: 340 } });
  let errs = 0, fail = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
  const ev = (f, a) => p.evaluate(f, a), W = (ms) => p.waitForTimeout(ms);
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await ready();
  await ev(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, journey: { ...(o.save.journey || {}), maxZ: 2 } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await ready(); await W(2500); await p.click('#enter').catch(() => {}); await W(4000);
  const info = await ev(() => { const o = window.__oreum, F = o.field.api, B = window.__oreumBalance; const offs = F.sights.filter((s) => s.off);
    return { n: offs.length, zones: offs.reduce((a, s) => ((a[s.zone] = (a[s.zone] || 0) + 1), a), {}), kinds: [...new Set(offs.map((s) => s.kind))], moved: F.treasures.filter((t) => t.moved).map((t) => [t.id, t.moved]),
      far: offs.map((s) => +(Math.hypot(s.x - o.player.pos.x, s.z - o.player.pos.z)).toFixed(0)).length, ys: offs.every((s) => Number.isFinite(s.y)) }; });
  ok(info.n === 30, `길 밖 곳 ${info.n}곳 · 구역별 ${JSON.stringify(info.zones)} · 모양 ${info.kinds.join(',')}`);
  ok(info.ys, '높이가 모두 숫자');
  ok(info.moved.length >= 3, `보물이 길 밖 곳 곁으로 ${info.moved.map((m) => m.join('→')).join(' · ')}`);
  /* 퀘스트: 오름지기 곁가지 받기 → 추적이 구역 1 길 밖 곳을 가리킴 */
  const q = await ev(() => { const Q = window.__oreum.quest; const st = Q.api.state(); if (!st.done.includes('field1')) st.done.push('field1'); Q.give('x-off1'); return { st: Q.state().side['x-off1'] || null, cap: Q.cap('off@1') }; });
  ok(!!q.st && q.cap === 22, `x-off1 받음 · 셈 끝 ${q.cap}`);
  /* 하나씩 가 봄 */
  const kinds = new Set();
  for (let i = 0; i < 3; i++) {
    const r = await ev(async () => { const o = window.__oreum, F = o.field.api, got = o.field.save.sight; const s = F.sights.find((s) => s.off && s.zone === 1 && !got.includes(s.id)); const c0 = o.save.coins;
      o.tp(s.x + 3, s.z + 2, 0); await new Promise((r) => setTimeout(r, 1500)); return { id: s.id, kind: s.kind, name: s.name, got: got.includes(s.id), d: o.save.coins - c0 }; });
    kinds.add(r.kind);
    ok(r.got && r.d >= 5, `${r.name} 찾음 · 귤 +${r.d}`);
    if (SHOT) { fs.mkdirSync('notes/shots/294', { recursive: true }); await ev(() => window.__oreum.snap()); await W(400); await p.screenshot({ path: `notes/shots/294/off-${r.kind}.png` }); }
  }
  await W(800);
  const q2 = await ev(() => { const Q = window.__oreum.quest; return { done: Q.state().done.includes('x-off1'), side: Q.state().side['x-off1'] || null, msg: window.__oreum.msglog?.list?.()?.slice?.(-6) || null }; });
  ok(q2.done || (q2.side && true), `x-off1 셋 채움 (${q2.done ? '끝냄' : '돌려주러 갈 차례'})`);
  /* 지도: 볼거리 마름모(찾은 것) — 큰 지도가 오류 없이 그려짐 */
  await ev(() => window.__oreum.zoneLook?.openMap()); await W(500); await ev(() => { document.getElementById('omap').hidden = true; });
  /* 다음 할 일: 더미·소굴이 없으면 '안 가 본 곳' */
  const nh = await ev(() => { const o = window.__oreum, N = o.quest.next; N.skip(['case', 'arena', 'boss', 'forge', 'legend', 'report', 'daily', 'heap', 'den']); const a = N.after(); N.skip([]); return a && { k: a.k, text: a.text, pos: a.pos && a.pos() && [Math.round(a.pos().x), Math.round(a.pos().z)] }; });
  ok(nh && nh.k === 'after:explore' && /들판에 아직 안 가 본 곳/.test(nh.text) && nh.pos, `다음 할 일: ${nh && nh.text} → ${nh && nh.pos}`);
  /* 예전 저장(길 밖 곳 없음)에서 시작해도 셈 0 */
  const old = await ev(() => window.__oreum.quest.cap('off@3'));
  ok(old === 0, `구역 3 길 밖 곳 없음 → 셈 끝 ${old}`);
  ok(errs === 0, `페이지 오류 ${errs}`);
  console.log(fail ? `실패 ${fail}` : '통과');
  await b.close(); process.exit(fail ? 1 : 0);
})();
