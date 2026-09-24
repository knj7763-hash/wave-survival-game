// 상점 데이터: 보스 재료, 장착 아이템, 강화 확률표, 무기, 코스튬

export const MATERIALS = {
  hair: { name: '보스의 머리털' },
  hide: { name: '보스의 등가죽' },
  fang: { name: '보스의 날카로운 송곳니' },
};

// 장착 아이템은 처음부터 +0으로 보유. 능력치 = base + perLevel * 강화단계
export const ITEMS = {
  head: { name: '낡은 투구', slotName: '머리', stat: 'defense', statName: '방어력', base: 5, perLevel: 3, material: 'hair' },
  body: { name: '낡은 갑옷', slotName: '몸', stat: 'defense', statName: '방어력', base: 5, perLevel: 3, material: 'hide' },
  weapon: { name: '낡은 검', slotName: '무기', stat: 'attack', statName: '공격력', base: 5, perLevel: 3, material: 'fang' },
};

export const MAX_ITEM_LEVEL = 5;

// 강화표 (index = 현재 단계). 실패 시 재료만 소모되고 코인은 절반 반환.
export const ENHANCE_TABLE = [
  { coins: 30, materials: 1, chance: 1 },
  { coins: 60, materials: 1, chance: 0.9 },
  { coins: 100, materials: 2, chance: 0.75 },
  { coins: 150, materials: 2, chance: 0.55 },
  { coins: 250, materials: 3, chance: 0.35 },
];

// 방어력 1 = 받는 피해 1% 감소 (최대 60%), 공격력 1 = 주는 피해 1% 증가
export const STAT_EFFECT = {
  defensePerPoint: 0.01,
  maxDefenseReduction: 0.6,
  attackPerPoint: 0.01,
};

// 무기: 하나만 장착해서 런에 들고 들어가고, 런 중에는 바뀌지 않는다 (무기 능력치는 weapons/weaponData.js).
// price: 구매가 (구매 시 일반 등급). 등급 n → n+1 승급비는 WEAPON_TIER_COSTS[n-1]
export const WEAPON_PRICES = {
  gun: 0,
  sword: 200,
  knuckle: 200,
  bow: 250,
  shotgun: 300,
  crossbow: 300,
  laser: 400,
};

export const WEAPON_TIER_COSTS = [250, 500];

export const DEFAULT_WEAPON = 'gun';

// 코스튬은 외형 전용 (능력치 없음). color: 캐릭터 이미지 색상 (assets/players/alien{color}_*.png)
export const COSTUMES = {
  green: { name: '초록 외계인', price: 0, desc: '기본 지급 캐릭터', color: 'Green' },
  blue: { name: '파랑 외계인', price: 150, desc: '시원한 파란색', color: 'Blue' },
  pink: { name: '분홍 외계인', price: 250, desc: '상큼한 분홍색', color: 'Pink' },
  yellow: { name: '노랑 외계인', price: 350, desc: '눈에 띄는 노란색', color: 'Yellow' },
  beige: { name: '베이지 외계인', price: 500, desc: '차분한 베이지색', color: 'Beige' },
};

export const DEFAULT_COSTUME = 'green';

// 이전 버전 코스튬(기본/교복/수영복)을 산 저장 데이터는 같은 가격대의 색상으로 옮겨 준다
export const LEGACY_COSTUMES = { basic: 'green', uniform: 'blue', swimsuit: 'pink' };

// 상점 코스튬 탭 미리보기용 외계인 텍스처. big=true면 큰 이미지
export function costumeTextureKey(costume, big = false) {
  return `player-${costume}${big ? '-big' : ''}`;
}

// 플레이어 캐릭터 (학생). file: 기본 포즈, walk: 걷기 그림 [a, b] (public/assets/school/의 이미지 이름).
// 지금은 남학생 고정이고, 성별 선택 UI는 추후 추가 (저장 데이터 save.character로 전환).
export const PLAYER_CHARACTERS = {
  boy: { name: '남학생', file: 'player_boy', walk: ['player_boy_walk_a', 'player_boy_walk_b'] },
  girl: { name: '여학생', file: 'player_girl', walk: ['player_girl_walk_a', 'player_girl_walk_b'] },
};

export const DEFAULT_CHARACTER = 'boy';

// 게임 속 캐릭터 텍스처 (`${key}-walk` 애니메이션과 `${key}-hit` 프레임을 함께 쓴다). big=true면 타이틀용 큰 이미지
export function characterTextureKey(character, big = false) {
  return `char-${character}${big ? '-big' : ''}`;
}
