// 아이콘 세트 만들기 (#184): node tools/icongen.mjs → src/icons.js
// UI 아이콘은 Tabler Icons(MIT, 24 격자·2px 선) 하나로 통일. 쓰는 것만 path 를 옮겨 담는다(패키지 전체를 넣지 않음)
// 세트에 없는 오름오름 것(귤·하르방·정낭·클린하우스·집게·갈퀴·돌탑·귤 무기 등)은 같은 격자·굵기로 아래 OWN 에 직접 그림
// 준비: npm i --no-save @tabler/icons@3.52.0  (package.json 에는 넣지 않음. 아이콘을 더할 때만 필요)
// 새 아이콘: MAP 에 'id': 'tabler-이름' (꽉 찬 모양은 'filled:이름') 또는 OWN 에 직접 그림 → 다시 돌려 커밋
// 그림(PNG/SVG)으로 바꿔 끼우기: src/iconart.js 의 ICON_ART 에 id → 주소 (이 파일은 손대지 않음)
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let ROOT;
try { ROOT = require.resolve('@tabler/icons/package.json').replace(/package\.json$/, ''); } catch (e) { console.error('먼저: npm i --no-save @tabler/icons@3.52.0'); process.exit(1); }
const VER = JSON.parse(fs.readFileSync(ROOT + 'package.json', 'utf8')).version;

