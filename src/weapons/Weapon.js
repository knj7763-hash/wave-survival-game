import Phaser from 'phaser';
import { WEAPONS } from './weaponData.js';
import { playSfx } from '../systems/Sound.js';

// 모든 무기의 공통 동작: 쿨타임 관리 + 사거리 안 가장 가까운 적 자동 조준
export default class Weapon {
  constructor(scene, player, id) {
    this.scene = scene;
    this.player = player;
    this.id = id;
    this.data = WEAPONS[id];
    this.level = 1;
    this.nextFireAt = 0;
  }

  get stats() {
    return this.data.levels[this.level - 1];
  }

  get isMaxLevel() {
    return this.level >= this.data.levels.length;
  }

  upgrade() {
    if (!this.isMaxLevel) this.level++;
  }

  update(time) {
    if (time < this.nextFireAt) return;

    const target = this.scene.findNearestEnemy(this.player.x, this.player.y, this.stats.range);
    if (!target) return;

    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    this.fire(angle, time);
    this.nextFireAt = time + this.stats.cooldown;
    playSfx(this.scene, this.data.sfx, { volume: this.data.sfxVolume, throttleMs: 70 });
  }

  // 각 무기가 구현
  fire(angle, time) {}

  shoot(texture, angle, opts) {
    const p = this.scene.projectiles.create(this.player.x, this.player.y, texture);
    p.fire({ angle, maxDistance: this.stats.range, ...opts });
  }

  // 반경 안의 적 목록 (적의 몸집 반경 포함, 처치해도 안전하게 복사본을 반환)
  enemiesWithin(x, y, radius) {
    return this.scene.enemies.getChildren().filter((e) =>
      e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius + e.radius);
  }
}
