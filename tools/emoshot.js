// 동작 확인 (#76, #242 부채꼴 8칸): node tools/emoshot.js → dist/emo-*.png(작게), 콘솔에 ok/FAIL
// 폰 세로·폰 가로·PC: 동작 버튼(또는 단순 화면의 메뉴 타일)을 누르면 버튼 곁에 8칸, 칸이 화면 안·서로·다른 버튼과 안 겹침, 누르면 동작·닫힘
// 폰: 누른 채 밀어 떼기로 고르기. PC: 숫자 키 1~8, G 로 열기. 옛 저장 emoFav 는 지워짐. 남이 목록 밖 동작(five)·모르는 동작을 보내도 오류 없음
// 먼저 node build.mjs
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
const SHOT = process.argv.includes('--shot');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const modes = [['m', { ...devices['iPhone 13'] }], ['ml', { ...devices['iPhone 13 landscape'] }], ['d', { viewport: { width: 1280, height: 720 } }]];
  for (const [n, opt] of modes) {
    const ctx = await b.newContext(opt); const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
    const until = async (fn, ms) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await E(fn).catch(() => false)) return true; await W(100); } return false; };
    await p.goto(URL); await until(() => !!window.__oreum?.ticks, 30000);
    await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1, emoFav: ['five', 'insa', 'clap', 'no'] }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
    await p.reload(); await until(() => !!window.__oreum?.ticks, 30000); await p.click('#enter').catch(() => {}); await W(2500);
    if (await E(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(800); }
    if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) { await p.click('#fs-tip-x').catch(() => {}); await W(300); }
    await E(() => { const o = window.__oreum; o.setTod(15); o.look?.close?.(); document.body.classList.remove('tut'); });
    await W(1500);
    ok(await E(() => !('emoFav' in window.__oreum.save)), `${n} 옛 저장 emoFav 지움`);
    const simple = await E(() => document.body.classList.contains('simple'));
    const open = async () => {
      if (await E(() => !document.getElementById('actions').hidden)) return;
      if (simple) { await p.click('#btn-menu'); await W(300); await p.click('#menu-act'); } else await p.click('#btn-actions');
      await W(400);
    };
    await open();
    const L = await E(() => {
      const cs = [...document.querySelectorAll('.emo-c')].map((c) => { const r = c.getBoundingClientRect(); return { id: c.dataset.id, x: r.left, y: r.top, w: r.width, h: r.height, name: c.textContent }; });
      const hit = (a, b2) => a.x < b2.x + b2.w && b2.x < a.x + a.w && a.y < b2.y + b2.h && b2.y < a.y + a.h;
      const others = ['joy', 'btn-ctx', 'btn-pick', 'btn-jump', 'btn-ride', 'btn-actions'].map((id) => document.getElementById(id)).filter((el) => el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden').map((el) => { const r = el.getBoundingClientRect(); return { id: el.id, x: r.left, y: r.top, w: r.width, h: r.height }; });
      const over = []; cs.forEach((c, i) => { cs.slice(i + 1).forEach((d) => { if (Math.hypot(c.x - d.x, c.y - d.y) < c.w + 7) over.push(c.id + '/' + d.id); }); /* 칸끼리: 둥근 네모라 가운데 거리로 */ others.forEach((o) => { if (hit(c, o)) over.push(c.id + '/' + o.id); }); });
      const inside = cs.every((c) => c.x >= 0 && c.y >= 0 && c.x + c.w <= innerWidth && c.y + c.h <= innerHeight);
      const btn = document.getElementById('btn-actions').getBoundingClientRect();
      return { n: cs.length, ids: cs.map((c) => c.id).join(','), min: Math.min(...cs.map((c) => Math.min(c.w, c.h))), over, inside, W: innerWidth, H: innerHeight, far: Math.max(...cs.map((c) => Math.hypot(c.x + c.w / 2 - (btn.width ? btn.left + btn.width / 2 : 38), c.y + c.h / 2 - (btn.width ? btn.top + btn.height / 2 : innerHeight - 172)))) };
    });
    ok(L.n === 8, `${n} 8칸 (${L.ids})`);
    ok(L.min >= 44, `${n} 칸 크기 ${L.min}px ≥ 44`);
    ok(L.inside, `${n} 모두 화면 안 (${L.W}×${L.H})`);
    ok(!L.over.length, `${n} 겹침 없음${L.over.length ? ' — ' + L.over.join(' ') : ''}`);
    ok(L.far < (L.H < 480 ? 500 : 240), `${n} 버튼 곁${L.H < 480 ? '(가로: 버튼 옆 한 줄)' : ''} (가장 먼 칸 ${L.far.toFixed(0)}px)`);
    if (SHOT) await p.screenshot({ path: `dist/emo-${n}-fan.png`, scale: 'css' });
    // 눌러 고르기 → 동작·닫힘
    await p.click('.emo-c[data-id="wave"]'); await W(300);
    ok(await E(() => window.__oreum.player.pose === 'wave' && document.getElementById('actions').hidden), `${n} 눌러 고르면 동작(wave)·닫힘`);
    await W(2500);
    if (n !== 'd') {
      // 누른 채 밀어 떼기 (단순 화면이면 끄고 동작 버튼으로)
      if (simple) { await E(() => window.__oreum.simple.set(false)); await W(400); }
      const bb = await (await p.$('#btn-actions')).boundingBox();
      await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await W(250);
      const t = await (await p.$('.emo-c[data-id="heart"]')).boundingBox();
      await p.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 6 }); await W(100);
      const hot = await E(() => document.querySelector('.emo-c.hot')?.dataset.id);
      await p.mouse.up(); await W(300);
      ok(hot === 'heart' && await E(() => window.__oreum.player.pose === 'heart' && document.getElementById('actions').hidden), `${n} 누른 채 밀어 떼기 → heart (hot ${hot})`);
      await W(2500);
    }
    if (n === 'd') {
      await p.keyboard.press('Digit2'); await W(200);
      ok(await E(() => window.__oreum.player.pose === 'thumb'), 'd 숫자 키 2 → 좋아 (닫힌 채)');
      await W(2200);
      await p.keyboard.press('KeyG'); await W(300);
      ok(await E(() => !document.getElementById('actions').hidden), 'd G 로 열림');
      await p.keyboard.press('Digit7'); await W(300);
      ok(await E(() => window.__oreum.player.pose === 'dance' && document.getElementById('actions').hidden), 'd 열린 채 7 → 춤·닫힘');
      await p.keyboard.press('KeyW'); await W(300);
      await p.keyboard.press('KeyG'); await W(200); await p.keyboard.press('KeyG'); await W(200);
      ok(await E(() => document.getElementById('actions').hidden), 'd G 두 번 → 닫힘');
    }
    // 게임 안 일에 쓰는 목록 밖 동작은 그대로 (하르방 인사 five, 소원·귤 주기 insa)
    await W(1500);
    ok(await E(() => window.__oreum.emo.perform('insa') && window.__oreum.player.pose === 'insa'), `${n} 목록 밖 동작(insa)도 게임 안 일로는 됨`);
    // 남이 목록 밖·모르는 동작을 보냄
    await E(() => { const o = window.__oreum; const T = o.player.pos; const mk = (id, em) => { const run = o.buildRunner(); o.scene.add(run.root); const pos = T.clone(); pos.x += 3; run.root.position.copy(pos);
      o.net.peersById.set(id, { peer: id, runner: run, label: null, nick: '친구', pos, tpos: pos.clone(), heading: 0, theading: 0, data: { x: pos.x, z: pos.z, pose: em.id, em }, speed: 0, poseT: 0, lastPos: pos.clone() }); };
      mk('f1', { id: 'five', at: Date.now() }); mk('f2', { id: 'zzz', at: Date.now() }); mk('f3', { id: 'clap', at: Date.now() }); });
    await W(800);
    ok(await E(() => window.__oreum.emo.test.bubbles.length >= 2), `${n} 남의 목록 밖 동작(five·clap)은 말풍선, 모르는 것(zzz)은 무시`);
    await E(() => { ['f1', 'f2', 'f3'].forEach((id) => { const e = window.__oreum.net.peersById.get(id); e.runner.root.removeFromParent(); window.__oreum.net.peersById.delete(id); }); });
    await W(300);
    ok(!errs, `${n} 페이지 오류 없음`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