// id → Tabler 이름. 화면에서 같은 뜻이면 같은 id 를 쓴다 (예: 배낭 칸·내 가방은 둘 다 내 가방을 엶 → bag)
const MAP = {
  // 위쪽 칸·버튼·메뉴
  score: 'shield-star', bag: 'backpack', bloom: 'flower', maximize: 'maximize', minimize: 'minimize',
  feedback: 'mail', more: 'chevron-down', pick: 'hand-grab', jump: 'arrow-big-up-lines', walk: 'walk', run: 'run',
  emote: 'mood-smile', chat: 'message', ach: 'medal', menu: 'menu-2', dex: 'books', ride: 'scooter', shop: 'building-store',
  sign: 'sign-right', xmas: 'christmas-tree', rank: 'trophy', sound: 'volume', tips: 'bulb', settings: 'settings',
  music: 'music', reset: 'restore', boss: 'filled:crown', 'quest-go': 'filled:navigation', quests: 'list-details', reroll: 'refresh',
  download: 'download', share: 'share', close: 'x', check: 'check', dice: 'dice-5', hp: 'filled:heart', heart: 'heart',
  // 상호작용 (지금 될 동작)
  do: 'hand-click', bow: 'bow', bomb: 'bomb', chest: 'treasure-chest', photo: 'camera', sit: 'armchair',
  quest: 'message-exclamation', deer: 'deer', together: 'heart-handshake', stand: 'arrow-big-up', down: 'arrow-big-down-lines',
  fish: 'fish-hook', eat: 'tools-kitchen-2', cut: 'scissors', wear: 'shirt', gear: 'hammer', map: 'map',
  skip: 'player-skip-forward', steps: 'stairs-up', zoom: 'zoom-in', target: 'target-arrow', gift: 'gift', 'arrow-down': 'arrow-down',
  // 능력치·버프
  per: 'stack-2', rate: 'clock', reach: 'arrows-horizontal', speed: 'gauge', dmg: 'swords', magnet: 'magnet', rare: 'sparkles',
  guard: 'shield', regen: 'heart-plus', quick: 'bolt',
  // 도구·탈것 (그림이 없을 때 대신)
  hand: 'hand-stop', vacuum: 'vacuum-cleaner', skate: 'skateboard', horse: 'horse',
  // 날씨
  clear: 'sun', overcast: 'cloud', fog: 'cloud-fog', rain: 'cloud-rain', snow: 'snowflake', wind: 'wind',
  // 증강 (#159)
  'aug-bighand': 'hand-stop', recycle: 'recycle', burst: 'flare', sour: 'lemon-2', bite: 'heart-broken', light: 'feather', jacket: 'shield-half',
  // 업적 뱃지 가운데
  trash: 'trash', shoe: 'shoe', mountain: 'mountain', sunrise: 'sunrise', sunset: 'sunset', boar: 'pig', calendar: 'calendar',
  bottle: 'bottle', vinyl: 'paper-bag', foam: 'box', tools: 'tools', heap: 'stack-3', star: 'filled:star', quests2: 'clipboard-list',
  'smoke-no': 'smoking-no', coins: 'coins', eye: 'eye', unpaid: 'receipt-off', alien: 'alien', crow: 'feather', 'trash-x': 'trash-x', trees: 'trees', notes: 'notes', planet: 'planet', radio: 'speakerphone',
};
// 세트에 없는 것: 같은 24 격자, 선 2, 둥근 끝 (fill 은 currentColor 만)
const OWN = {
  gyul: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 6v-2"/><path d="M12 5.5c.9-1.9 2.8-2.6 5-2-.6 2-2.6 2.8-5 2z"/>', // 귤
  'gyul-throw': '<circle cx="14.5" cy="13" r="6"/><path d="M14.5 7v-1.5"/><path d="M14.5 6.5c.7-1.4 2-1.9 3.6-1.5-.5 1.5-1.9 2-3.6 1.5z"/><path d="M2.5 10h4M3.5 13.5h3.5M2.5 17h4"/>', // 귤 던지기
  hareubang: '<path d="M8 8.5a4 4 0 0 1 8 0"/><path d="M6.5 8.5h11"/><path d="M8 8.5V13a4 4 0 0 0 8 0V8.5"/><path d="M10.3 11h.01M13.7 11h.01M11 14h2"/><path d="M8.5 16v5h7v-5M10.5 18.5h3"/>', // 돌하르방
  gate: '<path d="M5 21V4M19 21V4"/><path d="M3.5 8.5h17M3.5 12.5h17M3.5 16.5h17"/>', // 정낭
  cleanhouse: '<path d="M2.5 9l9.5-5 9.5 5"/><path d="M4.5 8v12.5M19.5 8v12.5"/><path d="M7.5 13.5h3.5v7H7.5zM13 13.5h3.5v7H13z"/><path d="M7.5 15.5h3.5M13 15.5h3.5"/>', // 클린하우스
  tongs: '<path d="M10 3.5c-2.2 0-3.2 1.6-2.6 3.6L11 21M14 3.5c2.2 0 3.2 1.6 2.6 3.6L13 21"/><path d="M10 3.5h4"/>', // 집게
  rake: '<path d="M12 3v10"/><path d="M6 13h12"/><path d="M7 13v7M10.3 13v7M13.7 13v7M17 13v7"/>', // 갈퀴
  bigrake: '<path d="M12 2v10"/><path d="M3 12h18"/><path d="M4 12v8M8 12v8M12 12v8M16 12v8M20 12v8"/>', // 큰 갈퀴
  cairn: '<ellipse cx="12" cy="18.6" rx="6.6" ry="2.4"/><ellipse cx="12" cy="13.4" rx="4.7" ry="2.1"/><ellipse cx="12" cy="8.8" rx="3.3" ry="1.8"/><ellipse cx="12" cy="5" rx="1.9" ry="1.3"/>', // 돌탑
  zone: '<path d="M3 20l6.5-11 4 6 2.5-3.5L21 20z"/><path d="M9.5 9V3.5l4 1.6-4 1.6"/>', // 오름 구역 (깃발 꽂은 봉우리)
  pocket: '<path d="M5 5h14v7a7 7 0 0 1-14 0z"/><path d="M5 9h14"/>', // 호주머니 (배낭 없음)
  cart: '<path d="M4 10a6 6 0 0 1 6 -6h0a6 6 0 0 1 6 6"/><path d="M3 10h14v5h-14z"/><circle cx="7" cy="18" r="2"/><circle cx="13" cy="18" r="2"/><path d="M17 13h4"/>', // 마차: 옆에서 본 지붕 수레 + 바퀴 둘 + 끌채 (#228)
  reel: '<circle cx="9" cy="15" r="5.5"/><circle cx="9" cy="15" r="1.3"/><path d="M14.5 15H18v3M18 2v8M15 5l3-3 3 3"/>', // 낚싯줄 감기
  gun: '<path d="M3 9h13l2 2v3H9l-1 5H5l1-5H3z"/><path d="M18 11.5h3"/><circle cx="20.5" cy="8.5" r="1.5"/>', // 귤 총
  mg: '<path d="M2 9h15l2 2v3H9l-1 5H5l1-5H2z"/><path d="M19 10h3M19 12.5h3M8 9V6h5v3"/>', // 귤 머신건
  laser: '<path d="M3 10h9v4H3z"/><path d="M12 11h2v2h-2M14 12h8M5 14l-1 5h3l1-5"/><path d="M7 7c1-2 3-2 4 0"/>', // 귤즙 레이저
  twin: '<circle cx="8" cy="13" r="4.5"/><circle cx="16.5" cy="11" r="4.5"/><path d="M8 8.5c.4-1.4 1.2-2.3 2.4-2.8M16.5 6.5c.4-1.4 1.2-2.3 2.4-2.8"/>', // 쌍귤
  cloudy: '<path d="M9 3v1M3 9h1M4.8 4.8l.7.7M13.2 4.8l-.7.7"/><path d="M6.2 9.8a3 3 0 0 1 5.6-2"/><path d="M8 20h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.4 1.2A3 3 0 0 0 8 20z"/>', // 구름 조금
  tewak: '<circle cx="12" cy="8" r="5"/><path d="M7.5 8h9"/><path d="M8 13c-1 3 0 7 4 8 4-1 5-5 4-8M9 16h6M9.5 19h5"/>', // 테왁
  field: '<path d="M3 20c3-6 5-6 6-12M9 20c2-4 4-5 6-11M15 20c1-3 3-4 6-9"/>', // 들판
  can: '<path d="M7 5.5h10v14a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5z"/><path d="M7 5.5c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5M7 10h10M7 16h10"/>', // 캔
  // 재료 (#140): 털·이빨·엄니·발톱·부품
  m1: '<path d="M5 18c2-5 3-9 7-13M9 19c1-4 3-8 6-11M13 19c1-3 2-6 6-8M4 20h16"/>',
  m2: '<path d="M8 4h8l-1 7-3 9-3-9z"/>',
  m3: '<path d="M6 4c8 1 12 7 11 16-2-6-6-9-11-10z"/>',
  m4: '<path d="M5 20c3-6 3-12 1-16 5 3 7 8 6 14M11 20c3-5 4-10 3-14 4 3 5 8 3 14"/>',
  m5: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
};

