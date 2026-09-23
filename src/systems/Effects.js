import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../config.js';

const MAX_DAMAGE_NUMBERS = 30; // 동시에 떠 있는 데미지 숫자 상한 (성능)
const DAMAGE_NUMBER_GAP_MS = 250; // 같은 적의 데미지는 이 간격으로 묶어서 표시

// 타격감 연출: 파티클, 데미지 숫자, 피격 화면 효과
export default class Effects {
  constructor(scene) {
    this.scene = scene;
    this.sparks = scene.add.particles(0, 0, 'spark', {
      lifespan: { min: 250, max: 450 },
      speed: { min: 60, max: 240 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(8);
    this.damageNumbers = 0;

    this.hurtOverlay = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff1744, 0)
      .setOrigin(0).setDepth(9);
  }

  burst(x, y, color, count) {
    this.sparks.setParticleTint(color);
    this.sparks.explode(count, x, y);
  }

  // 적 피격: 데미지를 적 단위로 모아서 일정 간격으로 숫자 표시
  onEnemyDamaged(enemy, amount, now) {
    enemy.pendingDamage = (enemy.pendingDamage ?? 0) + amount;
    if (now < (enemy.nextDamageNumberAt ?? 0)) return;
    enemy.nextDamageNumberAt = now + DAMAGE_NUMBER_GAP_MS;
    this.flushDamage(enemy);
  }

  flushDamage(enemy) {
    const amount = Math.round(enemy.pendingDamage ?? 0);
    enemy.pendingDamage = 0;
    if (amount <= 0 || this.damageNumbers >= MAX_DAMAGE_NUMBERS) return;

    this.damageNumbers++;
    const big = amount >= 30;
    const t = this.scene.add.text(enemy.x + Phaser.Math.Between(-8, 8), enemy.y - enemy.radius, String(amount), {
      fontFamily: FONT_FAMILY, fontSize: big ? '22px' : '15px', color: big ? '#ffd54f' : '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(12);
    this.scene.tweens.add({
      targets: t, y: t.y - 28, alpha: 0, duration: 600, ease: 'Cubic.Out',
      onComplete: () => { t.destroy(); this.damageNumbers--; },
    });
  }

  enemyDeath(enemy) {
    this.flushDamage(enemy);
    this.burst(enemy.x, enemy.y, enemy.color, enemy.isBoss ? 40 : 8);
    if (enemy.isBoss) {
      this.burst(enemy.x, enemy.y, 0xffffff, 30);
      this.scene.cameras.main.shake(400, 0.015);
      this.scene.cameras.main.flash(200, 255, 255, 255);
    }
  }

  playerHurt() {
    this.scene.tweens.killTweensOf(this.hurtOverlay);
    this.hurtOverlay.setAlpha(0.28);
    this.scene.tweens.add({ targets: this.hurtOverlay, alpha: 0, duration: 300 });
  }

  levelUp(x, y) {
    const ring = this.scene.add.circle(x, y, 20).setStrokeStyle(4, 0x1de9b6).setDepth(8);
    this.scene.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    this.burst(x, y, 0x1de9b6, 16);
  }
}
