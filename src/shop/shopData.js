// 상점 데이터: 보스 재료, 장착 아이템, 강화 확률표, 코스튬

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

// 코스튬은 외형 전용 (능력치 없음)
export const COSTUMES = {
  basic: { name: '기본', price: 0, desc: '기본 지급 캐릭터' },
  uniform: { name: '교복', price: 200, desc: '흰색·검은색 조합 교복' },
  swimsuit: { name: '수영복', price: 500, desc: '여름 수영복' },
};

export const GENDERS = { male: '남', female: '여' };

export function costumeTextureKey(costume, gender) {
  return `player-${costume}-${gender}`;
}
