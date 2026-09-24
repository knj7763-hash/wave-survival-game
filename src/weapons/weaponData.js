// 무기 7종 데이터. levels[0..2] = 일반 → 강화 → 전설.
// range: 이 거리 안에 적이 있어야 발사 (px), cooldown: 발사 간격 (ms)
// 등급은 상점에서 코인으로 올리고 런 중에는 바뀌지 않는다 (shop/shopData.js).
// 등급이 오르면 수치뿐 아니라 공격 형태가 바뀐다. pattern: 상점 카드에 보여줄 형태 변화 설명.
// burst: 연발 수 (burstGapMs 간격으로 차례로 발사)

export const TIER_NAMES = ['일반', '강화', '전설'];

export const WEAPONS = {
  gun: {
    name: '총',
    desc: '중거리 단발 사격',
    sfx: 'shoot', sfxVolume: 0.4,
    // 단발 → 2연발 → 3연발 + 약한 관통. 기본 지급 무기.
    levels: [
      { range: 380, damage: 10, cooldown: 450, speed: 700, burst: 1 },
      { range: 400, damage: 14, cooldown: 380, speed: 750, burst: 2, burstGapMs: 70, pattern: '2연발' },
      { range: 420, damage: 18, cooldown: 320, speed: 800, burst: 3, burstGapMs: 60, pierce: 1, pattern: '3연발 + 관통 1' },
    ],
  },
  sword: {
    name: '칼',
    desc: '근거리 부채꼴 베기, 범위 내 다수 타격',
    sfx: 'swish', sfxVolume: 0.6,
    // 근접 연타 → 베기 부채꼴 확장 → spinEvery번째 베기마다 360도 회전베기
    levels: [
      { range: 120, damage: 12, cooldown: 700, arcDeg: 110 },
      { range: 135, damage: 17, cooldown: 600, arcDeg: 180, pattern: '베기 범위 대폭 확장' },
      { range: 150, damage: 24, cooldown: 500, arcDeg: 180, spinEvery: 4, pattern: '4번째 베기마다 360도 회전베기' },
    ],
  },
  bow: {
    name: '활',
    desc: '장거리 관통 화살, 발사속도 느림',
    sfx: 'shoot', sfxVolume: 0.5,
    // 관통 단발 → 2발 동시 발사(각도 벌어짐) → 명중 시 파편 화살로 분열 (화살당 첫 명중 1회)
    levels: [
      { range: 650, damage: 18, cooldown: 1300, speed: 800, pierce: 2, arrows: 1 },
      { range: 700, damage: 25, cooldown: 1150, speed: 850, pierce: 3, arrows: 2, spreadDeg: 16, pattern: '2발 동시 발사' },
      {
        range: 750, damage: 35, cooldown: 1000, speed: 900, pierce: 5, arrows: 2, spreadDeg: 16,
        splitCount: 3, splitDamageRatio: 0.4, splitRange: 220, splitSpreadDeg: 60, pattern: '명중 시 파편 화살 3개로 분열',
      },
    ],
  },
  knuckle: {
    name: '너클',
    desc: '초근거리 초고속 연타',
    sfx: 'swish', sfxVolume: 0.3,
    // 빠른 연타 → heavyEvery타마다 강타(넉백) → 연타 중 주먹 오라가 주변에 지속 피해
    levels: [
      { range: 75, damage: 4, cooldown: 180, hitRadius: 40 },
      { range: 80, damage: 6, cooldown: 150, hitRadius: 45, heavyEvery: 3, heavyMul: 2.5, pattern: '3타마다 강타 (넉백)' },
      {
        range: 85, damage: 8, cooldown: 120, hitRadius: 50, heavyEvery: 3, heavyMul: 2.5,
        auraRadius: 90, auraDamage: 3, auraTickMs: 250, auraLingerMs: 400, pattern: '주먹 오라 (주변 지속 피해)',
      },
    ],
  },
  crossbow: {
    name: '석궁',
    desc: '강력한 중~장거리 단발, 발사속도 느림',
    sfx: 'shoot', sfxVolume: 0.7,
    // 강한 단발 → 2연사 → 착탄 시 소폭 범위 폭발 (blastRatio: 본 피해 대비 폭발 피해)
    levels: [
      { range: 520, damage: 28, cooldown: 1100, speed: 900, burst: 1 },
      { range: 560, damage: 38, cooldown: 1000, speed: 950, burst: 2, burstGapMs: 120, pattern: '2연사' },
      {
        range: 600, damage: 52, cooldown: 850, speed: 1000, burst: 2, burstGapMs: 120,
        blastRadius: 70, blastRatio: 0.5, pattern: '착탄 시 범위 폭발',
      },
    ],
  },
  shotgun: {
    name: '샷건',
    desc: '부채꼴 다중 탄환, 가까울수록 강함',
    sfx: 'blast', sfxVolume: 0.6,
    // 근~중거리 부채꼴 다중 탄환. 멀수록 데미지 감소 (최대 falloff 비율만큼). 5발 → 7발 → 관통
    levels: [
      { range: 300, damage: 8, cooldown: 1000, speed: 650, pellets: 5, spreadDeg: 40, falloff: 0.6 },
      { range: 320, damage: 10, cooldown: 900, speed: 700, pellets: 7, spreadDeg: 45, falloff: 0.55, pattern: '탄환 7발' },
      { range: 340, damage: 13, cooldown: 800, speed: 750, pellets: 7, spreadDeg: 50, falloff: 0.5, pierce: 1, pattern: '탄환 관통' },
    ],
  },
  laser: {
    name: '레이저',
    desc: '화면 끝까지 닿는 관통 빔, 지속 데미지',
    sfx: 'zap', sfxVolume: 0.6,
    // 화면 끝까지 닿는 관통 빔. duration 동안 tickMs마다 데미지, 이후 재사용 대기
    // 단일 빔 → 2갈래 → 3갈래 + 빔 폭 증가 (beamSpreadDeg: 바깥 빔 사이 전체 각도)
    levels: [
      { range: 1500, damage: 6, cooldown: 4000, duration: 800, tickMs: 100, width: 14, beams: 1 },
      { range: 1500, damage: 9, cooldown: 3500, duration: 1000, tickMs: 100, width: 18, beams: 2, beamSpreadDeg: 20, pattern: '빔 2갈래 분리' },
      { range: 1500, damage: 13, cooldown: 3000, duration: 1300, tickMs: 100, width: 28, beams: 3, beamSpreadDeg: 30, pattern: '빔 3갈래 + 굵어짐' },
    ],
  },
};

// 상점 카드에 보여줄 능력치 이름과 표시 형식
const STAT_LABELS = {
  damage: ['데미지', (v) => v],
  cooldown: ['공격 간격', (v) => `${(v / 1000).toFixed(2)}초`],
  range: ['사거리', (v) => v],
  pierce: ['관통', (v) => v],
  pellets: ['탄환 수', (v) => v],
  arcDeg: ['베기 각도', (v) => `${v}°`],
  hitRadius: ['타격 범위', (v) => v],
  duration: ['지속시간', (v) => `${(v / 1000).toFixed(1)}초`],
  width: ['빔 굵기', (v) => v],
};

// 다음 등급의 형태 변화(★)와 바뀌는 능력치("데미지 10 → 14")를 줄 단위로 반환
export function describeUpgrade(id, fromLevel) {
  const before = WEAPONS[id].levels[fromLevel - 1];
  const after = WEAPONS[id].levels[fromLevel];
  const stats = Object.entries(STAT_LABELS)
    .filter(([key]) => key in before && key in after && before[key] !== after[key])
    .map(([key, [label, fmt]]) => `${label} ${fmt(before[key])} → ${fmt(after[key])}`);
  return after.pattern ? [`★ ${after.pattern}`, ...stats] : stats;
}
