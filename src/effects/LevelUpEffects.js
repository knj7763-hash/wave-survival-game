import Phaser from 'phaser';
import { LEVEL_UP_EFFECTS, MAX_EFFECT_LEVEL, MAX_OWNED_EFFECTS, describeEffect } from './effectData.js';
import { EFFECT_CLASSES } from './effectTypes.js';

// 이번 런에서 레벨업으로 얻은 효과 목록 (최대 MAX_OWNED_EFFECTS개, 각 Lv1~3).
export default class LevelUpEffects {
  constructor(scene) {
    this.scene = scene;
    this.owned = []; // 얻은 순서대로
  }

  get(id) {
    return this.owned.find((e) => e.id === id);
  }

  get isFull() {
    return this.owned.length >= MAX_OWNED_EFFECTS;
  }

  // 새로 얻거나 보유 중이면 한 단계 강화
  addOrUpgrade(id) {
    const owned = this.get(id);
    if (owned) owned.upgrade();
    else if (!this.isFull) this.owned.push(new EFFECT_CLASSES[id](this.scene, id));
  }

  // 레벨업 선택지 후보: 보유 효과 강화 + (슬롯이 남았으면) 미보유 효과 중 무작위 count개
  buildChoices(count) {
    const pool = [];
    for (const [id, data] of Object.entries(LEVEL_UP_EFFECTS)) {
      const owned = this.get(id);
      if (owned && owned.isMaxLevel) continue;
      if (!owned && this.isFull) continue;
      const level = owned ? owned.level + 1 : 1;
      pool.push({
        type: owned ? 'upgrade' : 'new',
        id,
        icon: data.icon,
        title: data.name,
        tag: owned ? `강화  Lv${owned.level} → Lv${level}` : '신규 효과',
        level,
        maxLevel: MAX_EFFECT_LEVEL,
        lines: describeEffect(id, level),
      });
    }
    return Phaser.Utils.Array.Shuffle(pool).slice(0, count);
  }

  // 레벨업 화면/HUD 표시용 [{ icon, name, level }]
  summary() {
    return this.owned.map((e) => ({ icon: e.data.icon, name: e.data.name, level: e.level }));
  }

  update(delta) {
    for (const effect of this.owned) effect.update(delta);
  }

  destroy() {
    for (const effect of this.owned) effect.destroy();
  }
}
