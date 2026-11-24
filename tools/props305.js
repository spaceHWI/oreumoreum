// Tripo 소품 검사 (#305): node build.mjs && node tools/props305.js [출력=notes/shots/305] [d|m]
// - 들어온 뒤 CASE_MODELS.jigiDelay 초 전에는 좌판·징·투입구를 받지 않음(받기 전엔 예전 코드 모양)
// - 서바이벌 터 1: 좌판·징·주인 큰 모델이 뜨는지, 징을 치면(ring) 징판이 흔들리고 멈추는지 → stall.jpg
// - 들머리 투입구: 큰 모델, 덮개 닫힘(0)·열림(1) → chute.jpg (닫힘·열림 나란히)
// - 망고: 받으면 튀는 망고(pop)·위쪽 '지금 있는 곳' 옆 망고 그림(#where-tok img) → mango.jpg
// 페이지 오류·실패가 있으면 exit 1
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const OUT = process.argv[2] || 'notes/shots/305', DEV = process.argv[3] || 'd';
fs.mkdirSync(OUT, { recursive: true });
const bad = []; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad.push(msg); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(DEV === 'm' ? { ...devices['iPhone 13'], viewport: { width: 844, height: 390 } } : { viewport: { width: 560, height: 420 } });
  const p = await ctx.newPage(); let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  const until = (f, a, ms = 40000) => E(([f, a, ms]) => new Promise((r) => { const fn = new Function('a', 'return (' + f + ')(a)'); const t = Date.now(); const k = () => { let v = false; try { v = fn(a); } catch (e) { /* 아직 */ } return v || Date.now() - t > ms ? r(!!v) : setTimeout(k, 250); }; k(); }), [f.toString(), a, ms]);
  await p.goto('file://' + process.cwd() + '/dist/test.html?aa=1#namsongi'); await W(5000);
  await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, server: 'battle', look: o.save.look || { sex: 'm', skin: 0 }, nickSet: 1, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1 }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await W(5000); await p.click('#enter').catch(() => {}); await W(1500);
  if (await E(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await W(800); }
  if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) await p.click('#fs-tip-x').catch(() => {});
  await E(() => { const o = window.__oreum; o.pace?.test?.hold?.(); o.setWeather?.('clear'); o.setTod(14); });
  const early = await E(() => { const o = window.__oreum; return { tube: (o.tube?.props?.() || []).filter((t) => t.lo || t.hi).length, stall: (o.tok?.stallProps?.() || []).filter((t) => t.lo || t.hi).length, gong: (o.arena?.gongs?.() || []).filter((t) => t.lo || t.hi).length, jigi: o.jigi?.state?.().ready }; });
  check(!early.tube && !early.stall && !early.gong && !early.jigi, '들어오자마자는 Tripo 소품·오름지기를 받지 않음 ' + JSON.stringify(early));
  /* 터 1 바깥 문 쪽에서 */
  const A = await E(() => { const o = window.__oreum, a = o.arena.list().find((q) => q.zone === 1); return a; });
  check(!!A, '서바이벌 터 1 있음');
  const camAt = (x, z, h, tx, ty, tz) => E(([x, z, h, tx, ty, tz]) => { const o = window.__oreum; o.cam.mode = 'free'; o.camObj.position.set(x, o.groundAt(x, z) + h, z); o.camObj.lookAt(tx, ty, tz); }, [x, z, h, tx, ty, tz]);
  const hideUi = (on) => E((on) => { let st = document.getElementById('__pshot'); if (!st) { st = document.createElement('style'); st.id = '__pshot'; document.head.append(st); } st.textContent = on ? 'body > *:not(#view){visibility:hidden!important} #view{visibility:visible!important}' : ''; }, on);
  const tiles = [];
  const shot = async (n) => { const f = path.join(OUT, `_${n}.png`); await p.screenshot({ path: f }); tiles.push(f); return f; };
  if (A) {
    await E(() => window.__oreum.tok.go(1)); await W(800);
    await until(() => { const o = window.__oreum; return o.tok.stallProps().find((s) => s.zone === 1)?.hi && o.arena.gongs().find((g) => g.zone === 1)?.hi; }, null, 60000);
    const L = await E(() => { const o = window.__oreum; return { stall: o.tok.stallProps().find((s) => s.zone === 1), gong: o.arena.gongs().find((g) => g.zone === 1) }; });
    check(L.stall?.hi && L.gong?.hi, '터 1 좌판·징 큰 모델 받음 ' + JSON.stringify(L));
    await hideUi(true); await E(() => { window.__oreum.runner.root.visible = false; });
    const S = await E(() => { const s = window.__oreum.tok.stalls().find((q) => q.zone === 1); return s; });
    /* 좌판 + 주인 + 징이 한 장에: 좌판 앞 바깥에서 터 가운데 쪽으로 */
    const fx = Math.sin(A.face), fz = Math.cos(A.face), cx = S.x + fx * 6.5 + Math.cos(A.face) * 2.2, cz = S.z + fz * 6.5 - Math.sin(A.face) * 2.2;
    const gy = await E(([x, z]) => window.__oreum.groundAt(x, z), [S.x, S.z]);
    await camAt(cx, cz, 2.4, (S.x + A.x) / 2, gy + 1.1, (S.z + A.z) / 2); await W(2500); await shot('stall-wide');
    await camAt(S.fx + fx * 1.2, S.fz + fz * 1.2, 1.9, S.x, gy + 1.2, S.z); await W(1500); await shot('stall-close');
    /* 징: 앞에서, 치기 전·친 직후 */
    const gp = A.gong; await camAt(gp.x + fx * 5.5, gp.z + fz * 5.5, 1.6, gp.x, gp.y + 1.2, gp.z); await W(1500); await shot('gong');
    await E(() => window.__oreum.arena.ring(1)); await W(220);
    const sw1 = await E(() => window.__oreum.arena.gongs().find((g) => g.zone === 1).sway); await shot('gong-ring');
    await until(() => window.__oreum.arena.gongs().find((g) => g.zone === 1).t > 1.6, null, 90000); const sw2 = await E(() => window.__oreum.arena.gongs().find((g) => g.zone === 1).sway); /* 느린 GL 은 게임 시간이 천천히 감 → 징 시계로 기다림 */
    check(Math.abs(sw1) > 0.05 && Math.abs(sw2) < Math.abs(sw1) * 0.3, `징을 치면 흔들리고 잦아듦 (${sw1} → 1.6초 뒤 ${sw2})`);
    await camAt(gp.x + Math.cos(A.face) * 5, gp.z - Math.sin(A.face) * 5, 1.6, gp.x, gp.y + 1.2, gp.z); await E(() => window.__oreum.arena.ring(1)); await W(260); await shot('gong-side');
  }
  /* 들머리 투입구 */
  const T0 = await E(() => window.__oreum.tube?.list?.()[0] || null);
  check(!!T0, '투입구 있음');
  if (T0) {
    await E((id) => { const o = window.__oreum; o.cam.mode = 'follow'; o.tube.stand(id); }, T0.id); await W(500);
    await until((id) => window.__oreum.tube.props().find((t) => t.id === id)?.hi, T0.id, 60000);
    const P0 = await E((id) => window.__oreum.tube.props().find((t) => t.id === id), T0.id);
    check(P0?.hi && P0.lid === 0, '투입구 큰 모델 받음·덮개 닫힘 ' + JSON.stringify(P0));
    await E(() => { window.__oreum.runner.root.visible = false; });
    const dx = T0.fx - T0.x, dz = T0.fz - T0.z, L = Math.hypot(dx, dz) || 1, rx = dz / L, rz = -dx / L, ty = await E(([x, z]) => window.__oreum.groundAt(x, z), [T0.x, T0.z]);
    await camAt(T0.x + dx / L * 3.6 + rx * 1.6, T0.z + dz / L * 3.6 + rz * 1.6, 1.9, T0.x, ty + 0.8, T0.z); await W(1500); await shot('chute-shut');
    await E((id) => window.__oreum.tube.lid(id, 1), T0.id); await W(900);
    const P1 = await E((id) => window.__oreum.tube.props().find((t) => t.id === id), T0.id);
    check(P1?.lid === 1, '덮개 열림 ' + P1?.lid); await shot('chute-open');
    await E((id) => window.__oreum.tube.lid(id, 0), T0.id);
  }
  /* 망고: 튀는 망고 + 망고 그림 */
  await E(() => { const o = window.__oreum; o.runner.root.visible = true; o.cam.mode = 'follow'; }); await hideUi(false);
  if (A) { await E(() => window.__oreum.tok.go(1)); await W(600); }
  await E(() => window.__oreum.tok.pop(4)); await W(380);
  const pops = await E(() => window.__oreum.tok.pops());
  check(pops.length >= 3 && pops.some((q) => q.on), '튀는 망고 ' + JSON.stringify(pops));
  await E(() => { const o = window.__oreum, P = o.player.pos, h = o.player.heading; o.cam.mode = 'free'; o.camObj.position.set(P.x - Math.sin(h) * 5, P.y + 3, P.z - Math.cos(h) * 5); o.camObj.lookAt(P.x, P.y + 2, P.z); });
  await shot('mango-pop');
  const done = await until(() => window.__oreum.tok.pops().every((q) => !q.on), null, 10000);
  check(done, '튄 망고는 끝나면 안 그림');
  const ic = await E(() => { const i = document.querySelector('#where-tok img.tok-ic'); return i ? { ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth } : null; });
  check(ic?.ok, '망고 그림 ' + JSON.stringify(ic));
  if (tiles.length) {
    cp.execFileSync('python3', ['-c', `import sys
from PIL import Image
out=sys.argv[1]; fs=sys.argv[2:]
ims=[Image.open(f).convert('RGB') for f in fs]
w,h=ims[0].size; k=420/w; ims=[i.resize((int(w*k),int(h*k))) for i in ims]; w,h=ims[0].size
per=3; rows=(len(ims)+per-1)//per
o=Image.new('RGB',(w*per,h*rows),(20,20,20))
for i,im in enumerate(ims): o.paste(im,((i%per)*w,(i//per)*h))
o.save(out+'/props.jpg',quality=72)`, OUT, ...tiles]);
    tiles.forEach((f) => fs.unlinkSync(f));
  }
  check(errs === 0, '페이지 오류 없음');
  console.log(bad.length ? '실패 ' + bad.length : '모두 통과'); await b.close(); process.exit(bad.length ? 1 : 0);
})();
