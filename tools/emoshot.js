// 동작 확인 (#76): node tools/emoshot.js → dist/emo-*.png, 콘솔에 확인 결과
const { chromium, devices } = require('playwright');
(async()=>{
 const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for (const mob of [false, true]) {
  const ctx = await b.newContext(mob ? { ...devices['iPhone 13'] } : { viewport:{width:1040,height:640} });
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file://'+process.cwd()+'/dist/test.html#namsongi'); await p.waitForTimeout(5000);
  await p.click('#enter').catch(()=>{}); await p.click('#intro-srv button').catch(()=>{}); await p.click('#srv-go').catch(()=>{}); await p.waitForTimeout(2500);
  await p.evaluate(()=>{ const o=window.__oreum; o.setTod(15); o.look?.close?.(); o.tut.skipAll?.(); o.save.tut.done=true; document.body.classList.remove('tut'); const h=document.getElementById('tut-hint'); if(h) h.hidden=true; });
  await p.waitForTimeout(2500);
  const n = mob ? 'm' : 'd';
  await p.click('#btn-actions'); await p.waitForTimeout(800);
  await p.screenshot({path:`dist/emo-${n}-wheel.png`});
  if (!mob) {
   // 바깥 칸 누르기 → 동작, 이름 토스트
   await p.click('.emo-c.out[data-id="insa"]'); await p.waitForTimeout(600);
   console.log(n, 'insa pose', await p.evaluate(()=>window.__oreum.player.pose), 'toast', await p.evaluate(()=>document.getElementById('toast').textContent), 'wheel hidden', await p.evaluate(()=>document.getElementById('actions').hidden));
   await p.screenshot({path:`dist/emo-${n}-bow.png`});
   // 쪽 넘기기
   await p.click('#btn-actions'); await p.click('.emo-pg'); await p.waitForTimeout(300);
   console.log('page', await p.evaluate(()=>window.__oreum.emo.page), await p.evaluate(()=>[...document.querySelectorAll('.emo-c.out')].map(b=>b.dataset.id).join(',')));
   await p.screenshot({path:`dist/emo-${n}-wheel2.png`});
   // 길게 눌러 고정 칸 바꾸기
   const box = await (await p.$('.emo-c.out[data-id="clap"]')).boundingBox();
   await p.mouse.move(box.x+box.width/2, box.y+box.height/2); await p.mouse.down(); await p.waitForTimeout(1200); // 헤드리스는 느려서 넉넉히 await p.waitForTimeout(600); await p.mouse.up();
   console.log('editing', await p.evaluate(()=>window.__oreum.emo.test.editing));
   await p.screenshot({path:`dist/emo-${n}-edit.png`});
   await p.click('.emo-c.fav[data-i="3"]'); await p.waitForTimeout(200);
   console.log('fav', await p.evaluate(()=>window.__oreum.save.emoFav.join(',')));
   await p.keyboard.press('Escape');
   // 숫자 키: 닫혀 있으면 고정 칸 (4 = clap)
   await p.waitForTimeout(2500); await p.keyboard.press('Digit4'); await p.waitForTimeout(300);
   console.log('key4', await p.evaluate(()=>window.__oreum.player.pose));
   // 걷기 시작하면 끊김
   await p.keyboard.down('KeyW'); await p.waitForTimeout(300); await p.keyboard.up('KeyW');
   console.log('after walk', await p.evaluate(()=>window.__oreum.player.pose));
   // 앉기 → 계속 유지 → 걸으면 끊김
   await p.evaluate(()=>window.__oreum.doEmote('sitg')); await p.waitForTimeout(3000);
   console.log('sitg after 3s', await p.evaluate(()=>window.__oreum.player.pose));
   await p.keyboard.down('KeyS'); await p.waitForTimeout(200); await p.keyboard.up('KeyS');
   console.log('sitg after walk', await p.evaluate(()=>window.__oreum.player.pose));
   // 가리키기: 표시 + 연타 막기
   await p.waitForTimeout(500);
   await p.evaluate(()=>window.__oreum.doEmote('point')); await p.waitForTimeout(100);
   console.log('marks', await p.evaluate(()=>window.__oreum.emo.test.marks.length), 'em', await p.evaluate(()=>JSON.stringify(window.__oreum.emo.mine)));
   await p.evaluate(()=>window.__oreum.doEmote('help')); await p.waitForTimeout(100);
   console.log('marks after spam', await p.evaluate(()=>window.__oreum.emo.test.marks.length), 'toast', await p.evaluate(()=>document.getElementById('toast').textContent));
   await p.waitForTimeout(1200); await p.screenshot({path:`dist/emo-${n}-point.png`});
   // 쓰레기 많아: 가까운 더미 쪽
   await p.waitForTimeout(2500);
   await p.evaluate(()=>window.__oreum.doEmote('trash')); await p.waitForTimeout(100);
   console.log('trash em', await p.evaluate(()=>JSON.stringify(window.__oreum.emo.mine)));
   // 다른 사람 흉내: 도와줘 → 말풍선·표시·가장자리
   const r = await p.evaluate(()=>{ const o=window.__oreum; const T=o.player.pos; const run=o.buildRunner(); o.scene.add(run.root);
     const pos=T.clone(); pos.x+=30; pos.z+=30; run.root.position.copy(pos);
     const e={ peer:'fake', runner:run, label:null, nick:'친구', pos, tpos:pos.clone(), heading:0, theading:0, data:{x:pos.x,z:pos.z,pose:'help',em:{id:'help',at:Date.now(),mx:pos.x,mz:pos.z}}, speed:0, poseT:0, lastPos:pos.clone() };
     o.net.peersById.set('fake', e); return 1; });
   await p.waitForTimeout(400);
   console.log('peer bubble', await p.evaluate(()=>window.__oreum.emo.test.bubbles.length), 'edges', await p.evaluate(()=>window.__oreum.emo.test.edges.length), 'edge visible', await p.evaluate(()=>!document.querySelector('.emo-edge')?.hidden));
   await p.screenshot({path:`dist/emo-${n}-help-edge.png`});
   // 하이파이브: 가까운 사람이 먼저 하면 맞음
   await p.evaluate(()=>{ const o=window.__oreum, e=o.net.peersById.get('fake'); e.pos.copy(o.player.pos); e.pos.x+=1.5; e.tpos.copy(e.pos); e.data.em={id:'five',at:Date.now()+5}; e.data.pose='five'; });
   await p.waitForTimeout(400);
   await p.evaluate(()=>window.__oreum.doEmote('five')); await p.waitForTimeout(200);
   console.log('five toast', await p.evaluate(()=>document.getElementById('toast').textContent));
   // 타고 있을 때: 몸 동작 막힘
   await p.waitForTimeout(2000);
   const rd = await p.evaluate(()=>{ const o=window.__oreum; o.player.ride = {}; const ok=o.emo.perform('lie'); const ok2=o.emo.perform('wave'); const ov=o.emo.overlay(); o.player.ride=null; return [ok,ok2,ov&&ov.id]; });
   console.log('ride lie/wave/overlay', JSON.stringify(rd));
  } else {
   await p.click('.emo-c.fav[data-i="0"]'); await p.waitForTimeout(700);
   console.log(n, 'fav0 pose', await p.evaluate(()=>window.__oreum.player.pose));
   await p.screenshot({path:`dist/emo-${n}-wave.png`});
  }
  await ctx.close();
 }
 await b.close();
})();
