// 오름지기 그림 (#282): node tools/jigishot.js [안들=A,B,C] [출력=notes/shots/282] [d|m]
// 튜토리얼을 마친 저장으로 들어가 오름지기 앞에서 안마다 낮(가까이)·밤(손전등)·흰 옷(ghost-keeper) 나란히를 찍어 한 장(<안>.jpg)으로 붙임
// m: 폰(가로 844×390)으로 이름표·말풍선·모자가 겹치지 않는지 한 장(phone.jpg). 페이지 오류가 있으면 exit 1
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const LOOKS = (process.argv[2] || 'A,B,C').split(','), OUT = process.argv[3] || 'notes/shots/282', DEV = process.argv[4] || 'd';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(DEV === 'm' ? { ...devices['iPhone 13'], viewport: { width: 844, height: 390 } } : { viewport: { width: 560, height: 420 } });
  const p = await ctx.newPage(); let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html?aa=1#namsongi'); await W(5000);
  await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, nickSet: 1, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1 }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await W(5000); await p.click('#enter').catch(() => {}); await W(4000);
  if (await E(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await W(800); }
  if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) await p.click('#fs-tip-x').catch(() => {});
  await E(() => { const o = window.__oreum; o.pace?.test?.hold?.(); });
  const ok = await E(() => !!window.__oreum.quest?.givers?.get('jigi'));
  if (!ok) { console.log('FAIL 오름지기 없음'); await b.close(); process.exit(1); }
  /* 오름지기를 바라보는 자리: 앞 dist m, 옆으로 yaw 만큼 */
  const view = (h, dist, yaw, ghost = false, hideUi = true) => E(([h, dist, yaw, ghost, hideUi]) => { const o = window.__oreum, g = o.quest.givers.get('jigi'), f = g.face;
    o.setTod(h); o.setWeather?.('clear');
    const x = g.pos.x + Math.sin(f) * (dist + 1.5), z = g.pos.z + Math.cos(f) * (dist + 1.5); o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = f + Math.PI;
    o.cam.mode = 'free'; const a = f + yaw, gy = g.pos.y; const cl = dist < 2.5; o.camObj.position.set(g.pos.x + Math.sin(a) * dist, gy + (cl ? 2.0 : 1.9), g.pos.z + Math.cos(a) * dist); o.camObj.lookAt(g.pos.x, gy + (cl ? 1.75 : 1.35), g.pos.z);
    o.runner.root.visible = false;
    let st = document.getElementById('__jshot'); if (!st) { st = document.createElement('style'); st.id = '__jshot'; document.head.append(st); }
    st.textContent = hideUi ? 'body > *:not(#view){visibility:hidden!important} #view{visibility:visible!important}' : '';
    if (ghost && !window.__ghost) { const m = o.caseModel('ghost-keeper'); const s = -Math.cos(f), c = Math.sin(f); m.root.position.set(g.pos.x + s * 1.6, o.groundAt(g.pos.x + s * 1.6, g.pos.z + c * 1.6), g.pos.z + c * 1.6); m.root.rotation.y = f; o.scene.add(m.root); m.near(true); m.play('idle'); window.__ghost = m; }
    if (window.__ghost) { window.__ghost.root.visible = ghost; window.__ghost.update(1 / 30); }
  }, [h, dist, yaw, ghost, hideUi]);
  const tiles = [];
  for (const L of LOOKS) {
    const has = await E((L) => { const j = window.__oreum.jigi; if (!j) return false; j.set(L); return true; }, L);
    if (!has && L !== '0') console.log('note: __oreum.jigi 없음 → 지금 모습만');
    const shots = [['close', 14, 1.9, -0.25], ['day', 14, 3.0, -0.45], ['side', 14, 3.2, -1.3], ['night', 22, 3.4, -0.6], ['ghost', 22, 5.5, -0.75, true]];
    for (const [n, h, d, y, gh] of shots) {
      await view(h, d, y, !!gh); if (n === 'night' || n === 'ghost') await E(() => { const j = window.__oreum.jigi; j?.test?.('night'); });
      else await E(() => window.__oreum.jigi?.test?.('look'));
      if (gh) await E(() => new Promise((r) => { const t = Date.now(); const k = () => (window.__ghost?.loaded?.hi || Date.now() - t > 20000 ? r() : setTimeout(k, 300)); k(); })); await W(2200); const f = path.join(OUT, `_${L}-${n}.png`); await p.screenshot({ path: f }); tiles.push(f);
    }
  }
  /* 동작 한 줄 (첫 안): 허리 두드리기(옆)·집게 딸깍·모자 인사·수첩 적기·밤 손전등(옆) */
  await E((L) => window.__oreum.jigi?.set(L), LOOKS[0]);
  for (const [m, h, d, y] of [['back', 14, 2.8, -1.7], ['click', 14, 2.6, -0.3], ['hat', 14, 2.6, -0.3], ['note', 14, 2.6, -0.5], ['night', 22, 3.0, -1.1]]) {
    await view(h, d, y); await E((m) => window.__oreum.jigi?.test?.(m), m); await W(2000);
    const f = path.join(OUT, `_poses-${m}.png`); await p.screenshot({ path: f }); tiles.push(f);
  }
  await E(() => window.__oreum.jigi?.test?.(null)); LOOKS.push('poses');
  if (DEV === 'm') { /* 폰: 이름표·말풍선·모자 (UI 보임) */
    await view(14, 4.2, 0.3, false, false); await E(() => { const o = window.__oreum; o.quest.open?.('jigi'); o.quest.close?.(); const g = o.quest.givers.get('jigi'); window.__oreum.social?.showBubble?.('npc-q-jigi', g.root, '오름은 늘 할 일이 있어요. 늘요', 6); });
    await W(1500); await p.screenshot({ path: path.join(OUT, 'phone.jpg'), type: 'jpeg', quality: 70 });
  }
  if (tiles.length) {
    const per = 5;
    cp.execFileSync('python3', ['-c', `import sys\nfrom PIL import Image\nout=sys.argv[1]; per=int(sys.argv[2]); names=sys.argv[3].split(','); fs=sys.argv[4:]\nims=[Image.open(f).convert('RGB') for f in fs]\nw,h=ims[0].size\nk=360/w\nims=[i.resize((int(w*k),int(h*k))) for i in ims]\nw,h=ims[0].size\nfor r,n in enumerate(names):\n  o=Image.new('RGB',(w*per,h))\n  for i in range(per): o.paste(ims[r*per+i],(i*w,0))\n  o.save(out+'/'+n+'.jpg', quality=72, optimize=True)`, OUT, String(per), LOOKS.join(','), ...tiles]);
    tiles.forEach((f) => fs.unlinkSync(f));
  }
  console.log(errs ? `ERR ${errs}` : 'ok'); await b.close(); process.exit(errs ? 1 : 0);
})();
