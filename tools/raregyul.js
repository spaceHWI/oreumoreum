// 귀한 귤 (#130) 확인: node tools/raregyul.js [횟수=100] [--seed N]
// 적 종류·투기꾼마다 N 번 쫓아냈을 때 나온 귀한 귤 종류 수, 기댓값으로 늘어나는 귤 몫(%), 한 번에 가장 큰 귀한 귤(서버 NET.earnBurst 안인지)
(async () => {
  const B = await import('../src/balance.js');
  const R = await import('../src/raregyul.js');
  const { ENEMIES, ENEMY_DROP, DUMP, NET, RARE_GYUL } = B;
  const N = Number(process.argv.find((a) => /^\d+$/.test(a))) || 100;
  const si = process.argv.indexOf('--seed'); let seed = si > 0 ? Number(process.argv[si + 1]) || 1 : 130;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1e6) / 1e6; };
  const who = [...Object.keys(ENEMIES).filter((k) => RARE_GYUL.chance[k]).map((k) => [k, ENEMIES[k].name, ENEMIES[k].reward.gyul, ENEMY_DROP.max]), ['walker', DUMP.walker.name, DUMP.walker.reward, Infinity], ['truck', DUMP.truck.name, DUMP.truck.reward, Infinity]];
  const names = R.RG_KINDS.map((k) => k.name);
  console.log(`| 누가 | 귤 | ${names.join(' | ')} | ${N}번 귀한 귤 합 | 늘어난 몫(기댓값) | 가장 큰 귀한 귤 |`);
  console.log(`|---|---|${names.map(() => '---|').join('')}---|---|---|`);
  let bad = 0;
  for (const [k, nm, g, mx] of who) {
    const cnt = names.map(() => 0); let got = 0;
    for (let i = 0; i < N; i++) { const s = R.splitRare(k, g, mx, rnd); if (s.kind) { cnt[R.RG_BY[s.kind.id].i]++; got += s.v - (g - s.rest); } }
    const ev = R.rareEV(k, g, mx), big = R.rareMax(k, g, mx), pct = ev / g * 100;
    if (pct > 15 || big + g > NET.earnBurst) bad++;
    console.log(`| ${nm} | ${g} | ${cnt.join(' | ')} | +${got} | +${pct.toFixed(1)}% | ${big} |`);
  }
  console.log(bad ? `FAIL ${bad}곳이 +15% 를 넘거나 earnBurst(${NET.earnBurst}) 를 넘음` : `OK 모두 +15% 안, 가장 큰 귀한 귤도 earnBurst(${NET.earnBurst}) 안`);
  if (bad) process.exitCode = 1;
})();
