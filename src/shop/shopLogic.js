// 상점 동작. 모두 save 객체를 직접 수정하고 결과를 반환한다 (저장은 호출한 쪽에서).
import { SKILLS, MAX_EQUIPPED_SKILLS } from '../skills/skillData.js';
import {
  ITEMS, MAX_ITEM_LEVEL, ENHANCE_TABLE, STAT_EFFECT, COSTUMES,
} from './shopData.js';

const MAX_SKILL_LEVEL = 5;

// ─── 스킬 ────────────────────────────────────────────

export function skillUpgradeCost(id, level) {
  return level >= MAX_SKILL_LEVEL ? null : SKILLS[id].upgradeCosts[level - 1];
}

export function buySkill(save, id) {
  if (save.skills[id]) return { ok: false, reason: '이미 보유 중' };
  const price = SKILLS[id].price;
  if (save.coins < price) return { ok: false, reason: '코인 부족' };
  save.coins -= price;
  save.skills[id] = 1;
  // 빈 슬롯이 있으면 바로 장착
  if (save.equippedSkills.length < MAX_EQUIPPED_SKILLS) save.equippedSkills.push(id);
  return { ok: true };
}

export function upgradeSkill(save, id) {
  const level = save.skills[id];
  if (!level) return { ok: false, reason: '미보유' };
  const cost = skillUpgradeCost(id, level);
  if (cost === null) return { ok: false, reason: '최대 레벨' };
  if (save.coins < cost) return { ok: false, reason: '코인 부족' };
  save.coins -= cost;
  save.skills[id] = level + 1;
  return { ok: true };
}

export function toggleEquipSkill(save, id) {
  if (!save.skills[id]) return { ok: false, reason: '미보유' };
  const i = save.equippedSkills.indexOf(id);
  if (i >= 0) {
    save.equippedSkills.splice(i, 1);
    return { ok: true };
  }
  if (save.equippedSkills.length >= MAX_EQUIPPED_SKILLS) return { ok: false, reason: `최대 ${MAX_EQUIPPED_SKILLS}개까지 장착` };
  save.equippedSkills.push(id);
  return { ok: true };
}

// 런 시작 시 넘겨줄 장착 스킬 [{ id, level }]
export function getLoadout(save) {
  return save.equippedSkills.filter((id) => save.skills[id]).map((id) => ({ id, level: save.skills[id] }));
}

// ─── 아이템 강화 ──────────────────────────────────────

export function itemStatValue(slot, level) {
  const item = ITEMS[slot];
  return item.base + item.perLevel * level;
}

// 결과: { result: 'success' | 'fail' | 'max' | 'coins' | 'materials', refund? }
export function enhanceItem(save, slot, rng = Math.random) {
  const level = save.items[slot];
  if (level >= MAX_ITEM_LEVEL) return { result: 'max' };
  const { coins, materials, chance } = ENHANCE_TABLE[level];
  const mat = ITEMS[slot].material;
  if (save.coins < coins) return { result: 'coins' };
  if (save.materials[mat] < materials) return { result: 'materials' };

  save.materials[mat] -= materials;
  if (rng() < chance) {
    save.coins -= coins;
    save.items[slot] = level + 1;
    return { result: 'success' };
  }
  const refund = Math.floor(coins / 2);
  save.coins -= coins - refund;
  return { result: 'fail', refund };
}

// 아이템 능력치 → 전투 배율
export function getItemStats(save) {
  let defense = 0;
  let attack = 0;
  for (const [slot, item] of Object.entries(ITEMS)) {
    const value = itemStatValue(slot, save.items[slot]);
    if (item.stat === 'defense') defense += value;
    else attack += value;
  }
  return {
    defense,
    attack,
    damageTakenMultiplier: 1 - Math.min(STAT_EFFECT.maxDefenseReduction, defense * STAT_EFFECT.defensePerPoint),
    damageDealtMultiplier: 1 + attack * STAT_EFFECT.attackPerPoint,
  };
}

// ─── 코스튬 ──────────────────────────────────────────

export function buyCostume(save, id) {
  if (save.costumes.owned.includes(id)) return { ok: false, reason: '이미 보유 중' };
  const price = COSTUMES[id].price;
  if (save.coins < price) return { ok: false, reason: '코인 부족' };
  save.coins -= price;
  save.costumes.owned.push(id);
  save.costumes.equipped = id;
  return { ok: true };
}

export function equipCostume(save, id) {
  if (!save.costumes.owned.includes(id)) return { ok: false, reason: '미보유' };
  save.costumes.equipped = id;
  return { ok: true };
}

export function setGender(save, gender) {
  save.costumes.gender = gender;
  return { ok: true };
}
