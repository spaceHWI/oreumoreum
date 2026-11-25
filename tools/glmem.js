// 시작 때 GPU 부담 재기 (#304): node tools/glmem.js <dist 가 있는 폴더> [m|d] [주소 꼬리 예: '?aa=1']   (먼저 node build.mjs)
// WebGL 호출(texImage2D·texStorage2D·bufferData·renderbufferStorage*)을 가로채 GPU 에 올라간 바이트를 어림해 시작~20초를 2초마다 적는다.
// 진짜 GPU 메모리는 아니지만(소프트웨어 GL), 안티에일리어싱·품질 단계·나눠 받기가 무엇을 얼마나 바꾸는지 견줄 수 있다. 셰이더 프로그램 수·받은 모델 수도 같이
const { chromium, devices } = require('playwright');
const DIR = process.argv[2] || process.cwd(), MODE = process.argv[3] === 'd' ? 'd' : 'm', TAIL = process.argv[4] || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(MODE === 'm' ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 760 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    const M = window.__gm = { tex: 0, buf: 0, rb: 0, prog: 0, peak: 0, t0: performance.now(), up: [] };
    const tw = new WeakMap(), bw = new WeakMap(), rw = new WeakMap();
    const BPP = (fmt, type) => (type === 0x1406 ? 16 : type === 0x140b || type === 0x8d61 ? 8 : 4); /* FLOAT 16, HALF 8, 나머지 RGBA8 4 로 어림 */
    const peak = () => { const t = M.tex + M.buf + M.rb; if (t > M.peak) M.peak = t; };
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!C) continue; const P = C.prototype;
      const wrap = (k, f) => { const o = P[k]; if (!o) return; P[k] = function (...a) { try { f.call(this, a); } catch (e) { /* 재기 실패 무시 */ } return o.apply(this, a); }; };
      const curTex = (gl, target) => gl.getParameter(target === 0x8513 || (target >= 0x8515 && target <= 0x851a) ? 0x8514 : target === 0x806f ? 0x806a : target === 0x8c1a ? 0x8c1d : 0x8069);
      const setTex = (gl, target, level, bytes) => { const t = curTex(gl, target); if (!t) return; const m = tw.get(t) || {}; const key = target + ':' + level; M.tex += bytes - (m[key] || 0); m[key] = bytes; tw.set(t, m); M.up.push([Math.round(performance.now() - M.t0), bytes]); peak(); };
      wrap('texImage2D', function (a) { let w, h, type; if (a.length >= 8) { w = a[3]; h = a[4]; type = a[7]; } else { const src = a[5]; w = src.naturalWidth || src.videoWidth || src.width || 0; h = src.naturalHeight || src.videoHeight || src.height || 0; type = a[4]; } setTex(this, a[0], a[1], w * h * BPP(a[2], type)); });
      wrap('texImage3D', function (a) { setTex(this, a[0], a[1], a[3] * a[4] * a[5] * BPP(a[2], a[8])); });
      wrap('compressedTexImage2D', function (a) { const d = a[a.length - 1]; setTex(this, a[0], a[1], d && d.byteLength || a[3] * a[4]); });
      wrap('texStorage2D', function (a) { let w = a[3], h = a[4], s = 0; for (let i = 0; i < a[1]; i++) { s += w * h * 4; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); } setTex(this, a[0], 'S', s * (a[0] === 0x8513 ? 6 : 1)); });
      wrap('bufferData', function (a) { const buf = this.getParameter(a[0] === 0x8893 ? 0x8895 : 0x8894); if (!buf) return; const n = typeof a[1] === 'number' ? a[1] : a[1] ? a[1].byteLength : 0; M.buf += n - (bw.get(buf) || 0); bw.set(buf, n); peak(); });
      const rb = function (a, samples) { const r = this.getParameter(0x8ca7); if (!r) return; const n = a[a.length - 2] * a[a.length - 1] * 4 * Math.max(1, samples); M.rb += n - (rw.get(r) || 0); rw.set(r, n); peak(); };
      wrap('renderbufferStorage', function (a) { rb.call(this, a, 1); });
      wrap('renderbufferStorageMultisample', function (a) { rb.call(this, a, a[1]); });
      wrap('deleteTexture', function (a) { const m = a[0] && tw.get(a[0]); if (m) { for (const v of Object.values(m)) M.tex -= v; tw.delete(a[0]); } });
      wrap('deleteBuffer', function (a) { const n = a[0] && bw.get(a[0]); if (n) { M.buf -= n; bw.delete(a[0]); } });
      wrap('deleteRenderbuffer', function (a) { const n = a[0] && rw.get(a[0]); if (n) { M.rb -= n; rw.delete(a[0]); } });
      wrap('linkProgram', function () { M.prog++; });
    }
  });
  await p.goto('file://' + DIR + '/dist/test.html' + TAIL + '#namsongi');
  const MB = (n) => (n / 1048576).toFixed(1);
  const rows = [];
  for (let s = 2; s <= 20; s += 2) {
    await sleep(2000);
    if (s === 6) await p.click('#enter').catch(() => {});
    const r = await p.evaluate(() => { const M = window.__gm, o = window.__oreum; const up = M.up.filter(([t]) => t > performance.now() - M.t0 - 2000); return { tex: M.tex, buf: M.buf, rb: M.rb, peak: M.peak, prog: M.prog, upN: up.length, upB: up.reduce((a, [, b]) => a + b, 0), models: o?.assets ? o.assets.done : 0, aa: o?.gl ? o.gl.aa() : o?.renderer?.getContextAttributes()?.antialias, tier: o?.quality?.level, pr: o?.quality?.pr, fb: (() => { const c = document.getElementById('view'), n = c.width * c.height; return n * (o?.renderer?.getContextAttributes()?.antialias ? 4 * 8 + 4 : 8) + n * 4; })() }; }); /* 화면 버퍼 어림: 색·깊이 8바이트 × (AA 면 4샘플 + 풀어 놓을 색) + 앞 버퍼 */
    rows.push(r);
    console.log(`${String(s).padStart(2)}s  텍스처 ${MB(r.tex).padStart(6)}MB  정점 ${MB(r.buf).padStart(5)}MB  렌더버퍼 ${MB(r.rb).padStart(5)}MB  화면버퍼 ${MB(r.fb).padStart(5)}MB  최고 ${MB(r.peak).padStart(6)}MB  2초새 올림 ${String(r.upN).padStart(3)}개 ${MB(r.upB).padStart(5)}MB  프로그램 ${r.prog}  모델 ${r.models}  aa ${r.aa} 단계 ${r.tier} 배율 ${r.pr}`);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
