const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:320,height:200}});
 await p.goto('file://'+process.cwd()+'/dist/test.html#darangswi'); await p.waitForTimeout(3500);
 await p.click('#enter').catch(()=>{}); await p.waitForTimeout(500);
 console.log(JSON.stringify(await p.evaluate(()=>{ const o=window.__oreum; const t=o.trail; const pick=[0,20,40,60,80,100,150,200,250,300,400,t.length-1].filter(i=>i<t.length).map(i=>[i,Math.round(t[i].x),Math.round(t[i].y),Math.round(o.height(t[i].x,t[i].y))]); return {n:t.length,pick,spots:Object.fromEntries(Object.entries(o.spots).filter(([k,v])=>v&&v.x!==undefined).map(([k,v])=>[k,[Math.round(v.x),Math.round(v.z??v.y)]])), kids:[...document.body.children].map(e=>e.tagName+'#'+e.id).join(' ')}; })));
 await b.close();
})();
