// 게임 모듈 목록 (#85 에서 main.js 에서 옮김). 기능별 파일(src/game/)을 아래 순서대로 읽는다 (#86). 순서가 곧 초기화 순서
// 먼저 바깥 모듈을 예전 main.js 와 같은 순서로 읽어 둔다 (boot.js 가 맨 먼저)
import './boot.js';
import './namsongi.js';
import './footprints.js';
import './trash.js';
import './dexicons.js';
import './balance.js';
import './quality.js';
import './photographer.js';
import './rides.js';
import './logo.js';
import './streetlayout.js';
import './shops.js';
import './leap.js';
import './salon.js';
import './buff.js';
import './stoneicons.js';
import './stonelogo.js';
import './zones.js';
import './hp.js';
import './stream.js';
import './fishing.js';
import './streamshape.js';
import './collide.js';
import './gear.js';
import './weaponmodels.js'; // 무기 3~6단계 손에 든 모양 (#123)
import './cleanhouse.js';
import './autowalk.js';
import './toon.js';
import './retro.js';
import './devlabels.js';
import './version.js';
import './badgeicons.js';
import './world.js';
import './gfx2.js';
import './donnaeko.js';
import './gate.js';
import './tutorial.js';
import './lamps.js';
import './runner.js';
import './clothicons.js';
import './audio.js';
import './net.js';
import './life.js';
import './dumpers.js';
import './bloom.js';
import './bloomfx.js';
import './social.js';
import './props.js';
import './maps.js';
import './nsbound.js';
import './stonewall.js';
import './weather.js';
import './sun.js';
import './achievements.js';
import './server.js';
import './uitips.js';
import './emotes.js';
import './tips.js';
import './online.js';
import './feedback.js';
import './game/save.js';
import './game/scene.js';
import './game/place.js';
import './game/camera.js';
import './game/hud.js';
import './game/director.js'; // 감독 (#176): 말을 거는 것을 한 번에 하나씩
import './game/input.js';
import './game/menu.js';
import './game/throw.js';
import './game/arms.js'; // 무기 3~6단계 (#123)
import './game/charge.js'; // 모아 쏘기 (#129)
import './game/panels.js';
import './game/screen.js';
import './game/ride.js';
import './game/moves.js';
import './game/room.js';
import './game/stores.js';
import './game/pickup.js';
import './game/area.js';
import './game/deernet.js';
import './game/dump.js';
import './game/field.js'; // 맵 전체 쓰기 (#138)
import './game/guard.js'; // 구역 지킴이 돌하르방 (#119)
import './game/shop.js';
import './game/look.js';
import './game/bag.js'; // 내 가방 (#166)
import './game/hooks.js';
import './game/guide.js';
import './game/pace.js';
import './game/zonedone.js'; // 구역 완료 요약·깨어나는 곳·빠른 마차·지름길 (#139, hooks 뒤: 적 후크를 감쌈)
import './game/boss.js'; // 구역 우두머리 (#139)
import './game/level.js'; // 레벨과 증강 (#159, boss 뒤: 적·우두머리 후크를 감쌈)
import './game/start.js';
import './game/update.js';
import './game/debug.js';
