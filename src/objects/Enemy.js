import Phaser from 'phaser';
import { ENEMY, ENEMY_TYPES } from '../config.js';
import { playSfx } from '../systems/Sound.js';

export const ENEMY_EVENTS = { KILLED: 'enemy-killed' };

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy');
    this.knockbackUntil = 0;
  }

  // 그룹에 추가되어 물리 바디가 생긴 뒤 호출한다. diff = difficultyFor(stage, wave)
  setup(typeId, diff) {
    const type = ENEMY_TYPES[typeId];
    this.typeId = typeId;
    this.isBoss = type.isBoss;
    this.radius = type.radius;
    this.maxHp = Math.round(type.hp * (this.isBoss ? diff.bossHpMul : diff.hpMul));
    this.hp = this.maxHp;
    // 보스는 패턴 위주라 이동속도 배율을 절반만 적용
    this.speed = type.speed * (this.isBoss ? 1 + (diff.speedMul - 1) / 2 : diff.speedMul);
    this.damageMul = diff.damageMul;
    this.contactDamage = Math.round(type.contactDamage * diff.damageMul);
    this.xpValue = type.xp;

    this.baseTexture = type.texture;
    this.setTexture(type.texture).setDepth(this.isBoss ? 3 : 1);
    this.anims.play(`${type.texture}-walk`); // 기본/이동 두 프레임을 번갈아 보여줌 (Assets.js)
    this.body.setCircle(type.radius, this.width / 2 - type.radius, this.height / 2 - type.radius);
    // 보스는 잡몹에 밀리지 않는다
    if (this.isBoss) this.body.pushable = false;
    return this;
  }

  chase(target, now) {
    if (now < this.knockbackUntil) return;
    this.scene.physics.moveToObject(this, target, this.speed);
    // 텍스처는 왼쪽을 바라보므로 오른쪽으로 이동할 때 반전
    this.setFlipX(this.body.velocity.x > 0);
  }

  knockbackFrom(source, now) {
    if (this.isBoss) return;
    const angle = Phaser.Math.Angle.Between(source.x, source.y, this.x, this.y);
    this.scene.physics.velocityFromRotation(angle, ENEMY.knockbackSpeed, this.body.velocity);
    this.knockbackUntil = now + ENEMY.knockbackMs;
  }

  // 일정 시간 제자리에 멈춤. 보스는 패턴 흐름이 깨지지 않도록 면역.
  stun(ms, now) {
    if (this.isBoss || !this.active) return;
    this.setVelocity(0, 0);
    this.knockbackUntil = Math.max(this.knockbackUntil, now + ms);
  }

  takeDamage(amount) {
    if (!this.active) return;
    // 장착 아이템 공격력 보너스 (무기/스킬/반사 등 플레이어 피해는 모두 여기로 들어온다)
    const dealt = amount * (this.scene.playerStats?.damageDealtMultiplier ?? 1);
    this.hp -= dealt;

    const now = this.scene.time.now;
    this.scene.effects?.onEnemyDamaged(this, dealt, now);
    this.scene.effects?.hit(this.x, this.y);
    playSfx(this.scene, 'hit', { volume: 0.5, throttleMs: 50 });

    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.clearTint();
    });

    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.active) return;
    // 먼저 비활성화해서 조준/충돌 대상에서 즉시 빠지게 한다.
    this.setActive(false);
    this.body.enable = false;
    this.scene.events.emit(ENEMY_EVENTS.KILLED, this);
    this.scene.effects?.enemyDeath(this);
    if (this.isBoss) playSfx(this.scene, 'bossDeath');
    else playSfx(this.scene, 'kill', { volume: 0.7, throttleMs: 40 });

    // 쓰러진 모습으로 바꾼 뒤 사라짐
    this.anims.stop();
    this.clearTint();
    this.setTexture(`${this.baseTexture}-dead`).setDepth(0);
    this.scene.tweens.add({
      targets: this,
      scale: this.isBoss ? 1.4 : 1.15,
      alpha: 0,
      duration: this.isBoss ? 700 : 300,
      ease: 'Quad.In',
      onComplete: () => this.destroy(),
    });
  }
}
