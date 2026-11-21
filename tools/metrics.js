// 이용 통계 확인 (#121): node tools/metrics.js — dist/test.html 을 열어 들어간 뒤 사건을 흉내 내고, 보낸 묶음(POST /m)을 가로채 본다
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  const got = []; const reqs = [];
  p.on('request', (r) => reqs.push(r.url()));
  await p.route(/\/m$/, (r) => { got.push(r.request().postData()); r.fulfill({ status: 200, body: '{"ok":true}', headers: { 'content-type': 'application/json' } }); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(5000);
  const r = await p.evaluate(async () => {
    const O = window.__oreum, M = O.metrics;
    O.ach.emit('trash'); O.ach.emit('dex'); O.ach.emit('gear-buy-tool'); O.ach.emit('ride-buy-bike'); O.ach.emit('enemy-repel-boar'); O.ach.emit('emote'); O.ach.emit('down');
    O.save.coins += 30; M.sample(); O.save.coins -= 10; M.sample();
    const peek = M.peek(); const sess = M.session(); const loc = M.local();
    M.flush();
    return { peek, sess: { isNew: sess.isNew, play: sess.play }, loc, sent: M.sent(), src: M.src() };
  });
  await p.waitForTimeout(500);
  console.log(JSON.stringify(r.peek)); console.log('session', JSON.stringify(r.sess), 'local', JSON.stringify(r.loc), 'src', r.src);
  console.log('sent', JSON.stringify(r.sent), 'beacons', got.length, got.map((g) => (g || '').length));
  if (got[0]) console.log('body', got[0].slice(0, 400));
  await b.close();
})();
