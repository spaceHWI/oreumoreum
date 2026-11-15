const {chromium}=require('playwright');
(async()=>{const [,, vp, ...shots]=process.argv;const [w,h]=vp.split('x').map(Number);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1,hasTouch:w<h,isMobile:w<h});
const errs=[];pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text().slice(0,400))});pg.on('pageerror',e=>errs.push('PE '+e.message));
await pg.goto('file://'+__dirname+'/dist/test.html');await pg.waitForTimeout(6000);
for(const s of shots){const [name,json]=s.split('=');await pg.evaluate(o=>window.__d.set(o),JSON.parse(json));await pg.waitForTimeout(3500);await pg.screenshot({path:__dirname+'/dist/'+name+'.png'});console.log(name,JSON.stringify(await pg.evaluate(()=>window.__d.info())))}
console.log(errs.slice(0,8).join('\n'));await b.close()})();
