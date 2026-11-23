// 겹쳐 그리기 재기 (#272): node tools/overdraw.js [m|d] [곳,...] [--top N] [--json 파일]   (먼저 node build.mjs)
// 모든 재질을 '더하기 섞기 + 단색(1/255)' 으로 잠시 바꿔 화면을 한 장 그리고, 픽셀마다 몇 번 칠해졌는지 읽어 평균 겹 수를 낸다
// 깊이 검사·깊이 쓰기·그리는 순서는 원래 재질 그대로라서, 실제 그릴 때 GPU 가 픽셀을 칠하는 횟수와 같다(잘라내기로 버린 픽셀은 빠짐)
//  - 겹: 평균 겹 수(전체) · 불투명 · 반투명(전체 - 불투명) · 3겹 넘는 픽셀 비율
//  - 위: 반투명 재질 하나씩 켜서 더한 픽셀 수가 큰 차례(어떤 판이 화면을 넓게 덮는지) · 불투명 재질 하나씩 끄면 줄어드는 양 · 투명도 0 인데 그리는 것
// --tier 0|1|2: 성능 단계 강제(주소 ?tier=). 헤드리스는 소프트웨어 GL 이라 그냥 두면 폰·PC 모두 낮음(0), 실제 폰은 보통(1)
// m = 폰(iPhone 13), d = PC 1280×720. 곳: field 들판 · forest 숲길 · street 가게 거리 · swarm 서바이벌 판 · crater 안개 낀 굼부리(사건 4 안개 판을 잠깐 보이게 함)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const args = process.argv.slice(2), flag = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const TIER_Q = flag('--tier', null), TOP = +flag('--top', 8), JSON_OUT = flag('--json', null);
const MODE = args[0] === 'd' ? 'd' : 'm';
const ALL = ['field', 'forest', 'street', 'swarm', 'crater'];
const SPOTS = args[1] ? args[1].split(',') : ALL;
const NAME = { field: '들판', forest: '숲길', street: '가게 거리', swarm: '서바이벌 판', crater: '안개 낀 굼부리' };

