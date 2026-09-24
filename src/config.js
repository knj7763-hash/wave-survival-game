// 게임 전역 설정값. 밸런스 조정은 이 파일에서 한다.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const FONT_FAMILY = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

export const PLAYER = {
  maxHp: 100,
  speed: 260, // px/s
  invincibleMs: 800, // 피격 후 무적 시간
};

// 경험치: 레벨 n → n+1 필요량 = base + (n-1) * growth
export const XP = {
  base: 5,
  growth: 8, // 적 수가 늘어난 만큼 레벨업 효과가 너무 빨리 완성되지 않게
  pickupRadius: 110, // 이 거리 안에 들어오면 오브가 플레이어에게 끌려옴
  magnetSpeed: 450,
};

export const LEVEL_UP = {
  choiceCount: 3,
  healAmount: 30, // 선택지가 부족할 때 채우는 체력 회복량
};

export function xpToNextLevel(level) {
  return XP.base + (level - 1) * XP.growth;
}

export const ENEMY = {
  maxAlive: 150,
  knockbackSpeed: 260,
  knockbackMs: 150,
};

// 적 종류별 기본 능력치 (DIFFICULTY 배율이 곱해짐). radius는 충돌 반경(px), xp는 처치 시 경험치.
// texture의 이미지와 크기는 systems/Assets.js의 ENEMY_SPRITES에서 정한다.
export const ENEMY_TYPES = {
  normal: { texture: 'enemy', hp: 20, speed: 95, contactDamage: 12, radius: 14, xp: 1, isBoss: false },
  runner: { texture: 'enemy-runner', hp: 14, speed: 165, contactDamage: 9, radius: 11, xp: 1, isBoss: false },
  tank: { texture: 'enemy-tank', hp: 110, speed: 65, contactDamage: 20, radius: 20, xp: 3, isBoss: false },
  miniboss: { texture: 'miniboss', hp: 750, speed: 90, contactDamage: 22, radius: 28, xp: 15, isBoss: true },
  boss: { texture: 'boss', hp: 2000, speed: 70, contactDamage: 30, radius: 44, xp: 40, isBoss: true },
};

// 스테이지별 잡몹 구성 비율 (스테이지 수보다 짧으면 마지막 항목을 계속 사용)
export const ENEMY_MIX = [
  { normal: 1 },
  { normal: 0.8, runner: 0.2 },
  { normal: 0.65, runner: 0.2, tank: 0.15 },
  { normal: 0.55, runner: 0.25, tank: 0.2 },
  { normal: 0.45, runner: 0.3, tank: 0.25 },
];

// 난이도 곡선. 진행도 p = (스테이지-1) × 8 + (웨이브-1), 0 ~ 39
export const DIFFICULTY = {
  hpPerStage: 0.7, // 잡몹 체력: 스테이지마다 +70%
  bossHpPerStage: 0.25, // 준보스/보스 체력: 스테이지마다 +25% (패턴 공격력이 따로 오르므로 잡몹보다 완만하게)
  hpPerWave: 0.08, // 적 체력: 같은 스테이지 안에서 웨이브마다 +8%
  damagePerStage: 0.15, // 적 공격력 (보스 패턴 포함): 스테이지마다 +15%
  speedPerStep: 0.015, // 적 이동속도: 진행도 1당 +1.5%
  maxSpeedMul: 1.6,
  spawnSpeedupPerStep: 0.015, // 일반 웨이브 등장 간격: 진행도 1당 -1.5%
  minSpawnIntervalMs: 220,
  stepsPerExtraSpawn: 10, // 진행도 10마다 한 번에 나오는 적 +1
  maxSpawnBatch: 4,
  minionSpeedupPerStep: 0.015, // 보스 웨이브 잡몹 간격 단축
  minMinionIntervalMs: 450,
  // 몰려오기: 일정 간격마다 한 무리가 같은 높이 근처에서 한꺼번에 등장
  rushSizeBase: 4,
  stepsPerExtraRush: 3, // 진행도 3마다 무리 +1마리
  rushSpeedupPerStep: 0.015, // 무리 등장 간격: 진행도 1당 -1.5%
  minRushIntervalMs: 2800,
  bossRushScale: 0.6, // 준보스/보스 웨이브의 무리 크기 배율
};

// 스테이지 구조: 스테이지 수는 늘릴 수 있게 상수로 둔다.
export const STAGE_COUNT = 5;

// 한 스테이지 = 8웨이브. 3/5/7은 준보스, 8은 보스.
export const WAVE_TYPES = [
  'normal', 'normal', 'miniboss', 'normal',
  'miniboss', 'normal', 'miniboss', 'boss',
];

