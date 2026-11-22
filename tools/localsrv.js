// 검사용 로컬 서버 정리 (#259): sec.js·rankrun.js 가 씀
// 앞 실행이 timeout·Ctrl+C 로 끊기면 detached 로 띄운 wrangler(workerd)가 남아 같은 포트를 계속 잡고 있었음.
// 그러면 새 서버는 못 뜨고 /health 는 옛 서버가 답해서, 옛 코드·쌓인 저장으로 검사가 돌아 엉뚱한 줄이 실패함 (날마다 늘어나는 수·지난 날짜)
// - clearPorts(ports, tag): 포트가 이미 답하면 tag(--persist-to 경로 앞 글, 예 'oreum-sec-')로 띄운 남은 서버만 끄고 비워질 때까지 기다림. 그래도 차 있으면 오류
// - killOnExit(getProcs): SIGINT·SIGTERM·SIGHUP 이 와도 띄운 서버 묶음을 끄고 끝냄
const { execSync } = require('child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function busy(port) { try { await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) }); return true; } catch (e) { return false; } }
async function clearPorts(ports, tag) {
  const used = []; for (const p of ports) if (await busy(p)) used.push(p);
  if (!used.length) return;
  console.log(`남은 로컬 서버 정리 (포트 ${used.join(', ')} · ${tag})`);
  for (const pat of used.flatMap((p) => [`wrangler dev --local --port ${p} .*${tag}`, `workerd serve.*entry=localhost:${p} `])) { try { execSync(`pkill -f '${pat}'`, { stdio: 'ignore' }); } catch (e) { /* 없음 */ } }
  for (let i = 0; i < 20; i++) { let any = false; for (const p of used) if (await busy(p)) any = true; if (!any) return; await sleep(500); }
  throw new Error(`포트 ${used.join(', ')} 를 다른 프로그램이 쓰는 중 (검사 서버를 띄울 수 없음)`);
}
function killOnExit(getProcs) {
  const kill = () => { for (const p of getProcs()) { try { process.kill(-p.pid); } catch (e) { /* 이미 끝남 */ } } };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { kill(); process.exit(130); });
  return kill;
}
module.exports = { clearPorts, killOnExit };
