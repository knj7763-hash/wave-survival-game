import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../config.js';

const MAX_DAMAGE_NUMBERS = 30; // 동시에 떠 있는 데미지 숫자 상한 (성능)
const DAMAGE_NUMBER_GAP_MS = 250; // 같은 적의 데미지는 이 간격으로 묶어서 표시

// 타격감 연출: 파티클, 데미지 숫자, 피격 화면 효과
// 타격 = 작은 불꽃, 처치 = 불꽃 + 튀어 나가는 벽돌 파편, 레벨업 = 별
export default class Effects {
  constructor(scene) {
    this.scene = scene;
    const emitter = (texture, config) => scene.add.particles(0, 0, texture, { emitting: false, ...config }).setDepth(8);

    this.fire = emitter('fx-fire', {
      lifespan: { min: 200, max: 380 },
      speed: { min: 40, max: 170 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
    });
    const debris = {
      lifespan: { min: 380, max: 650 },
      speed: { min: 90, max: 280 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.3 },
      alpha: { start: 1, end: 0 },
    };
    this.bricks = [emitter('fx-brick-brown', debris), emitter('fx-brick-grey', debris)];
    this.stars = emitter('fx-star', {
      lifespan: { min: 450, max: 750 },
      speed: { min: 80, max: 220 },
      rotate: { start: 0, end: 360 },
      scale: { start: 1, end: 0 },
    });
    this.damageNumbers = 0;

    this.hurtOverlay = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff1744, 0)
      .setOrigin(0).setDepth(9);
  }

  // 타격 불꽃
  hit(x, y, count = 2) {
    this.fire.explode(count, x, y);
  }

  // 처치: 불꽃 + 파편 (두 색 벽돌을 반씩)
  debris(x, y, count) {
    this.fire.explode(Math.ceil(count / 2), x, y);
    this.bricks[0].explode(Math.ceil(count / 2), x, y);
    this.bricks[1].explode(Math.floor(count / 2), x, y);
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
    this.debris(enemy.x, enemy.y, enemy.isBoss ? 40 : 8);
    if (enemy.isBoss) {
      this.stars.explode(20, enemy.x, enemy.y);
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
    this.stars.explode(14, x, y);
  }
}
