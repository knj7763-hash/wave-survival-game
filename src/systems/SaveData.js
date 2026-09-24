// 런이 끝나도 남는 영구 데이터 (코인, 재료, 스킬, 무기, 코스튬, 아이템 강화). 브라우저 localStorage에 저장.
import {
  COSTUMES, DEFAULT_COSTUME, LEGACY_COSTUMES, WEAPON_PRICES, DEFAULT_WEAPON,
} from '../shop/shopData.js';
import { WEAPONS } from '../weapons/weaponData.js';

const KEY = 'wss.save';

function defaults() {
  return {
    coins: 0,
    materials: { hair: 0, hide: 0, fang: 0 },
    skills: {}, // { skillId: level } - 보유한 스킬만
    equippedSkills: [], // 최대 3개
    weapons: { owned: { [DEFAULT_WEAPON]: 1 }, equipped: DEFAULT_WEAPON }, // owned: { weaponId: 등급 1~3 }
    costumes: { owned: [DEFAULT_COSTUME], equipped: DEFAULT_COSTUME },
    items: { head: 0, body: 0, weapon: 0 }, // 강화 단계
  };
}

export function loadSave() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const d = JSON.parse(raw);
    return {
      ...base,
      ...d,
      materials: { ...base.materials, ...d.materials },
      skills: { ...d.skills },
      equippedSkills: Array.isArray(d.equippedSkills) ? d.equippedSkills : [],
      weapons: loadWeapons(d.weapons),
      costumes: loadCostumes(d.costumes),
      items: { ...base.items, ...d.items },
    };
  } catch {
    return base; // 저장소를 쓸 수 없거나 손상된 경우 새로 시작
  }
}

// 예전 코스튬 id를 새 id로 바꾸고, 없는 id는 버린다. 기본 코스튬은 항상 보유.
function loadCostumes(saved = {}) {
  const migrate = (id) => LEGACY_COSTUMES[id] ?? id;
  const owned = [...new Set([DEFAULT_COSTUME, ...(saved.owned ?? []).map(migrate)])].filter((id) => COSTUMES[id]);
  const equipped = migrate(saved.equipped);
  return { owned, equipped: owned.includes(equipped) ? equipped : DEFAULT_COSTUME };
}

// 없는 무기와 범위를 벗어난 등급은 버린다. 기본 무기는 항상 보유.
function loadWeapons(saved = {}) {
  const owned = { [DEFAULT_WEAPON]: 1 };
  for (const [id, level] of Object.entries(saved.owned ?? {})) {
    if (id in WEAPON_PRICES) owned[id] = Math.min(Math.max(Math.floor(level) || 1, 1), WEAPONS[id].levels.length);
  }
  return { owned, equipped: owned[saved.equipped] ? saved.equipped : DEFAULT_WEAPON };
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch { /* 저장 불가 환경: 이번 세션에만 유지 */ }
}
