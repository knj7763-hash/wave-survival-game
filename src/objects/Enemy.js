import Phaser from 'phaser';
import { ENEMY, ENEMY_TYPES } from '../config.js';
import { playSfx } from '../systems/Sound.js';
import WalkCycle from './WalkCycle.js';

export const ENEMY_EVENTS = { KILLED: 'enemy-killed' };

const BODY_CENTER = 0.6; // 충돌 원 중심의 세로 위치 (그림 위쪽 0 ~ 아래쪽 1): 큰 머리보다 몸통 쪽

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
    // 걷기 그림이 있으면 속도에 맞춘 걷기 애니메이션, 없으면 (준보스/보스) 좌우로 기울인 두 프레임을 번갈아 보여줌
    if (WalkCycle.available(this.scene, type.texture)) {
      this.walk = new WalkCycle(this, type.texture);
      this.walk.update(true, this.speed);
    } else {
      this.anims.play(`${type.texture}-walk`);
    }
    // 충돌 원은 그림의 몸통 쪽 (실제 그림 영역에서 가로 가운데, 세로 BODY_CENTER 지점). 텍스처엔 기울기용 여백이 있다.
    const art = this.texture.customData.body ?? { x: 0, y: 0, w: this.width, h: this.height };
    this.body.setCircle(type.radius, art.x + art.w / 2 - type.radius, art.y + art.h * BODY_CENTER - type.radius);
    // 보스는 잡몹에 밀리지 않는다
    if (this.isBoss) this.body.pushable = false;
    return this;
  }

  chase(target, now) {
    // 넉백으로 밀려나거나 기절한 동안은 걷지 않는다 (걸음을 마저 딛고 기본 포즈로)
    if (now < this.knockbackUntil) {
      this.walk?.update(false);
      return;
    }
    this.scene.physics.moveToObject(this, target, this.speed);
    this.faceToward(this.body.velocity.x);
    this.walk?.update(true, this.speed);
  }

  // 그림은 오른쪽을 바라보므로 왼쪽으로 갈 때 반전 (dx = 가려는 방향의 가로 성분)
  faceToward(dx) {
    if (dx !== 0) this.setFlipX(dx < 0);
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
