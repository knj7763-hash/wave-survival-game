import Phaser from 'phaser';
import { PLAYER } from '../config.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setSize(24, 40).setOffset(8, 8);

    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.speed = PLAYER.speed;
    this.invincibleUntil = 0;
  }

  // 화면 전체 상하좌우 자유 이동. 대각선 이동 속도는 정규화한다.
  move(input) {
    const dir = new Phaser.Math.Vector2(
      (input.right ? 1 : 0) - (input.left ? 1 : 0),
      (input.down ? 1 : 0) - (input.up ? 1 : 0),
    ).normalize().scale(this.speed);
    this.setVelocity(dir.x, dir.y);
  }

  // 적이 오는 방향을 바라보도록 스프라이트를 좌우 반전한다.
  faceSide(side) {
    this.setFlipX(side === 'left');
  }

  get isDead() {
    return this.hp <= 0;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // 피해를 실제로 입었으면 true를 반환한다 (무적 중이면 false).
  takeDamage(amount, now) {
    if (this.isDead || now < this.invincibleUntil) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invincibleUntil = now + PLAYER.invincibleMs;

    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: Math.floor(PLAYER.invincibleMs / 200) - 1,
      onComplete: () => this.setAlpha(1),
    });
    return true;
  }
}
