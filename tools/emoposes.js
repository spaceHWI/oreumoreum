// 동작마다 캐릭터 포즈 (#76): node tools/emoposes.js → dist/emo-poses/*.png
const { chromium } = require('playwright');
const fs = require('fs');
let T = { wave: 0.6, insa: 0.8, five: 0.55, come: 0.5, point: 0.6, follow: 0.6, wait: 0.6, help: 0.5, trash: 0.6, thumb: 0.6, no: 0.5, thanks: 0.9, sorry: 0.6, clap: 0.5, hop: 0.33, laugh: 0.6, wow: 0.22, sad: 0.9, heart: 0.8, dance: 0.5, sitg: 1.0, lie: 1.2 };
(async()=>{
 fs.mkdirSync('dist/emo-poses', { recursive: true });
 if (process.argv[3]) T = Object.fromEntries(process.argv[3].split(',').map((k) => [k, 0.6]));
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:320,height:400}}); p.on('pageerror',e=>console.log('ERR',e.message));
 const view = process.argv[2] || 'front3';
 await p.goto(`file://${process.cwd()}/dist/char-motion.html?one&noui&view=${view}&h=${process.argv[4] || -0.5}&slope=0&speed=0&phase=0&fov=26`); await p.waitForTimeout(1500);
 for (const [id, t] of Object.entries(T)) {
  await p.evaluate(([id, t]) => { const c = window.__char; c.state.pose = id; c.reset(); const n = Math.round(t * 60); for (let i = 0; i < n; i++) c.step(1 / 60); c.render(); }, [id, t]);
  await p.screenshot({ path: `dist/emo-poses/${id}.png` });
 }
 await b.close();
})();
