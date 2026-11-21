// WebGL 을 잃은 바로 그 프레임 확인 (#197): node tools/gllost.js $PWD [lose|null]  (먼저 node build.mjs)
// lose: 진짜로 잃게 한 뒤(WEBGL_lose_context) 같은 프레임에 새 재질을 그림 → 'threw' 가 null 이고 안내가 뜨고, 되살리면 다시 그려야 함. null: iOS 처럼 getShaderInfoLog 만 null
const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:480,height:300}});
 const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,200))); p.on('console',m=>{ if(m.type()==='error') errs.push('CON '+m.text().slice(0,200)); });
 await p.addInitScript(()=>{ for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) { if (!C) continue; const f = C.prototype.getShaderInfoLog; C.prototype.getShaderInfoLog = function(s){ return window.__nullLog ? null : f.call(this, s); }; } });
 await p.goto('file://'+process.argv[2]+'/dist/test.html#namsongi'); await p.waitForTimeout(6000);
 await p.click('#enter').catch(()=>{}); await p.waitForTimeout(5000);
 const before = errs.length;
 const r = await p.evaluate(async (mode)=>{
   const o = window.__oreum, R = o.renderer, gl = R.getContext();
   const out = {};
   // 장면·카메라 찾기
   const scene = o.scene, cam = o.camObj; out.have = !!(scene && cam);
   if (!out.have) return out;
   // 새 재질(새 프로그램)을 가진 물체를 카메라 앞에
   const anyMesh = (()=>{ let m=null; scene.traverse(x=>{ if(!m && x.isMesh && x.material && !Array.isArray(x.material)) m=x; }); return m; })();
   const mat = anyMesh.material.clone(); mat.defines = Object.assign({}, mat.defines, { REPRO197: 1 }); mat.needsUpdate = true; // 새 프로그램이 되게
   const mesh = new anyMesh.constructor(anyMesh.geometry, mat); mesh.frustumCulled = false; scene.add(mesh);
   const ext = gl.getExtension('WEBGL_lose_context');
   if (mode === 'lose') { ext.loseContext(); out.lostNow = gl.isContextLost(); }
   else { // WebKit 흉내: 프로그램 글은 '' 인데 셰이더 글은 null
     window.__nullLog = true;
   }
   try { R.render(scene, cam); out.threw = null; } catch (e) { out.threw = String(e).slice(0,200); }
   window.__nullLog = false; await new Promise(r=>setTimeout(r,1500));
   out.lostShownMid = !document.getElementById("gl-lost").hidden;
   if (mode === 'lose') { const f0 = R.info.render.frame; ext.restoreContext(); await new Promise(r=>setTimeout(r,3000)); out.restored = !gl.isContextLost(); out.framesAfterRestore = R.info.render.frame - f0; }
   out.lostShown = !document.getElementById("gl-lost").hidden;
   return out;
 }, process.argv[3]||'lose');
 console.log(JSON.stringify(r)); await p.waitForTimeout(1500);
 console.log('errors after:', errs.slice(before).join('\n  ') || '(없음)');
 console.log('frames', await p.evaluate(()=>window.__oreum.renderer.info.render.frame));
 await b.close();
})();
