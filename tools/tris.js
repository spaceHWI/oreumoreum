const { chromium } = require('playwright');
(async()=>{
 const map=process.argv[2]||'darangswi';
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:640,height:320}});
 await p.goto('file://'+process.cwd()+'/dist/test.html#'+map); await p.waitForTimeout(4000);
 await p.click('#enter-quiet').catch(()=>{}); await p.waitForTimeout(3000);
 const r = await p.evaluate(()=>{ const out=[]; window.__oreum.scene.traverse(o=>{ if(!o.isMesh||!o.visible) return; const g=o.geometry; const n=(g.index?g.index.count:g.attributes.position.count)/3; const inst=o.isInstancedMesh?o.count:(g.isInstancedBufferGeometry?g.instanceCount:1); out.push([Math.round(n*inst), o.name||o.material.type, inst]); }); const agg={}; out.forEach(([t,n])=>agg[n]=(agg[n]||0)+t); out.sort((a,b)=>b[0]-a[0]); return {top:out.slice(0,14), total:out.reduce((s,a)=>s+a[0],0)}; });
 console.log(JSON.stringify(r));
 await b.close();
})();
