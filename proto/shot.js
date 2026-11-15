const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const jobs = process.argv.slice(2).map(a=>a.split(':'));
 for (const [mood, shot, extra] of jobs) {
  const p = await b.newPage({viewport:{width:1280,height:720}});
  p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{ if(m.type()==='error') console.log('CON', m.text().slice(0,300)); });
  await p.goto('file://'+process.cwd()+`/proto/index.html?style=${mood}&shot=${shot}${extra?'&'+extra:''}`);
  await p.waitForFunction(()=>window.__ready>=3, null, {timeout:150000}).catch(e=>console.log('timeout'));
  console.log(mood, JSON.stringify(await p.evaluate(()=>window.__info))); await p.screenshot({path:`proto/out-${mood}-${shot}${extra?"-"+extra.replace(/[^a-z_]/g,""):""}.png`,timeout:120000}); await p.close();
 }
 await b.close();
})();
