// 레스토랑 스톤 (#50) 그림: 메뉴 음식(접시 위 음식, 아이콘풍)·버프 아이콘·포크와 나이프. viewBox 0 0 64 64 / 24 24
const plate = '<ellipse cx="32" cy="40" rx="27" ry="15" fill="#f4f1ea"/><ellipse cx="32" cy="38" rx="20" ry="10.5" fill="#e4dfd3"/>';
export const FOOD_SVG = {
  pasta: plate + '<path d="M17 37c3-8 27-9 30 0c-2 6-27 7-30 0z" fill="#f2b56a"/><path d="M21 36c4-4 9-1 12-4s9-2 11 1M20 39c6 1 9-3 14-1s8 1 10-1M26 33c3 2 6-2 9 0" stroke="#d98a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="27" cy="35" r="1.6" fill="#d8352a"/><circle cx="37" cy="37" r="1.4" fill="#d8352a"/><circle cx="33" cy="33" r="1.2" fill="#d8352a"/><path d="M40 31l2-3M42 32l3-2" stroke="#3d9a4a" stroke-width="1.6" stroke-linecap="round"/>',
  gnocchi: plate + '<path d="M16 38c2-8 30-8 32 0c-3 6-29 6-32 0z" fill="#e0703c"/><g fill="#f3d79a" stroke="#d2a860" stroke-width="1"><ellipse cx="24" cy="37" rx="3.4" ry="2.4"/><ellipse cx="31" cy="39" rx="3.4" ry="2.4"/><ellipse cx="37" cy="36" rx="3.4" ry="2.4"/><ellipse cx="29" cy="34" rx="3" ry="2.2"/></g><path d="M38 32c4-4 9-2 9 2c0 3-4 4-6 2" fill="none" stroke="#ff8a5c" stroke-width="3.4" stroke-linecap="round"/><path d="M46 30l3-3" stroke="#ff8a5c" stroke-width="1.4"/>',
  steak: plate + '<path d="M18 37c0-6 10-9 17-8s12 4 11 8-9 6-16 6-12-2-12-6z" fill="#7a4a2c"/><path d="M22 34l5 5M28 32l6 6M34 32l6 5" stroke="#5a321c" stroke-width="1.6" stroke-linecap="round"/><path d="M44 41c3 0 5-1 6-3" stroke="#3d9a4a" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="40" r="2.6" fill="#f2c94c"/>',
  pizza: '<circle cx="32" cy="36" r="24" fill="#e1b064"/><circle cx="32" cy="36" r="20" fill="#d94b2b"/><g fill="#fff6e0"><circle cx="25" cy="30" r="4"/><circle cx="39" cy="31" r="3.6"/><circle cx="33" cy="43" r="4.2"/><circle cx="22" cy="42" r="3"/></g><g fill="#3d9a4a"><ellipse cx="30" cy="36" rx="2.6" ry="1.4" transform="rotate(-30 30 36)"/><ellipse cx="41" cy="40" rx="2.6" ry="1.4" transform="rotate(20 41 40)"/><ellipse cx="27" cy="26" rx="2.4" ry="1.3"/></g><path d="M32 12v48M8 36h48" stroke="#b9853f" stroke-width="1" opacity=".5"/>',
  salad: plate + '<g fill="#6fae4a"><path d="M16 38c2-7 9-9 14-6-4 5-9 8-14 6z"/><path d="M48 38c-2-7-9-9-14-6 4 5 9 8 14 6z"/><path d="M24 33c3-6 13-6 16 0-5 3-11 3-16 0z" fill="#8cc35a"/></g><g fill="#fffaf0"><circle cx="28" cy="38" r="3.2"/><circle cx="36" cy="37" r="2.8"/><circle cx="32" cy="41" r="2.4"/></g><circle cx="22" cy="35" r="1.8" fill="#d8352a"/><circle cx="42" cy="36" r="1.8" fill="#d8352a"/>',
  ade: '<ellipse cx="32" cy="56" rx="14" ry="4" fill="#000" opacity=".18"/><path d="M20 16h24l-3 38a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3z" fill="#ffffff" opacity=".25"/><path d="M21.5 27h21l-2 26a3 3 0 0 1-3 3H26.5a3 3 0 0 1-3-3z" fill="#c2416b"/><rect x="26" y="30" width="6" height="6" rx="1" fill="#fff" opacity=".55"/><rect x="33" y="36" width="5" height="5" rx="1" fill="#fff" opacity=".45"/><path d="M36 6l-4 24" stroke="#f7f5ee" stroke-width="2.4" stroke-linecap="round"/><circle cx="42" cy="24" r="5" fill="#7a2b4f"/><path d="M42 19c1-2 3-3 5-3" stroke="#3d9a4a" stroke-width="1.6" fill="none"/>',
};
// 버프 아이콘 (24, 선)
export const BUFF_ICON = {
  speed: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  bag: '<path d="M7 8h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM9 8V6a3 3 0 0 1 6 0v2M12 12v5M9.5 14.5h5"/>',
  dmg: '<circle cx="10" cy="14" r="6"/><path d="M10 8c0-2 1-3 3-4M15 10l6-6M18 4h3v3"/>',
  pick: '<path d="M12 3v11M7 21l5-7 5 7M17 4l3 3M20 4l-3 3"/>',
  regen: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M12 10v5M9.5 12.5h5"/>',
};
export const FORK_KNIFE = '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2 1-3 4-3 8h3"/>';
// 버프 수치 글자: +20%, ×2
export const buffText = (m) => (m.buff === 'regen' ? `×${m.v}` : `+${Math.round(m.v * 100)}%`);