const read = (name) => {
  const filled = name.startsWith('filled:'), n = filled ? name.slice(7) : name;
  const f = ROOT + `icons/${filled ? 'filled' : 'outline'}/${n}.svg`;
  if (!fs.existsSync(f)) throw new Error('Tabler 에 없음: ' + name);
  const s = fs.readFileSync(f, 'utf8').replace(/\n\s*/g, ' ');
  let inner = s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none" ?\/>/g, '')
    .replace(/\s+\/>/g, '/>').replace(/>\s+</g, '><').trim();
  inner = inner.replace(/ (-?\d*\.\d{3,})/g, (m, v) => ' ' + (+(+v).toFixed(2))); // 자릿수 줄이기
  return filled ? `<g fill="currentColor" stroke="none">${inner}</g>` : inner;
};
const ICONS = {}, SRC = {};
for (const [id, n] of Object.entries(MAP)) { ICONS[id] = read(n); SRC[id] = 'tabler:' + n.replace('filled:', '') + (n.startsWith('filled:') ? ' (filled)' : ''); }
for (const [id, s] of Object.entries(OWN)) { if (ICONS[id]) throw new Error('겹친 id: ' + id); ICONS[id] = s; SRC[id] = 'own'; }
// 두 모양을 CSS 로 바꿔 보이는 것 (전체 화면 버튼: 들어가기·나오기)
ICONS.fullscreen = `<g class="fs-in">${ICONS.maximize}</g><g class="fs-out">${ICONS.minimize}</g>`; SRC.fullscreen = 'tabler:maximize + minimize';

const out = `// 아이콘 세트 (#184). 만든 곳: tools/icongen.mjs (손으로 고치지 않는다 — 거기서 고치고 다시 돌림)
// Tabler Icons ${VER} (MIT, THIRD_PARTY.md) 에서 쓰는 것만 옮김 + 세트에 없는 오름오름 것은 같은 격자·굵기로 직접 그림(ICON_SRC 'own')
// 부르기: icon('bag') → <svg> (src/iconart.js 에 그림이 있으면 <img>), ic('bag') → 안쪽 그림만(예전 SVG 틀에 넣을 때)
// page.html 의 <svg data-i="bag"></svg> 는 빌드(build.mjs)가 채움
import { ICON_ART } from './iconart.js';
export const ICONS = ${JSON.stringify(ICONS, null, 0).replace(/","/g, '",\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, ',\n}')};
export const ICON_SRC = ${JSON.stringify(SRC)};
export const SVG_ATTR = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
export const ic = (id) => ICONS[id] || '';
export function icon(id, cls = '') {
  if (ICON_ART[id]) return \`<img class="ic-art\${cls ? ' ' + cls : ''}" src="\${ICON_ART[id]}" alt="" aria-hidden="true" draggable="false">\`;
  return \`<svg \${cls ? \`class="\${cls}" \` : ''}\${SVG_ATTR} data-i="\${id}">\${ICONS[id] || ''}</svg>\`;
}
// HTML 글 안의 빈 <svg data-i="id" …></svg> 를 채움 (빌드·런타임 둘 다)
export const fillIcons = (html) => html.replace(/<svg data-i="([\\w-]+)"([^>]*)><\\/svg>/g, (m, id, rest) => {
  if (!ICONS[id]) throw new Error('없는 아이콘: ' + id);
  return \`<svg data-i="\${id}"\${rest} \${SVG_ATTR}>\${ICONS[id]}</svg>\`;
});
// 이미 있는 <svg> 요소의 그림만 바꿈
export function setIcon(el, id) { if (!el || el.dataset.i === id) return; el.dataset.i = id; el.innerHTML = ICONS[id] || ''; }
`;
fs.writeFileSync('src/icons.js', out);
console.log('src/icons.js', Object.keys(ICONS).length, '개 (Tabler', Object.keys(MAP).length, '· 직접', Object.keys(OWN).length + ')', (out.length / 1024).toFixed(1) + 'KB');
