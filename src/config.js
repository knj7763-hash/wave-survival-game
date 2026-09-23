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
  growth: 7,
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
export const ENEMY_TYPES = {
  normal: { texture: 'enemy', hp: 20, speed: 90, contactDamage: 10, radius: 14, xp: 1, isBoss: false, color: 0xe53935 },
  runner: { texture: 'enemy-runner', hp: 12, speed: 150, contactDamage: 8, radius: 11, xp: 1, isBoss: false, color: 0xffa726 },
  tank: { texture: 'enemy-tank', hp: 80, speed: 60, contactDamage: 18, radius: 20, xp: 3, isBoss: false, color: 0x66bb6a },
  miniboss: { texture: 'miniboss', hp: 300, speed: 75, contactDamage: 20, radius: 28, xp: 10, isBoss: true, color: 0xab47bc },
  boss: { texture: 'boss', hp: 1200, speed: 60, contactDamage: 25, radius: 44, xp: 30, isBoss: true, color: 0xff1744 },
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
  hpPerStage: 0.45, // 적 체력: 스테이지마다 +45%
  hpPerWave: 0.06, // 적 체력: 같은 스테이지 안에서 웨이브마다 +6%
  damagePerStage: 0.15, // 적 공격력 (보스 패턴 포함): 스테이지마다 +15%
  speedPerStep: 0.015, // 적 이동속도: 진행도 1당 +1.5%
  maxSpeedMul: 1.6,
  spawnSpeedupPerStep: 0.018, // 일반 웨이브 등장 간격: 진행도 1당 -1.8%
  minSpawnIntervalMs: 300,
  stepsPerExtraSpawn: 6, // 진행도 6마다 한 번에 나오는 적 +1
  minionSpeedupPerStep: 0.015, // 보스 웨이브 잡몹 간격 단축
  minMinionIntervalMs: 700,
};

// 스테이지 구조: 스테이지 수는 늘릴 수 있게 상수로 둔다.
export const STAGE_COUNT = 5;

// 한 스테이지 = 8웨이브. 3/5/7은 준보스, 8은 보스.
export const WAVE_TYPES = [
  'normal', 'normal', 'miniboss', 'normal',
  'miniboss', 'normal', 'miniboss', 'boss',
];

export const WAVE = {
  introMs: 1800, // 웨이브 시작 안내 후 적이 나오기까지
  breakMs: 2200, // 웨이브 클리어 후 다음 웨이브까지
  stageBreakMs: 3500, // 스테이지 클리어 후 다음 스테이지까지
  normalSpawnIntervalMs: 750,
  bossMinionIntervalMs: 1600, // 준보스/보스 웨이브 중 잡몹 등장 간격
};

// 스테이지 클리어 시 최대 체력 대비 회복 비율
export const STAGE_CLEAR_HEAL_RATIO = 0.25;

// 일반 웨이브에서 등장하는 적 수 (전부 처치하면 클리어)
export function normalWaveEnemyCount(stage, wave) {
  return 14 + wave * 3 + (stage - 1) * 6;
}

export const BOSS = {
  directionFlipChance: 0.5, // 보스가 패턴에 진입할 때 방향 전환 확률 (준보스는 방향 전환 없음)
};

// 보스/준보스 AI. 추격(idleMs 범위에서 무작위) → 패턴 1회 → 다시 추격을 반복한다.
// 같은 패턴이 연속으로 나오지 않는다. 모든 공격은 붉은 경고 표시 후 발동.
export const BOSS_AI = {
  miniboss: { idleMs: [2500, 3500], patterns: ['dash', 'shockwave'] },
  boss: { idleMs: [2000, 3000], patterns: ['dash', 'missiles', 'lightning'] },

  // 돌진: 경고선 표시 후 그 방향으로 빠르게 돌진
  dash: { windupMs: 700, dashMs: 600, speed: 650, recoverMs: 500, warnLength: 400 },
  // 전방위 광역 공격 (준보스): 주변 원형 범위가 차오른 뒤 폭발
  shockwave: { windupMs: 900, radius: 190, damage: 20 },
  // 중앙 이동 후 전방위 미사일 (보스): 사방으로 탄환을 여러 번 발사
  missiles: { moveSpeed: 300, volleys: 3, bulletsPerVolley: 16, volleyGapMs: 450, bulletSpeed: 220, damage: 12 },
  // 낙뢰 (보스): 무작위 위치(+ 플레이어 위치)에 경고 원 → 3초 뒤 낙뢰
  lightning: { strikes: 6, radius: 65, delayMs: 3000, damage: 25, chaseSpeedScale: 0.5 },
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
