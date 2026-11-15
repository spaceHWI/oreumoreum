// node view.js map [mobile|-] [lo|hi] 'tod,name,x,z,h,pitch,dist,yaw' ...
const { chromium, devices } = require('playwright');
(async()=>{
 const [map,mob,tier,...shots] = process.argv.slice(2);
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx = await b.newContext(mob==='mobile' ? { ...devices['iPhone 13'] } : { viewport:{width:1040,height:560} });
 const p = await ctx.newPage(); let nc=0;
 p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{ if((m.type()!=='log')&&nc++<6) console.log('CON',m.text().slice(0,600)); });
 await p.goto('file://'+process.cwd()+'/dist/test.html'+(tier==='hi'?'?hi':tier.startsWith('?')?tier:'')+'#'+map); await p.waitForTimeout(4000);
 await p.click('#enter-quiet').catch(()=>{}); await p.waitForTimeout(800);
 for (const s of shots) { const [tod,name,x,z,h,pitch,dist,yaw]=s.split(',');
  await p.evaluate(([t,x,z,h,pitch,dist,yaw])=>{ const o=window.__oreum; o.setTod(+t); document.querySelectorAll('.hud,.pad,.dock,#ach-chip,#hint,#compass,#toast').forEach(e=>e.style.visibility='hidden'); if(x!==undefined&&x!=='') o.tp(+x,+z,+h,+(pitch||0.2),+(dist||13),+(yaw||0)); }, [tod,x,z,h,pitch,dist,yaw]);
  await p.waitForTimeout(5000);
  await p.screenshot({path:`dist/s-${name}.png`,timeout:120000});
  console.log(name, JSON.stringify(await p.evaluate(()=>window.__oreum.renderer.info.render)));
 }
 await b.close();
})();
