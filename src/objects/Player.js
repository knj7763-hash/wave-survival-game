import Phaser from 'phaser';
import { PLAYER } from '../config.js';

const HIT_POSE_MS = 250; // 피격 시 아파하는 자세를 보여주는 시간

const HITBOX = { w: 0.6, h: 0.55 }; // 그림 영역 대비 충돌 판정 비율: 큰 머리는 빼고 몸통~발

// texture: 캐릭터 텍스처 키 (서 있는 자세). `${texture}-walk` 애니메이션과 `${texture}-hit` 프레임을 함께 쓴다.
export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.baseTexture = texture;
    this.hitPoseUntil = 0;
    // 판정은 몸통 위주로 작게. 텍스처는 기울인 프레임용 여백을 포함하므로 실제 그림 영역(customData.body) 기준으로 잡는다.
    const art = this.texture.customData.body ?? { x: 0, y: 0, w: this.width, h: this.height };
    const bw = Math.round(art.w * HITBOX.w);
    const bh = Math.round(art.h * HITBOX.h);
    this.body.setSize(bw, bh).setOffset(art.x + (art.w - bw) / 2, art.y + art.h - bh);

    // 발밑 표시: 교복 입은 좀비 무리 속에서도 내 캐릭터를 바로 찾을 수 있게 (캐릭터 아래, 장판 위에 깐다)
    this.feetOffsetY = art.y + art.h - this.height / 2;
    this.marker = scene.add.ellipse(x, y + this.feetOffsetY, art.w * 1.3, art.w * 0.5)
      .setStrokeStyle(2, 0x1de9b6, 0.9).setFillStyle(0x1de9b6, 0.18).setDepth(-0.5);

    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.speed = PLAYER.speed;
    this.invincibleUntil = 0;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.marker.setPosition(this.x, this.y + this.feetOffsetY);
  }

  // 탑다운 무한 월드에서 상하좌우 자유 이동 (카메라가 따라온다). 대각선 이동 속도는 정규화한다.
  move(input) {
    const dir = new Phaser.Math.Vector2(
      (input.right ? 1 : 0) - (input.left ? 1 : 0),
      (input.down ? 1 : 0) - (input.up ? 1 : 0),
    ).normalize().scale(this.speed);
    this.setVelocity(dir.x, dir.y);
    // 옆모습 임시 그래픽: 좌우로 움직일 때만 바라보는 방향을 바꾼다 (텍스처는 오른쪽을 바라봄)
    if (dir.x !== 0) this.setFlipX(dir.x < 0);
    this.updatePose(dir.lengthSq() > 0);
  }

  // 피격 자세 > 걷기 애니메이션 > 서 있기
  updatePose(moving) {
    if (this.scene.time.now < this.hitPoseUntil) {
      this.anims.stop();
      this.setTexture(`${this.baseTexture}-hit`);
    } else if (moving) {
      this.anims.play(`${this.baseTexture}-walk`, true);
    } else {
      this.anims.stop();
      this.setTexture(this.baseTexture);
    }
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
    this.hitPoseUntil = now + HIT_POSE_MS;

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
