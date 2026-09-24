// 레벨업 효과 7종 데이터. 무기와 별개로 자동 발동하며, 런 중 레벨업 때만 얻는다.
// levels[0..2] = Lv1 → Lv2 → Lv3. cooldownMs: 발동 간격, tickMs: 장판/궤도 피해 간격 (같은 적 기준)
// summary(stats): 레벨업 카드에 보여줄 한 줄 요약

export const MAX_EFFECT_LEVEL = 3;
export const MAX_OWNED_EFFECTS = 6;

export const LEVEL_UP_EFFECTS = {
  orbit: {
    name: '오라 실드',
    icon: '🔮',
    color: 0x80deea,
    desc: '플레이어 주위를 도는 구체가 닿은 적에게 피해',
    summary: (s) => `구체 ${s.orbs}개 · 피해 ${s.damage}`,
    // radius: 궤도 반지름, orbRadius: 구체 판정 반지름, spinDegPerSec: 회전 속도
    levels: [
      { orbs: 2, damage: 22, radius: 85, orbRadius: 14, spinDegPerSec: 200, tickMs: 450 },
      { orbs: 3, damage: 31, radius: 95, orbRadius: 15, spinDegPerSec: 220, tickMs: 400 },
      { orbs: 4, damage: 42, radius: 105, orbRadius: 16, spinDegPerSec: 240, tickMs: 350 },
    ],
  },
  soccer: {
    name: '축구공',
    icon: '⚽',
    color: 0xffffff,
    desc: '가까운 적에게 차례로 튕겨 다니며 여러 번 피해',
    summary: (s) => `${s.balls > 1 ? `공 ${s.balls}개 · ` : ''}튕김 ${s.bounces}회 · 피해 ${s.damage}`,
    // bounces: 첫 명중 후 다음 적으로 튕기는 횟수, bounceRange: 튕길 다음 적을 찾는 거리
    levels: [
      { balls: 1, bounces: 3, damage: 40, speed: 560, range: 420, bounceRange: 260, cooldownMs: 2200 },
      { balls: 1, bounces: 5, damage: 50, speed: 600, range: 440, bounceRange: 280, cooldownMs: 1900 },
      { balls: 2, bounces: 6, damage: 62, speed: 640, range: 460, bounceRange: 300, cooldownMs: 1700 },
    ],
  },
  chain: {
    name: '번개 체인',
    icon: '⚡',
    color: 0x64b5f6,
    desc: '주기적으로 무작위 적에게 낙뢰, 주변 적에게 연쇄',
    summary: (s) => `대상 ${s.targets}명 · 피해 ${s.damage}`,
    // targets: 첫 낙뢰 포함 연쇄로 맞는 적 수, chainRange: 다음 대상을 찾는 거리
    levels: [
      { targets: 2, damage: 60, chainRange: 220, cooldownMs: 2600 },
      { targets: 4, damage: 80, chainRange: 240, cooldownMs: 2300 },
      { targets: 6, damage: 100, chainRange: 260, cooldownMs: 2000 },
    ],
  },
  saw: {
    name: '회전 톱날',
    icon: '🪚',
    color: 0xb0bec5,
    desc: '진행 방향 앞에 회전 칼날 장판을 깔아 지속 피해',
    summary: (s) => `반경 ${s.radius} · 틱당 ${s.damage} · ${s.durationMs / 1000}초`,
    // offset: 플레이어 앞 몇 px 지점에 생기는지
    levels: [
      { radius: 50, damage: 20, durationMs: 2200, tickMs: 250, offset: 110, cooldownMs: 3200 },
      { radius: 62, damage: 25, durationMs: 2700, tickMs: 250, offset: 120, cooldownMs: 2800 },
      { radius: 76, damage: 34, durationMs: 3200, tickMs: 220, offset: 130, cooldownMs: 2400 },
    ],
  },
  missile: {
    name: '유도 미사일',
    icon: '🚀',
    color: 0xff7043,
    desc: '가장 가까운 적을 추적해 폭발하는 미사일 자동 발사',
    summary: (s) => `미사일 ${s.count}발 · 피해 ${s.damage} · 폭발 반경 ${s.blastRadius}`,
    // turnDegPerSec: 초당 선회 각도, lifeMs: 대상이 없어도 이 시간이 지나면 자폭
    levels: [
      { count: 1, damage: 65, blastRadius: 50, speed: 380, turnDegPerSec: 240, lifeMs: 2600, cooldownMs: 2200 },
      { count: 2, damage: 80, blastRadius: 58, speed: 410, turnDegPerSec: 270, lifeMs: 2600, cooldownMs: 1900 },
      { count: 3, damage: 95, blastRadius: 66, speed: 440, turnDegPerSec: 300, lifeMs: 2600, cooldownMs: 1600 },
    ],
  },
  spikes: {
    name: '가시 장판',
    icon: '🌵',
    color: 0x8d6e63,
    desc: '발밑에 주기적으로 가시 지대가 솟아 지속 피해',
    summary: (s) => `반경 ${s.radius} · 틱당 ${s.damage} · ${s.durationMs / 1000}초`,
    levels: [
      { radius: 65, damage: 17, durationMs: 2500, tickMs: 300, cooldownMs: 2600 },
      { radius: 80, damage: 22, durationMs: 3000, tickMs: 300, cooldownMs: 2300 },
      { radius: 95, damage: 30, durationMs: 3500, tickMs: 280, cooldownMs: 2000 },
    ],
  },
  boomerang: {
    name: '부메랑',
    icon: '🪃',
    color: 0xffca28,
    desc: '적을 향해 던지면 되돌아오는 관통 투사체 (갈 때·올 때 모두 타격)',
    summary: (s) => `부메랑 ${s.count}개 · 피해 ${s.damage} · 사거리 ${s.distance}`,
    // distance: 최대 비행 거리, flightMs: 나갔다 돌아오기까지의 시간, spreadDeg: 여러 개일 때 벌어지는 각도
    levels: [
      { count: 1, damage: 45, distance: 300, flightMs: 1100, spreadDeg: 0, cooldownMs: 1900 },
      { count: 2, damage: 56, distance: 340, flightMs: 1150, spreadDeg: 30, cooldownMs: 1700 },
      { count: 3, damage: 70, distance: 380, flightMs: 1200, spreadDeg: 40, cooldownMs: 1500 },
    ],
  },
};

// 레벨업 카드에 보여줄 설명 줄
export function describeEffect(id, level) {
  const effect = LEVEL_UP_EFFECTS[id];
  const stats = effect.levels[level - 1];
  if (level === 1) return [effect.desc, '', effect.summary(stats)];
  const before = effect.summary(effect.levels[level - 2]);
  return [before, '↓', effect.summary(stats)];
}
