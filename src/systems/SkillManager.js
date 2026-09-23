import { SKILL_GAUGE, STORAGE_KEYS } from '../config.js';
import { MAX_EQUIPPED_SKILLS } from '../skills/skillData.js';
import { SKILL_CLASSES } from '../skills/skillTypes.js';
import { playSfx } from './Sound.js';

// 장착 스킬(최대 3개), 공용 게이지, AUTO 모드를 관리한다.
// 게이지가 가득 차고 해당 스킬의 쿨타임이 끝났을 때만 사용 가능하며, 사용하면 게이지를 전부 소모한다.
export default class SkillManager {
  constructor(scene, loadout) {
    this.scene = scene;
    this.skills = loadout.slice(0, MAX_EQUIPPED_SKILLS)
      .map(({ id, level }) => new SKILL_CLASSES[id](scene, id, level));
    this.gauge = 0;
    this.autoMode = loadAutoMode();
    this.useCount = 0;
    this.lastUsed = this.skills.map(() => 0); // 슬롯별 마지막 사용 순번 (0 = 아직 안 씀)
  }

  get isGaugeFull() {
    return this.gauge >= SKILL_GAUGE.max;
  }

  get shield() {
    return this.skills.find((s) => s.id === 'fireShield');
  }

  onEnemyKilled(enemy) {
    const wasFull = this.isGaugeFull;
    this.gauge = Math.min(SKILL_GAUGE.max, this.gauge + (SKILL_GAUGE.perKill[enemy.typeId] ?? 0));
    if (!wasFull && this.isGaugeFull && this.skills.length) playSfx(this.scene, 'ready');
  }

  // 사용 결과: 'used' | 'gauge'(게이지 부족) | 'cooldown' | 'none'(빈 슬롯)
  use(slot) {
    const skill = this.skills[slot];
    if (!skill) return 'none';
    if (!this.isGaugeFull) return 'gauge';
    if (!skill.isReady) return 'cooldown';

    this.gauge = 0;
    this.lastUsed[slot] = ++this.useCount;
    skill.activate();
    return 'used';
  }

  toggleAuto() {
    this.autoMode = !this.autoMode;
    saveAutoMode(this.autoMode);
    return this.autoMode;
  }

  update(delta, time) {
    for (const skill of this.skills) skill.update(delta, time);

    // AUTO: 게이지가 차면 쿨타임이 끝난 스킬 중 가장 오래전에 쓴 것(안 쓴 스킬 우선, 같으면 앞 슬롯)을 사용
    if (this.autoMode && this.isGaugeFull) {
      let pick = -1;
      this.skills.forEach((s, i) => {
        if (s.isReady && (pick < 0 || this.lastUsed[i] < this.lastUsed[pick])) pick = i;
      });
      if (pick >= 0) this.use(pick);
    }
  }

  // 받는 피해 배율 (화염 보호막)
  get damageTakenMultiplier() {
    return this.shield?.damageTakenMultiplier ?? 1;
  }

  onPlayerContact(enemy, time) {
    this.shield?.onContact(enemy, time);
  }

  destroy() {
    for (const skill of this.skills) skill.destroy();
  }
}

function loadAutoMode() {
  try {
    return localStorage.getItem(STORAGE_KEYS.skillAutoMode) === '1';
  } catch {
    return false;
  }
}

function saveAutoMode(on) {
  try {
    localStorage.setItem(STORAGE_KEYS.skillAutoMode, on ? '1' : '0');
  } catch { /* 저장 불가 환경이면 이번 판에만 적용 */ }
}