export const WAVE = {
  introMs: 1400, // 웨이브 시작 안내 후 적이 나오기까지
  breakMs: 1600, // 웨이브 클리어 후 다음 웨이브까지
  stageBreakMs: 3500, // 스테이지 클리어 후 다음 스테이지까지
  normalSpawnIntervalMs: 480,
  bossMinionIntervalMs: 1000, // 준보스/보스 웨이브 중 잡몹 등장 간격
  rushIntervalMs: 5000, // 무리 등장 간격 (진행할수록 짧아짐)
  rushSpreadY: 90, // 무리가 퍼지는 세로 범위 (±px)
};

// 스테이지 클리어 시 최대 체력 대비 회복 비율
export const STAGE_CLEAR_HEAL_RATIO = 0.5;

// 일반 웨이브에서 등장하는 적 수 (전부 처치하면 클리어)
// 웨이브마다 +6, 스테이지마다 전체 ×1.3씩 늘어난다 (1-1: 28마리 → 5-6: 128마리)
export function normalWaveEnemyCount(stage, wave) {
  return Math.round((22 + wave * 6) * (1 + 0.3 * (stage - 1)));
}

export const BOSS = {
  directionFlipChance: 0.5, // 보스가 패턴에 진입할 때 방향 전환 확률 (준보스는 방향 전환 없음)
};

// 보스/준보스 AI. 추격(idleMs 범위에서 무작위) → 패턴 1회 → 다시 추격을 반복한다.
// 같은 패턴이 연속으로 나오지 않는다. 모든 공격은 붉은 경고 표시 후 발동.
// [min, max]로 적은 시간은 매번 그 범위에서 무작위로 정해져 타이밍을 외우기 어렵게 한다.
export const BOSS_AI = {
  miniboss: { idleMs: [1200, 2400], patterns: ['dash', 'shockwave'] },
  boss: { idleMs: [1000, 1800], patterns: ['dash', 'missiles', 'lightning'] },

  // 돌진: 경고선 표시 후 돌진. 플레이어 이동 방향을 aimLead초만큼 앞질러 조준하고,
  // chain 범위의 횟수만큼 연속 돌진한다 (두 번째부터는 chainWindupMs로 짧게 준비).
  dash: {
    windupMs: [450, 650], chainWindupMs: 320, dashMs: 550, speed: 780, recoverMs: 350, warnLength: 440,
    aimLead: 0.35, chain: { miniboss: [1, 2], boss: [1, 3] },
  },
  // 전방위 광역 공격 (준보스): 주변 원형 범위가 차오른 뒤 폭발.
  // followUpChance 확률로 바로 이어서 바깥 고리(ringInner~ringOuter)가 한 번 더 폭발한다.
  shockwave: {
    windupMs: [600, 900], radius: 210, damage: 32,
    followUpChance: 0.5, ringWindupMs: 550, ringInner: 190, ringOuter: 350,
  },
  // 중앙 이동 후 전방위 미사일 (보스): 사방으로 탄환을 여러 번 발사.
  // 발사마다 빈틈 위치가 무작위로 바뀌고, 플레이어를 노리는 부채꼴 탄(aimedBullets)이 함께 나간다.
  missiles: {
    moveSpeed: 380, volleys: 4, bulletsPerVolley: 18, volleyGapMs: 380, bulletSpeed: 260, damage: 15,
    aimedBullets: 3, aimedSpreadDeg: 24,
  },
  // 낙뢰 (보스): 무작위 위치(+ 플레이어 위치)에 경고 원 → delayMs 뒤 낙뢰.
  // 이어서 followUps번, followUpGapMs 간격으로 플레이어 현재 위치에 추적 낙뢰를 예고한다.
  lightning: {
    strikes: 7, radius: 70, delayMs: [1600, 2100], damage: 30, chaseSpeedScale: 0.6,
    followUps: 2, followUpGapMs: 600, followUpDelayMs: 1100,
  },
};

// 웨이브 클리어 보너스 (적 처치 1코인/마리는 별도 지급)
export const COIN_REWARDS = {
  perKill: 1,
  waveClear: { normal: 10, miniboss: 25, boss: 50 },
  newRecordBonus: 20,
};

// 홀수 스테이지 = 왼쪽, 짝수 스테이지 = 오른쪽에서 적 등장
export function spawnSideForStage(stage) {
  return stage % 2 === 1 ? 'left' : 'right';
}

// 스킬 공용 게이지: 적 처치로 충전, 가득 차면 스킬 1회 사용 (사용 시 전부 소모)
export const SKILL_GAUGE = {
  max: 100,
  perKill: { normal: 4, runner: 4, tank: 8, miniboss: 20, boss: 40 },
};

export const STORAGE_KEYS = {
  bestSurvivalMs: 'wss.bestSurvivalMs',
  skillAutoMode: 'wss.skillAutoMode',
  muted: 'wss.muted',
};
