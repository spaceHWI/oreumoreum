const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:960,height:540}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+process.cwd()+'/dist/test.html#darangswi'); await p.waitForTimeout(3000);
 await p.click('#enter'); await p.waitForTimeout(500);
 await p.evaluate(()=>{const o=window.__oreum; o.setTod(9.5); document.querySelectorAll('.hud,.pad,.dock,#ach-chip,#hint,#compass,#toast').forEach(e=>e.style.visibility='hidden');});
 const scenes = [ ()=>{const o=window.__oreum; o.tp(0,-205, Math.PI, 0.22, 7.5, 0.9);}, ()=>{const o=window.__oreum; const c=o.spots.cairns[0].pos; o.tp(c.x+6,c.z+9, Math.atan2(-6,-9), 0.3, 8);} ];
 const variants = [
  ['A-cartoon', (r)=>{ r.on=true; r.setMode('toon'); }],
  ['B-bold', (r)=>{ r.on=true; r.setMode('toon'); r.uniforms.uLevels.value=8; r.uniforms.uOutline.value=1.0; r.uniforms.uSat.value=1.25; r.uniforms.uEdgePx.value=2.2; }],
  ['C-pastel', (r)=>{ r.on=true; r.setMode('toon'); r.uniforms.uLevels.value=28; r.uniforms.uOutline.value=0.35; r.uniforms.uSat.value=0.95; r.uniforms.uEdgePx.value=1.4; }],
  ['D-retro', (r)=>{ r.on=true; r.setMode('retro'); }],
  ['E-smooth', (r)=>{ r.on=false; }],
 ];
 for (let si=0; si<scenes.length; si++) {
   await p.evaluate(scenes[si]); await p.waitForTimeout(2500);
   for (const [name, fn] of variants) {
     await p.evaluate((f)=>{ const r=window.__oreum.retro; (new Function('r', `(${f})(r)`))(r); }, fn.toString());
     await p.waitForTimeout(900);
     await p.screenshot({path:`dist/gfx-${si}-${name}.png`,timeout:90000});
   }
 }
 await b.close();
})();
