// 캐릭터 얼굴 확인용: node tools/face.js 이름  →  dist/face-<이름>-{close,far}.png (정면·옆·3/4·뒤)
const { chromium } = require('playwright');
(async()=>{
 const out=process.argv[2]||'x';
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:760,height:300}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+process.cwd()+'/dist/test.html#namsongi'); await p.waitForTimeout(6000);
 await p.click('#enter-quiet').catch(()=>{}); await p.waitForTimeout(1500);
 const setup = async (offs, dist, fov, gap, lift) => { await p.evaluate(([dist,fov])=>{ const o=window.__oreum; o.setTod(11); document.body.style.visibility='hidden'; o.renderer.domElement.style.visibility='visible';
   const s=o.spots.start; o.tp(s.x, s.z, 0, 0.02, dist, 0); o.camObj.fov=fov; o.camObj.updateProjectionMatrix(); }, [dist,fov]);
  await p.waitForTimeout(2500);
  await p.evaluate(([offs,gap,lift,dist])=>{ const o=window.__oreum; o.runner.root.visible=false; (window.__rs||[]).forEach(r=>r.root.removeFromParent()); window.__rs=[];
   const c=o.camObj.position, H=o.height; const dv=new c.constructor(); o.camObj.getWorldDirection(dv); const s={x:c.x+dv.x*dist, z:c.z+dv.z*dist}; const base=JSON.parse(JSON.stringify(o.save.outfit||{}));
   const fx=c.x-s.x, fz=c.z-s.z, L=Math.hypot(fx,fz), rx=fz/L, rz=-fx/L, face=Math.atan2(fx,fz);
   offs.forEach((yo,i)=>{ const r=o.buildRunner(); r.apply(base); const k=(i-(offs.length-1)/2)*gap; const x=s.x+rx*k, z=s.z+rz*k; r.root.position.set(x,H(x,z)+lift,z); r.root.rotation.y=face+yo; o.scene.add(r.root); for(let j=0;j<3;j++) r.animate(0.033,{running:false,t:0.3,breath:0,speed:0,pose:'move'}); window.__rs.push(r); }); }, [offs,gap,lift,dist]);
  await p.waitForTimeout(3000); };
 await setup([0, Math.PI/2, Math.PI*0.25, Math.PI], 4, 16, 0.9, -0.25); await p.screenshot({path:`dist/face-${out}-close.png`});
 await setup([0, Math.PI/2, -Math.PI/2, Math.PI], 16, 22, 1.5, 0); await p.screenshot({path:`dist/face-${out}-far.png`});
 await b.close();
})();
