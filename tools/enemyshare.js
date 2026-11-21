// 보통 적 같이 보이기 시험 재기 (#181): node tools/enemyshare.js [인원들=10,20,30] [구역 적=30]
// 구역 주인 방식을 흉내 냄: 사람은 5구역에 고르게 흩어지고, 구역마다 주인 한 사람이 그 구역 적 상태를
//   {t:'es', z, e:[[번호, x, z, 방향, 상태, 기운%]…]} 로 보냄 (가까운 적 초당 5번, 30m 밖 적은 초당 1번). 방은 같은 구역 다른 사람에게 그대로 중계
// 바탕(지금 방)은 tools/loadtest.js --core 와 같은 흐름(server/src/roomcore.js 를 Node 에서)으로 재고, 적 몫은 메시지 크기 × 받는 사람 수로 더함
// 기준(#181 사용자 결정): 30명 기준 #115 뒤 값에서 20% 넘게 늘면 보통 적 공유는 넣지 않음
const COUNTS = (process.argv[2] || '10,20,30').split(',').map(Number);
const NE = +(process.argv[3] || 30), ZONES = 5, NEAR_K = 2 / 3; // 주인 둘레 30m 안 적 비율 (임의: 싸우는 중이면 대부분 가까움)
const rnd = (a, b) => a + Math.random() * (b - a), r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const OUTFIT = { hr: 'bun', hrc: '#2a221c', sk: '#ffdcbf', h: 'cap', hc: '#5c9a3c', hb: 1, g: 'none', v: 'on', vc: '#e2683c', s: '#e8d9b5', st: 'tee', p: 'shorts', pc: '#8a6a3c', sh: '#26262b', sht: 'road', gr: { hand: 'hand:tongs', back: 'back:pack1', shoes: 'shoes:road', hat: 'hat:w-cap', top: 'top:w-tee', bottom: 'bottom:w-shorts' } };
function enemyMsg(z, n) {
  const e = []; for (let i = 0; i < n; i++) e.push([i, r1(rnd(-900, 900)), r1(rnd(-900, 900)), r2(rnd(-3.14, 3.14)), (Math.random() * 5) | 0, (Math.random() * 100) | 0]);
  return JSON.stringify({ t: 'es', z, e });
}
(async () => {
  const { createRoomCore } = await import('../server/src/roomcore.js');
  const rows = [];
  for (const n of COUNTS) {
    // 바탕: 지금 방 (10초)
    let out = 0, inB = 0, msgsOut = 0, msgsIn = 0;
    const core = createRoomCore({ cap: 1000 });
    const ps = []; for (let i = 0; i < n; i++) ps.push(core.join((s) => { out += s.length; msgsOut++; }));
    const pos = ps.map((_, i) => ({ x: -860 + (i % 5) * 40 + rnd(-20, 20), z: rnd(-30, 30), h: 0 }));
    for (let k = 0; k < 100; k++) {
      ps.forEach((p, i) => { const q = pos[i]; q.h += rnd(-0.15, 0.15); q.x += Math.sin(q.h) * 0.6; q.z += Math.cos(q.h) * 0.6; const s = JSON.stringify({ t: 'p', d: { ...(k % 100 === 0 ? { nick: '부하' + i, o: OUTFIT } : {}), x: r1(q.x), z: r1(q.z), h: r2(q.h), run: false, pose: 'move', jy: 0, spd: 3.2 } }); inB += s.length; msgsIn++; core.message(p, s); });
      core.step(); await new Promise((r) => setTimeout(r, 100));
    }
    const base = { inKBs: inB / 10 / 1024, outKBs: out / 10 / 1024, perKBs: out / 10 / 1024 / n, msgs: (msgsIn + msgsOut) / 10 };
    // 적 몫: 사람이 있는 구역마다 주인 하나
    const per = Array.from({ length: ZONES }, (_, z) => Math.floor(n / ZONES) + (z < n % ZONES ? 1 : 0)).filter((c) => c > 0);
    let eIn = 0, eOut = 0, eMsgIn = 0, eMsgOut = 0;
    per.forEach((c, z) => {
      const near = enemyMsg(z + 1, Math.round(NE * NEAR_K)).length, far = enemyMsg(z + 1, NE - Math.round(NE * NEAR_K)).length;
      const bIn = near * 5 + far * 1, mIn = 5 + 1; // 1초에
      eIn += bIn; eMsgIn += mIn; eOut += bIn * (c - 1); eMsgOut += mIn * (c - 1);
    });
    const add = { inKBs: eIn / 1024, outKBs: eOut / 1024, perKBs: eOut / 1024 / n, msgs: eMsgIn + eMsgOut };
    rows.push({ n, base, add });
    const pc = (a, b) => (b > 0 ? '+' + (a / b * 100).toFixed(0) + '%' : '-');
    console.log(`${n}명 (구역 ${per.length}곳, 구역 적 ${NE}): 방이 받는 양 ${base.inKBs.toFixed(1)} → ${(base.inKBs + add.inKBs).toFixed(1)}KB/s (${pc(add.inKBs, base.inKBs)}) · 사람당 받는 양 ${base.perKBs.toFixed(1)} → ${(base.perKBs + add.perKBs).toFixed(1)}KB/s (${pc(add.perKBs, base.perKBs)}) · 방 메시지 ${base.msgs.toFixed(0)} → ${(base.msgs + add.msgs).toFixed(0)}개/s (${pc(add.msgs, base.msgs)})`);
  }
  process.exit(0);
})();
