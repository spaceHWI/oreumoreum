const { chromium, devices } = require('playwright');
const OUT='/tmp/claude-0/-home-claude/c2a85875-30d7-558f-b650-0d4ff72ce65f/scratchpad/pack/';
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:1100,height:620}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+process.cwd()+'/dist/test.html#donnaeko'); await p.waitForTimeout(3500);
 await p.click('#enter'); await p.waitForTimeout(500);
 await p.evaluate(()=>{const o=window.__oreum; o.setTod(10); o.tp(0, 300, Math.PI, 0.2, 8);}); await p.waitForTimeout(3500);
 await p.screenshot({path:OUT+'08-donnaeko-forest.png',timeout:90000});
 await p.evaluate(()=>{const o=window.__oreum; o.tp(0, -380, Math.PI, 0.05, 8);}); await p.waitForTimeout(3500);
 await p.screenshot({path:OUT+'09-donnaeko-wall.png',timeout:90000});
 await p.click('#btn-menu'); await p.waitForTimeout(300); await p.screenshot({path:OUT+'10-menu.png',timeout:90000});
 await p.click('#menu-shop'); await p.waitForTimeout(500); await p.screenshot({path:OUT+'11-shop.png',timeout:90000});
 await p.click('#shop-close'); await p.click('#btn-menu'); await p.click('#menu-wardrobe'); await p.waitForTimeout(3000); await p.screenshot({path:OUT+'12-wardrobe.png',timeout:90000});
 await b.close();
})();
