// node tools/ridecam.js : 걸을 때·노루 탈 때 카메라 끝까지 올려다보기/내려다보기 실제 각도 (#170)
const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:480,height:300}});
 p.on('pageerror',e=>console.log('ERR',e.message.slice(0,300)));
 await p.goto('file://'+process.cwd()+'/dist/test.html#namsongi'); await p.waitForTimeout(6000);
 await p.click('#enter').catch(()=>{}); await p.waitForTimeout(5000);
 const r = await p.evaluate(()=>{
  const o = window.__oreum, P = o.player, H = o.height, cam = o.cam, C = o.camObj;
  // 평지와 오르막 찾기
  const x0 = P.pos.x, z0 = P.pos.z; let flat = null, up = null, best = 0;
  for (let i = 0; i < 4000; i++) { const x = x0 + (Math.random() - 0.5) * 300, z = z0 + (Math.random() - 0.5) * 300; const gx = (H(x + 1, z) - H(x - 1, z)) / 2, gz = (H(x, z + 1) - H(x, z - 1)) / 2, g = Math.hypot(gx, gz); if (g < 0.03 && !flat) flat = { x, z, h: 0 }; if (g > best && g < 0.6) { best = g; up = { x, z, h: Math.atan2(gx, gz), g: +g.toFixed(2) }; } }
  const pitches = [-0.6, 0.32, 1.25, 1.4];
  const measure = (s) => { const out = {}; const sp = P.pos.clone(), sv = P.visY, sh = P.heading, sy = cam.yaw, spc = cam.pitch, sd = cam.dist;
   P.pos.set(s.x, H(s.x, s.z), s.z); P.visY = P.pos.y; P.heading = s.h; cam.yaw = s.h + Math.PI; cam.dist = 13; o.state && (o.state.awe = 0);
   for (const pt of pitches) { cam.pitch = pt; o.snap(); C.updateMatrixWorld(); const d = cam.look.clone().sub(C.position); const el = Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180 / Math.PI;
    // 캐릭터 머리가 화면 어디(-1 아래 ~ 1 위)에 보이는지
    const hv = P.pos.clone(); hv.y = P.visY + (P.riding ? 2.2 : 1.2); hv.project(C); const ft = P.pos.clone(); ft.y = P.visY; ft.project(C); out[pt] = { el: +el.toFixed(1), body: +hv.y.toFixed(2), feet: +ft.y.toFixed(2), dist: +C.position.distanceTo(cam.look).toFixed(1) }; }
   P.pos.copy(sp); P.visY = sv; P.heading = sh; cam.yaw = sy; cam.pitch = spc; cam.dist = sd; return out; };
  const res = { up };
  res.walkFlat = measure(flat); res.walkUp = measure(up);
  P.riding = o.life.deer[0]; const riding = !!P.riding;
  res.ride = riding; res.rideFlat = measure(flat); res.rideUp = measure(up); res.fov = C.fov; P.riding = null;
  return res; });
 console.log(JSON.stringify(r, null, 1)); await b.close();
})();
