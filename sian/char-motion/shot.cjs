// node sian/char-motion/shot.cjs out.png 'query' [frames]  — 동작 확인 페이지를 소프트웨어 GL로 찍는다
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const [out, qs, frames] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => console.log('ERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 300)); });
  await p.goto('file://' + process.cwd() + '/dist/char-motion.html?' + (qs || '') + '&phase=0');
  await p.waitForTimeout(800);
  const list = (frames || '0').split(',');
  for (let i = 0; i < list.length; i++) {
    await p.evaluate((ph) => window.__char.at(+ph), list[i]);
    await p.screenshot({ path: out.replace('.png', `-${i}.png`) });
  }
  await b.close();
})();
