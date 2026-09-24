import Phaser from 'phaser';
import { WEAPONS } from './weaponData.js';
import { playSfx } from '../systems/Sound.js';

// 모든 무기의 공통 동작: 쿨타임 관리 + 사거리 안 가장 가까운 적 자동 조준
// level: 상점에서 올린 등급 (1 일반 ~ 3 전설). 런 중에는 바뀌지 않는다.
export default class Weapon {
  constructor(scene, player, id, level = 1) {
    this.scene = scene;
    this.player = player;
    this.id = id;
    this.data = WEAPONS[id];
    this.level = level;
    this.nextFireAt = 0;
  }

  get stats() {
    return this.data.levels[this.level - 1];
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

  // opts.x/y: 발사 위치 (생략하면 플레이어 위치), opts.maxDistance: 생략하면 무기 사거리
  shoot(texture, angle, { x = this.player.x, y = this.player.y, ...opts }) {
    return this.scene.projectiles.create(x, y, texture).fire({ angle, maxDistance: this.stats.range, ...opts });
  }

  // count번 gapMs 간격으로 fn(i)를 호출하는 연발. 씬 타이머라 레벨업 일시정지 중에는 함께 멈춘다.
  burst(count, gapMs, fn) {
    fn(0);
    for (let i = 1; i < count; i++) {
      this.scene.time.delayedCall(i * gapMs, () => {
        if (this.player.active && !this.scene.isGameOver) fn(i);
      });
    }
  }

  // 반경 안의 적 목록 (적의 몸집 반경 포함, 처치해도 안전하게 복사본을 반환)
  enemiesWithin(x, y, radius) {
    return this.scene.enemies.getChildren().filter((e) =>
      e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius + e.radius);
  }
}
