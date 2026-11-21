// 대화·말풍선 창 그림과 넘침 검사 (#190). node tools/talkshot.js [p|l|d ...] [noshot]   (먼저 node build.mjs)
// p = 폰 세로 390×844, l = 폰 가로 844×390, d = PC 1280×720. 그림은 dist/talk-<모드>-<이름>.jpg (작게)
// 창: 오름지기 퀘스트 받기·가게 주인 퀘스트·쪽지·오름 방송 띠·혼잣말 말풍선·NPC 말풍선
// 검사: 창이 화면 안·버튼이 창 안·글이 창 폭을 넘지 않음·버튼이 아래 버튼(줍기·상호작용)을 가리지 않음, 말풍선은 2줄 안
const { chromium, devices } = require('playwright');
const args = process.argv.slice(2), NOSHOT = args.includes('noshot');
const MODES = args.filter((a) => /^[pld]$/.test(a)); if (!MODES.length) MODES.push('p', 'l', 'd');
const VIEW = { p: { ...devices['iPhone 13'] }, l: { ...devices['iPhone 13 landscape'] }, d: { viewport: { width: 1280, height: 720 } } };
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of MODES) {
    const ctx = await b.newContext(VIEW[mode]); const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const W = (ms) => p.waitForTimeout(ms), ev = (fn, a) => p.evaluate(fn, a);
    const shot = async (n) => { if (!NOSHOT) await p.screenshot({ path: `dist/talk-${mode}-${n}.jpg`, type: 'jpeg', quality: 50, scale: 'css', timeout: 150000 }); };
    // 보이는 창(sel) 검사: 창이 화면 안, 버튼이 창 안, 글 줄이 창 밖으로 안 넘침
    const check = async (sel, name) => {
      const r = await ev((sel) => {
        const el = document.querySelector(sel); if (!el || el.closest('[hidden]')) return null;
        const pop = el.querySelector('.pop, .talk, .pn-paper') || el, R = pop.getBoundingClientRect(), bad = [];
        if (R.left < -1 || R.top < -1 || R.right > innerWidth + 1 || R.bottom > innerHeight + 1) bad.push(`창이 화면 밖 ${[R.left, R.top, R.right, R.bottom].map(Math.round)}`);
        for (const x of pop.querySelectorAll('button, p, h2, .q-task, .q-rew')) {
          const r = x.getBoundingClientRect(); if (!r.width || x.closest('[hidden]')) continue;
          if (r.right > R.right + 1 || r.left < R.left - 1 || r.bottom > R.bottom + 1) bad.push(`${x.tagName.toLowerCase()}#${x.id || x.className} 창 밖`);
          if (x.scrollWidth > x.clientWidth + 2 && getComputedStyle(x).overflowX === 'visible') bad.push(`${x.tagName.toLowerCase()} 글이 폭을 넘음`);
        }
        return { bad, w: Math.round(R.width), h: Math.round(R.height) };
      }, sel);
      if (!r) { ok(false, `${name}: 안 열림`); return; }
      ok(!r.bad.length, `${name} ${r.w}×${r.h} ${r.bad.join(' · ')}`);
    };
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
    await p.click('#enter').catch(() => {}); await W(4000);
    await ev(() => window.__oreum.setTod(14));
    if (await ev(() => !document.getElementById('look')?.hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); }
    await ev(() => { const o = window.__oreum; o.tut.skipAll(); o.quest.next?.off?.(true); });
    const until = async (fn, ms = 10000) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn)) return true; await W(300); } return false; };
    await until(() => window.__oreum.director.state().open.includes('quest'));
    await ev(() => window.__oreum.director.open('shopQuest')); await W(1500);
    await until(() => document.getElementById('toast').hidden, 8000);
    // 1. 오름지기 퀘스트 창
    await ev(() => window.__oreum.quest.open('jigi')); await W(700);
    await check('#quest', '오름지기 퀘스트 창'); await shot('quest-jigi');
    await ev(() => window.__oreum.quest.close()); await W(300);
    // 2. 가게 주인 퀘스트 창 (가장 긴 say 를 고름)
    const gid = await ev(() => { const g = window.__oreum.quest.where(); return Object.keys(g).find((k) => k === 'shop:gear') || Object.keys(g).find((k) => k.startsWith('shop:')); });
    if (gid) {
      await ev((g) => window.__oreum.quest.open(g), gid); await W(700);
      await check('#quest', `가게 주인 퀘스트 창 (${gid})`); await shot('quest-shop');
      await ev(() => window.__oreum.quest.close()); await W(300);
    }
    // 2b. 가장 긴 대사 퀘스트: 장 넘기기(▶)·한 장 줄 수
    const lg = await ev(() => { const q = window.__oreum.quest, all = [...q.api.defs.main, ...q.api.defs.side]; const len = (x) => (x || []).join(' ').length; const L = all.filter((x) => q.where()[x.giver]).sort((a, b) => Math.max(len(b.say), len(b.fin)) - Math.max(len(a.say), len(a.fin)))[0]; const st = len(L.fin) > len(L.say) ? 'ready' : 'offer'; q.showQ(L.id, st); return { id: L.id, st }; });
    await W(600);
    const pg = await ev(() => { const el = document.getElementById('quest-say'); let n = 0; for (const p of el.children) n += Math.round(p.getBoundingClientRect().height / (parseFloat(getComputedStyle(p).lineHeight) || 24)); return { rows: n, clip: el.scrollHeight > el.clientHeight + 2, ...window.__oreum.quest.win() }; });
    ok(pg.rows <= 4 && !pg.clip, `가장 긴 대사 ${lg.id}(${lg.st}) 한 장 ${pg.rows}줄 · ${pg.pages}장${pg.clip ? ' · 글이 잘림' : ''}`);
    await check('#quest', '가장 긴 대사 창'); await shot('quest-long');
    if (pg.pages > 1) { await ev(() => window.__oreum.quest.nextPage()); await W(300); ok((await ev(() => window.__oreum.quest.win().page)) === 1, '▶ 다음 장'); }
    await ev(() => window.__oreum.quest.close()); await W(300);
    if (mode === 'd') { // 대사 한 줄 28자 넘는 것 (문장에서 나눠도 넘는 것)
      const long = await ev(() => { const q = window.__oreum.quest, out = []; for (const x of [...q.api.defs.main, ...q.api.defs.side]) for (const l of [...(x.say || []), ...(x.fin || [])]) for (const s of l.split(/(?<=[.?!…~])\s+/)) if ([...s].length > 28) out.push(s); return out; });
      console.log(`     참고: 문장에서 나눠도 28자 넘는 대사 ${long.length}줄`, long.slice(0, 3));
    }
    // 3. 쪽지 창: 가장 긴 쪽지
    const pw = await ev(() => !!window.__oreum.punkWorld);
    if (pw) {
      await ev(() => { const n = window.__oreum.punkWorld.note; const L = [...n.list].sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0]; n.give(L.id, true); n.open(L.id); }); await W(600);
      await check('#punk-note', '쪽지 창'); await shot('note');
      await ev(() => window.__oreum.punkWorld.note.close()); await W(300);
      // 4. 오름 방송 띠
      await ev(() => { const r = window.__oreum.punkWorld.radio; r.go('trail'); r.fire(true); }); await W(2500);
      const strip = await ev(() => { const s = document.querySelector('.radio-strip, #radio-strip'); if (!s || s.hidden) return null; const R = s.getBoundingClientRect(), t = s.querySelector('.rs-t'); return { l: R.left, r: R.right, t: R.top, b: R.bottom, over: t ? t.scrollWidth > t.clientWidth + 2 && getComputedStyle(t).overflow === 'visible' : false }; });
      ok(!strip || (strip.l >= -1 && strip.r <= (await ev(() => innerWidth)) + 1 && !strip.over), `방송 띠 ${strip ? [strip.l, strip.t, strip.r, strip.b].map(Math.round) : '없음'}`);
      await shot('radio');
    }
    // 5. 혼잣말 말풍선 (가장 긴 줄) · NPC 말풍선 (오름지기)
    const bub = await ev(() => {
      const o = window.__oreum, m = o.mutter; if (!m) return null;
      const T = m.wrap; // src/bubble.js 줄 나눔
      const long = '이 더미는 혼자 치우기엔 너무 크고 무거워 보이는데 어쩌지';
      return T ? T(long) : null;
    });
    if (bub) ok(bub.length <= 2 && bub.every((l) => [...l].length <= 15), `말풍선 줄 나눔 ${JSON.stringify(bub)}`);
    await ev(() => { const o = window.__oreum; const id = o.mutter?.lines?.[0]; if (id) o.mutter.say(id); }); await W(900);
    await shot('mutter');
    // 6. 아래 버튼과 겹침 (퀘스트 창을 다시 열고)
    await ev(() => window.__oreum.quest.open('jigi')); await W(600);
    const cover = await ev(() => {
      const pop = document.querySelector('#quest .pop'); if (!pop) return null; const R = pop.getBoundingClientRect();
      return { bottom: Math.round(R.bottom), h: innerHeight };
    });
    if (cover) ok(cover.bottom <= cover.h, `퀘스트 창 아래 끝 ${cover.bottom}/${cover.h}`);
    await ev(() => window.__oreum.quest.close());
    ok(errs === 0, `${mode}: 페이지 오류 ${errs}`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `실패 ${fails}` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