// 페이지 안: 겹 재기
const MEASURE = ({ top }) => {
  const o = window.__oreum, R = o.renderer, S = o.scene, C = o.camObj, T = o.charKit.THREE;
  const size = R.getDrawingBufferSize(new T.Vector2()), w = Math.max(64, Math.round(size.x / 2)), h = Math.max(64, Math.round(size.y / 2));
  const rt = new T.WebGLRenderTarget(w, h, { depthBuffer: true }), px = new Uint8Array(w * h * 4);
  const mats = new Map(), draw = [];
  C.updateMatrixWorld(); const fr = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(C.projectionMatrix, C.matrixWorldInverse));
  S.traverseVisible((ob) => {
    if (!ob.material || !(ob.isMesh || ob.isPoints || ob.isSprite || ob.isLine)) return;
    if (!ob.layers.test(C.layers)) return;
    const list = Array.isArray(ob.material) ? ob.material : [ob.material];
    for (const m of list) if (!mats.has(m)) mats.set(m, { blending: m.blending, obc: m.onBeforeCompile, key: m.customProgramCacheKey, cw: m.colorWrite });
    if (list.some((m) => m.transparent) && (ob.frustumCulled === false || ob.isSprite || !ob.geometry || (ob.geometry.boundingSphere || ob.geometry.computeBoundingSphere(), !ob.geometry.boundingSphere) || fr.intersectsObject(ob))) draw.push(ob);
  });
  for (const [m, s] of mats) {
    m.blending = T.AdditiveBlending;
    m.onBeforeCompile = function (sh, r) { s.obc?.call(this, sh, r); sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, '  gl_FragColor = vec4(1.0 / 255.0, 0.0, 0.0, 1.0);\n}\n'); };
    m.customProgramCacheKey = function () { return (s.key ? s.key.call(this) : '') + '|od272'; };
    m.needsUpdate = true;
  }
  const N = w * h, hex = (m) => (m.color ? '#' + m.color.getHexString() : m.uniforms ? 'shader' : '');
  const label = (ob) => { const m = Array.isArray(ob.material) ? ob.material[0] : ob.material, names = []; for (let q = ob; q && names.length < 3; q = q.parent) if (q.name) names.push(q.name); return `${ob.type}${ob.isInstancedMesh ? '×' + ob.count : ''} ${names.join('<') || '-'} · ${m.type.replace('Material', '')} ${hex(m)} op${(+m.opacity).toFixed(2)}${m.map ? ' tex' : ''}${m.alphaTest ? ' at' + m.alphaTest : ''}${m.depthTest ? '' : ' noZ'} ro${ob.renderOrder} v${ob.geometry?.attributes?.position?.count ?? 0}`; };
  const bg = S.background, au = R.shadowMap.autoUpdate, cc = R.getClearColor(new T.Color()), ca = R.getClearAlpha(), tm = R.toneMapping;
  S.background = null; R.shadowMap.autoUpdate = false; R.setClearColor(0x000000, 0);
  const shot = () => { R.setRenderTarget(rt); R.clear(true, true, true); R.render(S, C); R.readRenderTargetPixels(rt, 0, 0, w, h, px); R.setRenderTarget(null); let s = 0, over3 = 0; for (let i = 0; i < px.length; i += 4) { s += px[i]; if (px[i] > 3) over3++; } return { sum: s, over3 }; };
  const all = shot(); const calls = R.info.render.calls;
  const tr = [...mats.keys()].filter((m) => m.transparent);
  for (const m of tr) m.colorWrite = false;
  const opq = shot();
  // 반투명 재질 하나씩(같은 재질을 쓰는 물체는 한데): 나머지 반투명은 색을 안 씀
  const byM = new Map();
  for (const ob of draw) { const m = (Array.isArray(ob.material) ? ob.material : [ob.material]).find((q) => q.transparent); if (!byM.has(m)) byM.set(m, []); byM.get(m).push(ob); }
  const per = [];
  for (const [m, obs] of byM) { m.colorWrite = true; const r = shot(); per.push({ ob: obs[0], n: obs.length, add: r.sum - opq.sum }); m.colorWrite = false; }
  const ghost = [...byM].filter(([m]) => !m.isShaderMaterial && m.opacity < 0.004).map(([m, obs]) => label(obs[0]) + (obs.length > 1 ? ' (' + obs.length + '개)' : '')); /* 안 보이는데 그림 */
  // 불투명 재질 하나씩 색을 끄면 줄어드는 양 = 그 재질이 실제로 칠한 픽셀 (깊이에 가려 버려진 것 빼고)
  for (const m of tr) m.colorWrite = true;
  const perM = [];
  for (const m of mats.keys()) { if (m.transparent) continue; m.colorWrite = false; const r = shot(); m.colorWrite = true; perM.push({ m, add: all.sum - r.sum }); }
  perM.sort((a, b) => b.add - a.add);
  const owner = new Map(); S.traverseVisible((ob) => { const l = Array.isArray(ob.material) ? ob.material : [ob.material]; for (const m of l) if (m && !owner.has(m)) owner.set(m, ob); });
  for (const [m, s] of mats) { m.blending = s.blending; m.onBeforeCompile = s.obc; m.customProgramCacheKey = s.key; m.colorWrite = s.cw; m.needsUpdate = true; }
  S.background = bg; R.shadowMap.autoUpdate = au; R.setClearColor(cc, ca); R.toneMapping = tm; rt.dispose();
  per.sort((a, b) => b.add - a.add);
  return {
    w, h, all: +(all.sum / N).toFixed(2), opaque: +(opq.sum / N).toFixed(2), trans: +((all.sum - opq.sum) / N).toFixed(2), over3: +(all.over3 / N * 100).toFixed(1), calls,
    transObjs: draw.length, opqTop: perM.slice(0, top).filter((p) => p.add > 0).map((p) => ({ k: label(owner.get(p.m)), layers: +(p.add / N).toFixed(3) })), top: per.slice(0, top).filter((p) => p.add > 0).map((p) => ({ k: label(p.ob) + (p.n > 1 ? ' (' + p.n + '개)' : ''), layers: +(p.add / N).toFixed(3) })), ghost,
  };
};

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(MODE === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const E = (f, a) => p.evaluate(f, a), W = (ms) => p.waitForTimeout(ms);
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.ticks && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html' + (TIER_Q ? '?tier=' + TIER_Q : '') + '#namsongi'); await ready();
  await E(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { seen: 1, best: {} } }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await ready(); await p.click('#enter').catch(() => {}); await W(2500);
  if (await E(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(600); }
  if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) await p.click('#fs-tip-x').catch(() => {});
  await E(() => { const o = window.__oreum; o.setTod(13); o.setWeather('clear'); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
  const tier = await E(() => window.__oreum.quality?.tier ?? null);
  console.log(`[${MODE === 'm' ? '폰' : 'PC'}] 성능 단계 ${tier}`);
  const res = {};
  for (const k of SPOTS) {
    const ok = await E((k) => {
      const o = window.__oreum, P = o.player, go = (x, z, face) => { P.pos.set(x, o.groundAt(x, z), z); P.target = null; if (face != null) P.heading = face; };
      o.swarm.stop?.(); o.enemies.test?.clear?.(); o.setWeather('clear');
      const minis = o.cleanhouse?.minis?.() || [], m = (id) => minis.find((c) => c.id === id);
      if (k === 'field') { const a = o.swarm.at(1); if (!a) return false; go(a[0] + 6, a[1] + 6, Math.atan2(-6, -6)); }
      else if (k === 'forest') { const s = m('skirt'); if (!s) return false; go(s.fx, s.fz, Math.atan2(s.x - s.fx, s.z - s.fz)); }
      else if (k === 'street') o.street.go(0, 0.5);
      else if (k === 'swarm') { o.swarm.disable(false); o.swarm.clearRest(); if (!o.swarm.start(1)) return false; o.swarm.fill(o.swarm.cap); }
      else if (k === 'crater') { /* 사건 4 안개(#235) 판이 있으면 잠깐 보이게 하고 그 앞에 섬 */
        let f = null; o.scene.traverse((q) => { if (q.userData?.fog && !f) f = q; });
        if (f) { window.__odFog = f.visible; f.visible = true; window.__odFogObj = f; const v = f.getWorldPosition(new o.charKit.THREE.Vector3()); go(v.x + 12, v.z + 12, Math.atan2(-12, -12)); }
        else { const s = m('crater'); if (!s) return false; go(s.fx, s.fz, Math.atan2(s.x - s.fx, s.z - s.fz)); }
        o.setWeather('fog'); }
      o.snap(); return true;
    }, k);
    if (!ok) { console.log(NAME[k], '자리를 못 찾음'); continue; }
    await W(k === 'swarm' ? 3500 : 2500);
    if (k === 'swarm') await E(() => window.__oreum.swarm.fill(window.__oreum.swarm.cap));
    await E(() => window.__oreum.snap()); await W(400);
    const r = await E(MEASURE, { top: TOP });
    res[k] = r;
    await E(() => { const f = window.__odFogObj; if (f) { f.visible = window.__odFog; window.__odFogObj = null; } });
    console.log(`${NAME[k]}: 평균 ${r.all}겹 (불투명 ${r.opaque} · 반투명 ${r.trans}) · 3겹 넘는 픽셀 ${r.over3}% · 그리기 ${r.calls} · 반투명 물체 ${r.transObjs}`);
    for (const t of r.top) console.log(`   반투명 +${t.layers.toFixed(3)}  ${t.k}`);
    for (const g of r.ghost) console.log(`   안 보이는데 그림: ${g}`);
    for (const t of r.opqTop) console.log(`   불투명 +${t.layers.toFixed(3)}  ${t.k}`);
  }
  await E(() => window.__oreum.swarm.stop?.());
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ mode: MODE, tier, res }, null, 1));
  await b.close();
  if (errs) { console.log('페이지 오류', errs); process.exit(1); }
})();
