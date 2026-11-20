const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:480,height:300}}); let n=0;
 p.on('pageerror',e=>console.log('ERR',e.message.slice(0,300))); p.on('console',m=>{ if(m.type()==='error'&&n++<3) console.log('CON',m.text().slice(0,900)); });
 await p.goto('file://'+process.cwd()+'/dist/test.html#namsongi'); await p.waitForTimeout(6000);
 await p.click('#enter').catch(()=>{}); await p.waitForTimeout(6000);
 console.log('frames', await p.evaluate(()=>window.__oreum.renderer.info.render.frame));
 await b.close();
})();
