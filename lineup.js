const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:1400,height:700}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+process.cwd()+'/dist/test.html#darangswi'); await p.waitForTimeout(3000);
 await p.click('#enter'); await p.waitForTimeout(500);
 await p.evaluate(()=>{
  const o=window.__oreum; o.setTod(10);
  const H=o.height; const sx=0, sz=o.spots.start.z-6;
  o.runner.root.visible=false;
  document.querySelectorAll('.hud,.pad,.dock,#ach-chip,#hint,#compass').forEach(e=>e.style.visibility='hidden');
  // 지오메트리·메시 생성자 빌려오기
  let Box=null, Sphere=null, Cone=null, MeshC=null, Mat=null, Group=null;
  o.scene.traverse(m=>{ if(m.isMesh){ MeshC=MeshC||m.constructor; const t=m.geometry.type; if(t==='BoxGeometry')Box=Box||m.geometry.constructor; if(t==='SphereGeometry')Sphere=Sphere||m.geometry.constructor; if(t==='ConeGeometry')Cone=Cone||m.geometry.constructor; } if(m.isGroup) Group=Group||m.constructor; });
  const mk=(opts, outfit)=>{ const r=o.buildRunner(opts); r.apply({...o.save.outfit, ...(outfit||{})}); return r; };
  const outfit=JSON.parse(JSON.stringify(o.save.outfit));
  const labels=[];
  // A. 지금 + 다듬기: 머리 조금 크게, 눈 크게
  const A=mk({}); { const P=A.root.userData.parts; P.head.scale.setScalar(1.12); P.eyes.forEach(e=>e.scale.set(1.5,1.4,1)); }
  // B. 치비: 머리 1.5배, 다리 짧게, 몸 통통
  const B=mk({}); { const P=B.root.userData.parts; P.head.scale.setScalar(1.55); P.head.position.y-=0.02; P.legL.scale.y=0.62; P.legR.scale.y=0.62; P.hips.position.y=0.49; P.torso.scale.set(1.15,0.9,1.15); P.armL.scale.set(1,0.8,1); P.armR.scale.set(1,0.8,1); P.eyes.forEach(e=>e.scale.set(1.6,1.6,1)); }
  // C. 블록(SULFUR 레트로): 머리·몸을 각지게
  const C=mk({}); { const P=C.root.userData.parts; P.skull.geometry=new Box(0.92,0.86,0.9); P.hair.children.forEach(h=>{ h.geometry=new Box(0.98,0.42,0.96); h.scale.set(1,1,1); h.position.set(0,0.3,-0.02); }); P.head.scale.setScalar(1.1); P.chest.scale.set(1.1,1,1.15); P.smile.visible=false; const mouth=new MeshC(new Box(0.26,0.05,0.04), P.mats.black); mouth.position.set(0,-0.17,0.47); P.head.add(mouth); P.eyes.forEach(e=>{ e.geometry=new Box(0.1,0.12,0.04); }); }
  // D. 미니멀 실루엣(Sky 풍): 얼굴 점만, 후드 망토
  const D=mk({hair:'bald'}, {hat:{type:'none',color:'#000',back:false}, glasses:{type:'none'}, vest:{type:'none',color:'#000'}}); { const P=D.root.userData.parts; P.head.scale.setScalar(1.2); P.smile.visible=false; P.eyes.forEach(e=>{ e.geometry=new Sphere(0.04,8,6); e.scale.set(1,1.6,1); }); const capeMat=P.mats.vest.clone(); capeMat.color.set('#c9775a'); const cape=new MeshC(new Cone(0.62,1.25,8,1,true), capeMat); cape.position.set(0,0.55,-0.1); P.torso.add(cape); const hood=new MeshC(new Sphere(0.56,16,12,0,Math.PI*2,0,Math.PI*0.62), capeMat); hood.position.set(0,0.1,-0.04); hood.rotation.x=-0.15; P.head.add(hood); P.mats.skin.color.set('#f6dcc4'); }
  [[A,-4.5],[B,-1.5],[C,1.5],[D,4.5]].forEach(([r,x])=>{ r.root.position.set(sx+x, H(sx+x,sz), sz); r.root.rotation.y=0; o.scene.add(r.root); r.animate(0.016,{speed:0,running:false,pose:'move',t:0,breath:0}); });
  o.tp(sx, sz+9, Math.PI, -0.02, 0.6); o.cam.yaw=0; o.cam.pitch=0.02; o.cam.dist=0.5; o.snap();
  o.camObj.position.set(sx, H(sx,sz)+1.7, sz+8.5); o.camObj.lookAt(sx, H(sx,sz)+1.1, sz);
 });
 await p.waitForTimeout(3000);
 await p.screenshot({path:'dist/char-lineup-retro.png',timeout:90000});
 await p.evaluate(()=>{ window.__oreum.save.gfx='smooth'; document.getElementById('menu-gfx').click(); document.getElementById('menu-gfx').click(); });
 await p.waitForTimeout(2500);
 await p.screenshot({path:'dist/char-lineup-smooth.png',timeout:90000});
 await b.close();
})();
