// 전리품 확인 (#140): 적 종류마다 200번 쫓아냈을 때 떨어지는 재료·장비 수, 소굴·보물·우두머리 200번, 강화 값 표
//   node tools/loot.js            (구역 n 적은 칸 10개가 모두 n단계인 저장으로 굴림, 무작위는 고정)
//   node tools/loot.js 1000       횟수 바꾸기
(async () => {
  const B = await import('../src/balance.js');
  const L = await import('../src/loot.js');
  const { ENEMY_SPAWN, ENEMIES, LOOT, GROWTH, CLOTHES, WEAR } = B;
  const N = +process.argv[2] || 200;
  let x = 140; const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const saveAt = (z) => { const wear = {}, own = {}; for (const w of WEAR.slots) { const c = CLOTHES.find((c) => c.slot === w.k && c.tier === z); wear[w.k] = c.id; own[c.id] = 1; } return { coins: 0, equip: { tool: z, bag: z, shoes: z, weapon: z === 5 ? 6 : z }, weaponUse: z === 5 ? 6 : z, clothes: { own, wear, up: {} }, gearUp: {}, mats: {}, loot: [], lootAuto: 1 }; };
  const run = (src, z) => {
    const s = saveAt(z), mats = {}, g = [0, 0, 0, 0]; let gear = 0;
    for (let i = 0; i < N; i++) { const d = L.rollDrop(s, src, z, rnd); for (const [k, v] of Object.entries(d.mats)) mats[k] = (mats[k] || 0) + v; if (d.gear) { gear++; g[d.gear.g]++; } }
    return { mats: Object.entries(mats).map(([k, v]) => `${L.MAT[k].name} ${v}`).join(' · '), gear, g: g.join('/') };
  };
  console.log(`== 적 종류마다 ${N}번 쫓아냄 (재료 ${LOOT.enemy.mat * 100}%, 장비 ${LOOT.enemy.gear * 100}%) ==`);
  const rows = [];
  for (const [z, kind] of Object.entries(ENEMY_SPAWN.byZone)) { const r = run('enemy', +z); rows.push({ 구역: +z, 적: ENEMIES[kind].name, 재료: r.mats, 장비: r.gear, '등급 보통/좋은/귀한/전설': r.g }); }
  console.table(rows);
  for (const src of ['den', 'treasure', 'boss']) {
    console.log(`== ${{ den: '소굴 닫기', treasure: '숨은 보물', boss: '우두머리' }[src]} ${N}번 ==`);
    console.table([1, 2, 3, 4, 5].map((z) => { const r = run(src, z); return { 구역: z, 재료: r.mats, 장비: r.gear, '등급 보통/좋은/귀한/전설': r.g }; }));
  }
  console.log('== 강화 값 (한 칸, +0 → +5 합) ==');
  console.table([1, 2, 3, 4, 5, 6].map((t) => { let n = 0, rn = 0, gy = 0; const steps = []; for (let e = 0; e < GROWTH.enhMax; e++) { const c = L.enhCost(t, e); n += c.n; rn += c.rn; gy += c.gyul; steps.push(`${c.n}${c.rn ? '+귀' + c.rn : ''}·${c.gyul}`); } return { 단계: t, 재료: L.matOfZone(Math.min(5, t)).name, '재료 합': n, '귀한 재료': rn, '귤 합': gy, '+1~+5 (재료·귤)': steps.join(' / ') }; }));
  console.log('귤로 바꾸기 (5단계):', [0, 1, 2, 3].map((g) => `${LOOT.gradeName[g]} ${L.sellValue({ s: 'tool', t: 5, g, e: 0 })}`).join(' · '), '· 점수 5단계', [0, 1, 2, 3].map((g) => `${L.itemPts({ t: 5, g, e: 0 })}/+5 ${L.itemPts({ t: 5, g, e: 5 })}`).join(' · '));
})();
