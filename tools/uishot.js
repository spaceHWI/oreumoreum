const { chromium, devices } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for (const mob of [true]) {
  const ctx = await b.newContext(mob ? { ...devices['iPhone 13'] } : { viewport:{width:1040,height:600} });
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file://'+process.cwd()+'/dist/test.html#namsongi'); await p.waitForTimeout(5000);
  const n=mob?'m':'d';
  await p.screenshot({path:`dist/u-${n}0.png`,timeout:150000});
  await p.click('#enter').catch(()=>{}); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ const o=window.__oreum; o.setTod(15); o.save.tut.done=true; document.body.classList.remove('tut'); const h=document.getElementById('tut-toast'); if(h) h.hidden=true; });
  await p.waitForTimeout(4000); await p.screenshot({path:`dist/u-${n}1.png`,timeout:150000});
  await p.click('#btn-menu'); await p.waitForTimeout(1200); await p.screenshot({path:`dist/u-${n}2.png`,timeout:150000});
  await p.evaluate(()=>{document.getElementById('menu').hidden=true; document.getElementById('ach-chip').click()}); await p.waitForTimeout(1200); await p.screenshot({path:`dist/u-${n}3.png`,timeout:150000});
  await ctx.close();
 }
 await b.close();
})();
