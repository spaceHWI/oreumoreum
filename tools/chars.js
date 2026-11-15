const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:1040,height:520}});
 p.on('pageerror',e=>console.log('ERR',e.message)); let nc=0; p.on('console',m=>{ if(m.type()==='error'&&nc++<4) console.log('CON',m.text().slice(0,500)); });
 await p.goto('file://'+process.cwd()+'/dist/test.html'+(process.argv[2]?'?fov='+process.argv[2]:'')+'#darangswi'); await p.waitForTimeout(3500);
 await p.click('#enter-quiet'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ const o=window.__oreum; o.setTod(11); o.runner.root.visible=false; document.querySelectorAll('.hud,.pad,.dock,#ach-chip,#hint,#compass,#toast').forEach(e=>e.style.visibility='hidden');
  const sx=0, sz=o.spots.start.z-6, H=o.height;
  const base=JSON.parse(JSON.stringify(o.save.outfit));
  const V=[[{}, {speed:0,pose:'move'}], [{}, {speed:7,running:true,pose:'move'},9], [{shirt:{color:'#e9719a'},hat:{color:'#f2c94c'},pants:{color:'#4a5a78'},shoes:{color:'#e2683c'}}, {speed:3,pose:'move'},14], [{shirt:{color:'#3e8f5a'},hat:{color:'#2b2b33'}}, {speed:0,pose:'wave',t:0.3}], [{shirt:{color:'#7fb8e8'},hat:{color:'#e2683c'},pants:{color:'#7a6a55'}}, {speed:0,pose:'sit',t:0.3}], [{}, {speed:0,pose:'photo',t:0.3}]];
  V.forEach(([v,a,steps],i)=>{ const r=o.buildRunner(); r.apply({...base,...v}); const x=sx+(i-2.5)*1.9; r.root.position.set(x,H(x,sz),sz); r.root.rotation.y = i===1? 1.2 : i===2 ? -0.8 : 0; o.scene.add(r.root); for(let k=0;k<(steps||3);k++) r.animate(0.033,{running:false,t:0.3,breath:0,...a}); });
  o.tp(sx, sz+9, Math.PI, 0, 0.5); o.cam.mode='free'; o.camObj.fov=+(new URLSearchParams(location.search).get('fov')||30); o.camObj.updateProjectionMatrix(); o.camObj.position.set(sx, H(sx,sz)+2.2, sz+13.5); o.camObj.lookAt(sx, H(sx,sz)+1.2, sz); });
 await p.waitForTimeout(3000);
 await p.screenshot({path:'dist/v-chars2.png',timeout:90000});
 await b.close();
})();
