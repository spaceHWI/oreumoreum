// node reel.js [every=1] [scale=1]  → reel4/f%04d.jpg
const { chromium } = require('playwright');
const EVERY = +(process.argv[2]||1), SC = +(process.argv[3]||1), ONLY = process.argv[4] === undefined ? -1 : +process.argv[4], FPS = 30, W = 1080*SC, H = 1920*SC;
const lerp=(a,b,t)=>a+(b-a)*t, ease=t=>t*t*(3-2*t);
// shots: [frames, fn(u)->state]
const SHOTS = [
 { n: 96, f: u => ({ idx: lerp(6, 12.5, u), tod: 16.0, look: 1, yaw: lerp(-0.25, 0.1, ease(u)), pitch: 0.2, dist: lerp(7.5, 9.5, u), run: 1 }) },
 { n: 144, f: u => ({ idx: lerp(250, 260, u), tod: 16.5, yaw: lerp(2.9, 3.12, ease(u)), pitch: 0.17, dist: lerp(8, 8.8, u), run: 1 }) },
 { n: 75, f: u => ({ idx: lerp(408, 413.5, u), tod: 16.9, yaw: lerp(-0.35, 0, ease(u)), pitch: 0.16, dist: lerp(11, 8.5, u), run: 1 }) },
 { n: 135, f: u => ({ pos: [0, -112], h: 0, tod: lerp(17.12, 17.28, u), yaw: lerp(4.45, 5.1, ease(u)), pitch: lerp(0.15, 0.2, ease(u)), dist: lerp(9, 26, ease(u)), run: 0, pose: u > 0.25 && u < 0.7 ? 'photo' : 'breath' }) },
];
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:W,height:H}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+process.cwd()+'/dist/test.html?hi#darangswi'); await p.waitForTimeout(5000);
 await p.click('#enter-quiet').catch(()=>{}); await p.waitForTimeout(1500);
 await p.evaluate(()=>{
  const st=document.createElement('style'); st.textContent='body > *:not(canvas):not(#promo){display:none!important} #promo{position:fixed;left:0;right:0;top:13%;text-align:center;color:#fffaf0;font-family:Jua,"Noto Sans KR",sans-serif;text-shadow:0 0.04em 0.25em rgba(60,30,20,.45);pointer-events:none;opacity:0} #promo b{display:block;font-weight:400;font-size:13.5vw;letter-spacing:.04em} #promo span{display:block;font-size:4.4vw;margin-top:1.2vw;font-family:"Noto Sans KR",sans-serif;font-weight:500;letter-spacing:.08em}'; document.head.append(st);
  const d=document.createElement('div'); d.id='promo'; d.innerHTML='<b>오름오름</b><span>조용히 걷는 제주 오름</span>'; document.body.append(d);
  const o=window.__oreum; const orig=o.runner.animate; o.runner.animate=(dt,a)=>orig(dt,{...a,...(window.__force||{})});
  // rAF 수동 구동
  let cbs=[]; const real=window.requestAnimationFrame; window.requestAnimationFrame=(f)=>{ cbs.push(f); return 0; };
  window.__t=performance.now()+100; real(()=>{}); 
  window.__step=(dtMs)=>{ window.__t+=dtMs; const c=cbs; cbs=[]; c.forEach(f=>f(window.__t)); };
  window.__set=(s)=>{ const t=o.trail; let x,z,h; if(s.pos){ x=s.pos[0]; z=s.pos[1]; h=s.h; } else { const i=Math.floor(s.idx), k=s.idx-i; const a=t[i], c=t[i+1], e=t[Math.min(t.length-1,i+2)]; x=a.x+(c.x-a.x)*k; z=a.y+(c.y-a.y)*k; const dx=lerp2(c.x-a.x,e.x-c.x,k), dz=lerp2(c.y-a.y,e.y-c.y,k); h=Math.atan2(dx,dz); }
   let yaw=s.yaw; if(s.look){ yaw = Math.atan2(x, z) - h - Math.PI + s.yaw; } o.setTod(s.tod); o.tp(x,z,h,s.pitch,s.dist,yaw); window.__force = s.run ? {speed:7,running:true,pose:'move',air:false} : {speed:0,running:false,pose:s.pose||'breath',breath:0.3+0.3*Math.sin(window.__t/700),air:false}; document.getElementById('promo').style.opacity=s.title||0; };
  function lerp2(a,b,t){return a+(b-a)*t;}
 });
 await p.waitForTimeout(600); // 남은 실제 rAF 한 번이 돌게
 let fr=0;
 for (const [si, sh] of SHOTS.entries()) {
  if (ONLY >= 0 && si !== ONLY) { fr += sh.n; continue; }
  // 컷 전 준비: 풀 심기
  if (EVERY===1) for (let w=0;w<28;w++){ await p.evaluate(s=>{ window.__set(s); window.__step(1); }, sh.f(0)); }
  for (let i=0;i<sh.n;i++,fr++) {
   const s=sh.f(i/(sh.n-1));
   if (EVERY>1 && i%EVERY!==0) continue;
   if (EVERY>1) for (let w=0;w<6;w++) await p.evaluate(s=>{ window.__set(s); window.__step(1); }, s);
   await p.evaluate(s=>{ window.__set(s); window.__step(1000/30); }, s);
   await p.screenshot({path:`reel4/f${String(fr).padStart(4,'0')}.jpg`,type:'jpeg',quality:93,timeout:120000});
   if (fr%10===0) console.log('frame',fr, new Date().toISOString().slice(11,19));
  }
 }
 await b.close(); console.log('done');
})();
