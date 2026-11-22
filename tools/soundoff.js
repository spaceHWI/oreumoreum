// 소리를 끈 채 시작한 사람 확인 (#217): 소리 장치(sound.ctx)가 한 번도 안 켜진 채로 연출 감독의 조짐(까마귀 소리)·쉼(새 소리)이 와도 오류가 없어야 함
// node tools/soundoff.js   (먼저 node build.mjs. dist/test.html 에서 소리 끄고 들어가 조짐 → 공격까지 돌림)
const path = require('path');
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let fail = 0;
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); p.on('pageerror', (e) => { fail++; console.log('ERR', e.message.slice(0, 300)); });
  await p.goto('file://' + path.join(__dirname, '../dist/test.html') + '#namsongi'); await p.waitForTimeout(6000);
  await p.evaluate(() => { window.__oreum.save.soundOff = 1; document.getElementById('enter').click(); }).catch(() => {});
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const O = window.__oreum, P = O.pace.pacing, S = O.sound, out = { ctx: !!S.ctx, on: S.on, phases: [], err: [] };
    try { O.look.close(); } catch { /* 없음 */ } O.cam.mode = 'follow'; O.save.jeong = 1; O.save.tut = { ...(O.save.tut || {}), done: 1 }; O.setTod(15);
    for (let i = 0; i < O.trash.api.heaps.length; i += 3) O.trash.setHeap(i, Math.floor(O.trash.api.heaps[i].n / 2));
    { const x = -60, z = 40; O.player.pos.set(x, O.groundAt(x, z), z); O.snap(); }
    P.test.first.done = true; P.test.first.bloomed = true; P.test.soon(0);
    for (let i = 0; i < 4; i++) { try { P.update(1); } catch (e) { out.err.push(String(e.message).slice(0, 200)); } out.phases.push(P.phase); }
    // 소리 장치 없이 불러도 조용히 넘어가야 하는 배경 소리 (audio.js: 까마귀·새·부엉이·말 방울)
    for (const k of ['crow', 'bird', 'owl', 'horseBell']) { try { S[k](); } catch (e) { out.err.push(k + ': ' + String(e.message).slice(0, 120)); } }
    return out;
  });
  await p.waitForTimeout(1500);
  console.log('소리 장치', r.ctx ? '켜짐' : '없음', '· 단계', r.phases.join(' → '), r.err.length ? '· 오류 ' + r.err.join(' / ') : '');
  if (r.ctx || r.on) { fail++; console.log('실패: 소리를 끄고 들어갔는데 소리 장치가 켜져 있음 (확인이 성립하지 않음)'); }
  if (r.err.length) fail++;
  if (!r.phases.includes('omen')) { fail++; console.log('실패: 조짐 단계에 들어가지 못함'); }
  await b.close();
  if (fail) process.exitCode = 1; else console.log('soundoff 통과');
})();
