// 무기 7종 데이터. levels[0..2] = 일반 → 강화 → 전설.
// range: 이 거리 안에 적이 있어야 발사 (px), cooldown: 발사 간격 (ms)

export const TIER_NAMES = ['일반', '강화', '전설'];

export const WEAPONS = {
  gun: {
    name: '총',
    desc: '중거리 단발 사격',
    sfx: 'shoot', sfxVolume: 0.4,
    // 중거리 단발 정확 사격. 시작 무기.
    levels: [
      { range: 380, damage: 10, cooldown: 450, speed: 700, count: 1 },
      { range: 400, damage: 14, cooldown: 380, speed: 750, count: 1 },
      { range: 420, damage: 18, cooldown: 320, speed: 800, count: 2 },
    ],
  },
  sword: {
    name: '칼',
    desc: '근거리 부채꼴 베기, 범위 내 다수 타격',
    sfx: 'swish', sfxVolume: 0.6,
    // 근거리 부채꼴 베기, 범위 안 다수 타격
    levels: [
      { range: 120, damage: 12, cooldown: 700, arcDeg: 110 },
      { range: 135, damage: 17, cooldown: 600, arcDeg: 130 },
      { range: 150, damage: 24, cooldown: 500, arcDeg: 160 },
    ],
  },
  bow: {
    name: '활',
    desc: '장거리 관통 화살, 발사속도 느림',
    sfx: 'shoot', sfxVolume: 0.5,
    // 장거리 관통, 발사속도 느림
    levels: [
      { range: 650, damage: 18, cooldown: 1300, speed: 800, pierce: 2 },
      { range: 700, damage: 25, cooldown: 1150, speed: 850, pierce: 3 },
      { range: 750, damage: 35, cooldown: 1000, speed: 900, pierce: 5 },
    ],
  },
  knuckle: {
    name: '너클',
    desc: '초근거리 초고속 연타',
    sfx: 'swish', sfxVolume: 0.3,
    // 초근거리 매우 빠른 연타, 개별 데미지 낮음
    levels: [
      { range: 75, damage: 4, cooldown: 180, hitRadius: 40 },
      { range: 80, damage: 6, cooldown: 150, hitRadius: 45 },
      { range: 85, damage: 8, cooldown: 120, hitRadius: 50 },
    ],
  },
  crossbow: {
    name: '석궁',
    desc: '강력한 중~장거리 단발, 발사속도 느림',
    sfx: 'shoot', sfxVolume: 0.7,
    // 중~장거리, 총보다 강하지만 느림
    levels: [
      { range: 520, damage: 28, cooldown: 1100, speed: 900 },
      { range: 560, damage: 38, cooldown: 1000, speed: 950 },
      { range: 600, damage: 52, cooldown: 850, speed: 1000 },
    ],
  },
  shotgun: {
    name: '샷건',
    desc: '부채꼴 다중 탄환, 가까울수록 강함',
    sfx: 'blast', sfxVolume: 0.6,
    // 근~중거리 부채꼴 다중 탄환. 멀수록 데미지 감소 (최대 falloff 비율만큼)
    levels: [
      { range: 300, damage: 8, cooldown: 1000, speed: 650, pellets: 5, spreadDeg: 40, falloff: 0.6 },
      { range: 320, damage: 10, cooldown: 900, speed: 700, pellets: 6, spreadDeg: 45, falloff: 0.55 },
      { range: 340, damage: 13, cooldown: 800, speed: 750, pellets: 8, spreadDeg: 50, falloff: 0.5 },
    ],
  },
  laser: {
    name: '레이저',
    desc: '화면 끝까지 닿는 관통 빔, 지속 데미지',
    sfx: 'zap', sfxVolume: 0.6,
    // 화면 끝까지 닿는 관통 빔. duration 동안 tickMs마다 데미지, 이후 재사용 대기
    levels: [
      { range: 1500, damage: 6, cooldown: 4000, duration: 800, tickMs: 100, width: 14 },
      { range: 1500, damage: 9, cooldown: 3500, duration: 1000, tickMs: 100, width: 18 },
      { range: 1500, damage: 13, cooldown: 3000, duration: 1300, tickMs: 100, width: 24 },
    ],
  },
};

export const STARTING_WEAPON = 'gun';

// 레벨업 카드에 보여줄 능력치 이름과 표시 형식
const STAT_LABELS = {
  damage: ['데미지', (v) => v],
  cooldown: ['공격 간격', (v) => `${(v / 1000).toFixed(2)}초`],
  range: ['사거리', (v) => v],
  count: ['발사 수', (v) => v],
  pierce: ['관통', (v) => v],
  pellets: ['탄환 수', (v) => v],
  arcDeg: ['베기 각도', (v) => `${v}°`],
  hitRadius: ['타격 범위', (v) => v],
  duration: ['지속시간', (v) => `${(v / 1000).toFixed(1)}초`],
  width: ['빔 굵기', (v) => v],
};

// 두 등급 사이에서 바뀌는 능력치를 "데미지 10 → 14" 형식으로 반환
export function describeUpgrade(id, fromLevel) {
  const before = WEAPONS[id].levels[fromLevel - 1];
  const after = WEAPONS[id].levels[fromLevel];
  return Object.entries(STAT_LABELS)
    .filter(([key]) => key in after && before[key] !== after[key])
    .map(([key, [label, fmt]]) => `${label} ${fmt(before[key])} → ${fmt(after[key])}`);
}
