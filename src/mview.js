// '모바일인가' 판정 한 곳 (#220) + 어드민용 '모바일 화면으로 보기'
// - isMobile(): 터치 기기인가(손가락이 주 입력). 예전 save.js isTouch·곳곳의 matchMedia('(pointer: coarse)')·quality.js userAgent 검사를 여기로 모음
//   화면 폭(innerWidth <= 600)은 판정이 아니라 배치 값이라 그대로 둔다 (폰 틀 안에서는 저절로 폰 폭이 됨)
// - 모바일 화면으로 보기: 어드민이 데스크톱에서 켜면, 바깥 창은 게임을 돌리지 않고 가운데 폰 틀(iframe) 하나만 그린다.
//   틀 안 게임(?mframe=1)은 isMobile() 이 참이라 폰과 똑같이 돈다 (조이스틱·행동 버튼·모바일 튜토리얼 말·모바일 그래픽 단계). 마우스가 손가락 노릇
//   켜는 법: 어드민 창 '해 보기' 탭 스위치, 또는 주소 ?m=1 (끄기 ?m=0). 이 기기에만 저장. 어드민 표시(ADM)가 없는 기기에서는 둘 다 먹지 않음
//   ADM 은 서버가 이 계정을 어드민이라고 알려 줄 때(menu.js enableDev) 켜고, 어드민 아님이 확인되면 지움 (start.js). 보안 장치가 아니라 잘못 켜지지 않게 하는 정도
const K = 'oreumoreum.mview', AK = 'oreumoreum.adm', OK = 'oreumoreum.mview.opt';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* 저장 불가 */ } } };
const W = typeof window !== 'undefined' ? window : null;
const q = W ? new URLSearchParams(location.search) : new URLSearchParams('');
const isAdm = () => ls.get(AK) === '1';
const sameParent = () => { if (!W || W.parent === W) return false; try { return W.parent.location.origin === location.origin; } catch (e) { return false; } };
if (q.get('m') === '0') ls.del(K);
else if (q.get('m') === '1' && isAdm()) ls.set(K, '1');
export const IN_FRAME = q.get('mframe') === '1' && sameParent() && isAdm();
const realTouch = !!W && ((W.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in W);
const MOBILE = realTouch || IN_FRAME;
export const isMobile = () => MOBILE;
export const mviewOn = () => !realTouch && isAdm() && ls.get(K) === '1';
export const mviewOpt = () => { let o = null; try { o = JSON.parse(ls.get(OK) || 'null'); } catch (e) { /* 무시 */ } return { land: !!o?.land, small: o ? !!o.small : (W ? innerHeight < 900 : false), safe: o?.safe !== 0 }; }; /* 처음엔 창이 낮으면 80% */
const setOpt = (o) => ls.set(OK, JSON.stringify({ land: o.land ? 1 : 0, small: o.small ? 1 : 0, safe: o.safe ? 1 : 0 }));
const topReload = (url) => { const w = IN_FRAME ? W.parent : W; if (url && url !== w.location.href) w.location.href = url; else w.location.reload(); }; /* 주소가 같으면(해시만 같아도) 새로 고침 */
// 스위치 (어드민 창). 켜고 끄면 바깥 창을 새로 고쳐 틀을 그리거나 걷음
export function setMview(on) { if (on && !isAdm()) return; if (on) ls.set(K, '1'); else ls.del(K); const u = new URL((IN_FRAME ? W.parent : W).location.href); u.searchParams.delete('m'); topReload(u.href); }
export function setAdm() { ls.set(AK, '1'); }
// 어드민 아님이 확인됨: 표시를 지우고, 틀 안이면 바깥 창도 원래대로
export function dropAdm() { if (!isAdm()) return; ls.del(AK); ls.del(K); if (IN_FRAME) topReload(); }

// 틀 안 안전 영역 흉내: 바깥이 정한 값을 page.html 의 --safe-* 에 (iframe 안 env() 는 0)
export function frameSafe() {
  if (!IN_FRAME) return;
  const apply = () => {
    const o = mviewOpt(), r = document.documentElement.style, land = innerWidth > innerHeight;
    const v = !o.safe ? { t: 0, b: 0, l: 0, r: 0 } : land ? { t: 0, b: 21, l: 47, r: 47 } : { t: 47, b: 34, l: 0, r: 0 };
    for (const k of ['t', 'b', 'l', 'r']) r.setProperty('--safe-' + k, v[k] + 'px');
  };
  apply(); addEventListener('resize', apply); addEventListener('storage', (e) => { if (e.key === OK) apply(); });
}

// 바깥 창: 게임 대신 폰 틀. 참이면 main.js 는 게임을 읽지 않는다
export function mframeTop() {
  if (!W || IN_FRAME || !mviewOn()) return false;
  const u = new URL(location.href); u.searchParams.delete('m'); u.searchParams.set('mframe', '1');
  const box = document.createElement('div'); box.id = 'mview';
  box.innerHTML = '<style>'
    + 'body > *:not(#mview) { display: none !important; } html, body { background: #0b0d10 !important; overflow: hidden; }'
    + '#mview { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; background: #0b0d10; font: 600 13px/1.2 system-ui, sans-serif; color: #e9e6dc; }'
    + '#mview .mv-ph { position: relative; border-radius: 44px; box-shadow: 0 0 0 10px #1c1e22, 0 0 0 11px #3a3d44, 0 30px 80px rgba(0,0,0,.6); overflow: hidden; background: #000; transform-origin: center; }'
    + '#mview iframe { display: block; width: 100%; height: 100%; border: 0; }'
    + '#mview .mv-notch { position: absolute; left: 50%; top: 10px; width: 120px; height: 32px; margin-left: -60px; border-radius: 20px; background: #000; pointer-events: none; }'
    + '#mview .mv-home { position: absolute; left: 50%; bottom: 8px; width: 134px; height: 5px; margin-left: -67px; border-radius: 3px; background: rgba(255,255,255,.8); pointer-events: none; mix-blend-mode: difference; }'
    + '#mview .mv-land .mv-notch { left: 10px; top: 50%; width: 32px; height: 120px; margin: -60px 0 0; }'
    + '#mview .mv-land .mv-home { bottom: 6px; }'
    + '#mview .mv-nosafe .mv-notch, #mview .mv-nosafe .mv-home { display: none; }'
    + '#mview .mv-bar { position: fixed; right: 16px; top: 16px; display: grid; gap: 6px; }'
    + '#mview .mv-bar button { min-height: 34px; padding: 6px 12px; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; background: rgba(255,255,255,.08); color: inherit; font: inherit; cursor: pointer; }'
    + '#mview .mv-bar button[aria-pressed="true"] { background: #f29a2e; color: #24251f; border-color: transparent; }'
    + '#mview .mv-bar .mv-x { border-color: rgba(255,110,96,.55); background: rgba(214,58,46,.28); color: #ffd6d1; }'
    + '#mview .mv-lab { position: fixed; left: 16px; top: 16px; opacity: .6; }'
    + '</style><div class="mv-lab">모바일 화면으로 보기 (어드민)</div>'
    + '<div class="mv-ph" id="mview-ph"><iframe id="mview-frame" title="오름오름 (폰 화면)" allow="fullscreen; clipboard-write; vibrate"></iframe><i class="mv-notch"></i><i class="mv-home"></i></div>'
    + '<div class="mv-bar"><button type="button" data-k="land">가로</button><button type="button" data-k="small">80%</button><button type="button" data-k="safe">안전 영역</button><button type="button" class="mv-x" data-k="off">끄기</button></div>';
  document.body.append(box);
  const ph = box.querySelector('#mview-ph'), fr = box.querySelector('#mview-frame');
  let o = mviewOpt();
  const draw = () => {
    const w = o.land ? 844 : 390, h = o.land ? 390 : 844;
    ph.style.width = w + 'px'; ph.style.height = h + 'px'; ph.style.transform = o.small ? 'scale(.8)' : '';
    ph.classList.toggle('mv-land', o.land); ph.classList.toggle('mv-nosafe', !o.safe);
    for (const b of box.querySelectorAll('.mv-bar [data-k]')) if (b.dataset.k !== 'off') b.setAttribute('aria-pressed', String(!!o[b.dataset.k]));
  };
  box.querySelector('.mv-bar').addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    if (k === 'off') { setMview(false); return; }
    o = { ...o, [k]: !o[k] }; setOpt(o); draw();
  });
  draw(); fr.src = u.pathname + u.search + u.hash;
  W.__mview = { frame: fr, opt: () => ({ ...o }) };
  return true;
}
