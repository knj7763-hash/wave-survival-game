// 런이 끝나도 남는 영구 데이터 (코인, 재료, 스킬, 코스튬, 아이템 강화). 브라우저 localStorage에 저장.

const KEY = 'wss.save';

function defaults() {
  return {
    coins: 0,
    materials: { hair: 0, hide: 0, fang: 0 },
    skills: {}, // { skillId: level } - 보유한 스킬만
    equippedSkills: [], // 최대 3개
    costumes: { owned: ['basic'], equipped: 'basic', gender: 'male' },
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
      costumes: { ...base.costumes, ...d.costumes },
      items: { ...base.items, ...d.items },
    };
  } catch {
    return base; // 저장소를 쓸 수 없거나 손상된 경우 새로 시작
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch { /* 저장 불가 환경: 이번 세션에만 유지 */ }
}
