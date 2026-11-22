// 사건 파일 화면 모양 (#232·#246, game/cases.js 가 씀): 장면 띠·빛(#case-cine: dawn·dusk·mist·snow·flash), 수사 보드(#case-file: 코르크판·사진·핀·빨간 실·증거 칸)
// 이 파일은 글만 내보냄 (cases.js 가 40KB 를 넘지 않게 뗌). slots = 사진 자리 수
export const caseCss = (slots) => `
body.case-cine>*:not(#view):not(#case-cine){visibility:hidden!important}
#case-cine { position: fixed; inset: 0; z-index: 12; pointer-events: auto; background: transparent; transition: background 2.4s; }
#case-cine.dawn { background: linear-gradient(180deg, rgba(8,12,34,.86), rgba(20,30,70,.6) 45%, rgba(60,70,120,.28) 75%, rgba(120,110,150,.18)); }
#case-cine.dusk { background: linear-gradient(180deg, rgba(60,30,90,.55), rgba(240,120,50,.42) 70%, rgba(240,140,60,.3)); }
#case-cine.mist { background: linear-gradient(180deg, rgba(225,230,235,.5), rgba(210,216,222,.35)); }
#case-cine.mist.clear { background: linear-gradient(180deg, rgba(225,230,235,0), rgba(210,216,222,0)); transition: background 3s; }
#case-cine.snow { background: linear-gradient(180deg, rgba(200,215,235,.38), rgba(240,244,250,.18) 60%, rgba(255,255,255,.05)); }
#case-cine.flash { background: rgba(255,255,255,.85); transition: background .08s; }
#case-cine.shot { background: transparent; transition: background .6s; box-shadow: inset 0 0 0 10px rgba(255,255,255,.75); }
#case-cine::before, #case-cine::after { content: ''; position: absolute; left: 0; right: 0; height: 9vh; background: #000; transition: transform .5s; }
#case-cine::before { top: 0; transform: translateY(-100%); } #case-cine::after { bottom: 0; transform: translateY(100%); }
#case-cine.on::before, #case-cine.on::after { transform: none; }
#case-cine .cc-sk { position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: calc(9vh + 12px); min-width: 44px; height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--hair); background: var(--glass-2, rgba(20,20,24,.6)); color: var(--ink); font: 700 14px var(--body); cursor: pointer; }
#case-cine .cc-line { position: absolute; left: 50%; bottom: max(24px, env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: calc(100vw - 140px); color: #fff; font: 600 15px var(--body); text-align: center; text-shadow: 0 1px 3px #000; opacity: 0; transition: opacity .5s; word-break: keep-all; }
#case-cine .cc-line.on { opacity: 1; }
#case-file .pop { width: min(620px, 100%); }
#case-file .cf-board { position: relative; border-radius: 10px; padding: 14px 10px 12px; margin: 0 0 12px; background: radial-gradient(circle at 20% 30%, rgba(255,255,255,.08) 0 1px, transparent 2px) 0 0 / 9px 9px, radial-gradient(circle at 70% 60%, rgba(0,0,0,.1) 0 1px, transparent 2px) 0 0 / 7px 7px, #b98a55; box-shadow: inset 0 0 0 6px #7a5634, inset 0 0 18px rgba(0,0,0,.35); }
#case-file .cf-pics { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(${slots}, minmax(0, 1fr)); gap: 10px 8px; }
#case-file .cf-pic { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 3px; padding: 5px 5px 4px; border: 0; border-radius: 2px; background: #f6f3ea; color: #3a3630; font: 700 11px/1.2 var(--body); text-align: center; word-break: keep-all; box-shadow: 0 3px 6px rgba(0,0,0,.35); transform: rotate(var(--r, 0deg)); cursor: pointer; }
#case-file .cf-pic img, #case-file .cf-pic .cf-ph { display: block; width: 100%; aspect-ratio: 4 / 3; border-radius: 1px; background: #2d2a26; }
#case-file .cf-pic .cf-ph { display: grid; place-items: center; color: rgba(255,255,255,.5); font: 900 20px var(--display); }
#case-file .cf-pic.empty { background: rgba(255,255,255,.14); box-shadow: none; color: rgba(40,25,10,.75); outline: 2px dashed rgba(60,35,15,.45); outline-offset: -2px; cursor: default; }
#case-file .cf-pic.empty .cf-ph { background: transparent; color: rgba(60,35,15,.55); }
#case-file .cf-pic.lock { cursor: default; }
#case-file .cf-pic.sel { outline: 3px solid #ffd27a; outline-offset: 2px; }
#case-file .cf-pin { position: absolute; left: 50%; top: -6px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ff8a7a, #c0302a 60%, #7a1a16); box-shadow: 0 2px 2px rgba(0,0,0,.4); z-index: 2; }
#case-file .cf-pic .cf-st { position: absolute; right: 2px; bottom: 22%; transform: rotate(-10deg); border: 2px solid currentColor; border-radius: 4px; padding: 0 4px; font: 900 10px var(--display); background: rgba(246,243,234,.85); }
#case-file .cf-st.open { color: #c4513a; } #case-file .cf-st.done { color: #2f7d44; }
#case-file .cf-thread { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none; overflow: visible; }
#case-file .cf-thread path { fill: none; stroke: #d0302a; stroke-width: 2; stroke-linecap: round; filter: drop-shadow(0 1px 1px rgba(0,0,0,.45)); }
#case-file .cf-thread path.loose { stroke-dasharray: 3 4; opacity: .8; }
#case-file .cf-case { position: relative; padding: 10px 10px 10px 12px; border-radius: 12px; background: rgba(255,255,255,.07); }
#case-file .cf-case h3 { margin: 0 86px 2px 0; font: 800 16px var(--display); }
#case-file .cf-case .cf-sub { margin: 0 86px 8px 0; color: var(--ink-soft); font-size: 12px; }
#case-file .cf-case > .cf-st { position: absolute; right: 10px; top: 10px; transform: rotate(-8deg); border: 2px solid currentColor; border-radius: 6px; padding: 1px 8px; font: 900 13px var(--display); letter-spacing: .08em; }
#case-file .cf-case > .cf-st.open { color: #e8846a; } #case-file .cf-case > .cf-st.done { color: #8fd09a; }
#case-file .cf-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
#case-file .cf-slot { position: relative; min-height: 64px; border-radius: 8px; border: 1px dashed var(--hair); background: rgba(255,255,255,.04); color: var(--ink-soft); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 4px; font: 700 11px/1.2 var(--body); text-align: center; word-break: keep-all; }
#case-file .cf-slot svg { width: 18px; height: 18px; opacity: .55; }
#case-file .cf-slot small { font-weight: 500; font-size: 10px; opacity: .8; }
#case-file button.cf-slot { cursor: pointer; }
#case-file .cf-slot.got { border-style: solid; border-color: transparent; background: #efe6cf; color: #33302a; }
#case-file .cf-slot.got svg { opacity: .8; }
#case-file .cf-slot.doc.got { background: #f4ecd8; box-shadow: inset 0 0 0 2px #c9a86a; }
#case-file .cf-h { margin: 4px 0 6px; font: 800 13px var(--display); color: var(--ink-soft); }
#case-file .cf-empty { color: var(--ink-soft); margin: 4px 0 4px; }
@media (max-width: 600px) and (orientation: portrait) { #case-file .cf-pics { grid-template-columns: repeat(6, minmax(0, 1fr)); } #case-file .cf-pic { grid-column: span 2; } #case-file .cf-pic:nth-child(4) { grid-column: 2 / span 2; } }
@media (max-height: 480px) { #case-file .cf-slot { min-height: 46px; padding: 4px; } #case-file .cf-slot svg { display: none; } #case-file .cf-board { padding: 10px 8px 8px; margin-bottom: 8px; } #case-file .cf-pic { font-size: 10px; } }
@media (max-width: 380px) { #case-file .cf-slot { font-size: 10px; } }
#punk-note .pn-nav .pn-case { padding: 0 12px; }
#punk-note .pn-nav .pn-case svg { width: 18px; height: 18px; }
`;
