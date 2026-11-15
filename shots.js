const { chromium, devices } = require('playwright');
// node shots.js map tod name [mobile]
(async()=>{
 const [map='darangswi', tod='10', name='a', mob] = process.argv.slice(2);
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx = await b.newContext(mob ? { ...devices['iPhone 13'] } : { viewport:{width:1280,height:640} });
 const p = await ctx.newPage();
 p.on('pageerror',e=>console.log('ERR',e.message)); let nc=0; p.on('console',m=>{ if((m.type()==='error'||/shader/i.test(m.text()))&&nc++<3) console.log('CON',m.text().slice(0,600)); });
 await p.goto('file://'+process.cwd()+'/dist/test.html#'+map); await p.waitForTimeout(4000);
 await p.click('#enter-quiet').catch(()=>{}); await p.waitForTimeout(800);
 await p.evaluate((t)=>{ const o=window.__oreum; o.setTod(+t); }, tod);
 await p.waitForTimeout(6000);
 await p.screenshot({path:`dist/s-${name}.png`,timeout:120000});
 const info = await p.evaluate(()=>{ const r=window.__oreum.renderer.info; return {tris:r.render.triangles, calls:r.render.calls}; });
 console.log(name, JSON.stringify(info));
 await b.close();
})();
