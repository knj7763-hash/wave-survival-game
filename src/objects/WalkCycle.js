import Phaser from 'phaser';
import { WALK_BASE_FPS } from '../systems/Assets.js';

const STEP_RATIO = 0.55; // 한 걸음(기본 → a)에 나아가는 거리 = 키 × 이 비율
const MIN_FPS = 3;
const MAX_FPS = 14;
const IDLE_SWAY_DEG = 1.5; // 정지 중 좌우로 흔들리는 최대 각도
const IDLE_PERIOD_MS = 2400; // 흔들림 한 번 왕복 시간

// 걷기 그림이 있는 캐릭터(플레이어, 기본·달리는·탱커 좀비)의 걷기/정지 애니메이션.
// - 이동 중: 기본 → a → 기본 → b 반복. 발이 바닥에서 미끄러지지 않도록 이동 속도와 키에 맞춰 재생 속도를 정한다.
// - 멈추면: 지금 딛는 걸음을 마저 끝내고 기본 포즈가 나오는 순간 멈춘다 (중간 포즈에서 뚝 끊기지 않게).
// - 정지 중: 기본 포즈로 천천히 좌우로 흔들린다. 회전만 쓰므로 충돌 판정에는 영향이 없다.
export default class WalkCycle {
  // 걷기 그림으로 만든 프레임이 있는 텍스처인지 (없으면 기존 기울이기 방식을 쓴다)
  static available(scene, baseKey) {
    return scene.textures.exists(`${baseKey}-walk-a`);
  }

  constructor(sprite, baseKey) {
    this.sprite = sprite;
    this.baseKey = baseKey;
    this.walkKey = `${baseKey}-walk`;
    this.stopping = false;
    this.idleMs = Math.random() * IDLE_PERIOD_MS; // 여러 좀비가 똑같은 박자로 흔들리지 않게
    const height = sprite.texture.customData.body?.h ?? sprite.height;
    this.pxPerFrame = (height * STEP_RATIO) / 2; // 한 걸음 = 두 프레임 (기본 → a)
    sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFrame, this);
  }

  get isWalking() {
    const { anims } = this.sprite;
    return anims.isPlaying && anims.currentAnim?.key === this.walkKey;
  }

  // 매 프레임 호출. speed: 지금 이동 속도 (px/s)
  update(moving, speed) {
    const { sprite } = this;
    if (moving) {
      this.stopping = false;
      sprite.setAngle(0);
      const fps = Phaser.Math.Clamp(speed / this.pxPerFrame, MIN_FPS, MAX_FPS);
      sprite.anims.timeScale = fps / WALK_BASE_FPS;
      // 움직이기 시작하면 바로 발을 내딛도록 a 포즈부터 재생
      if (!this.isWalking) sprite.anims.play({ key: this.walkKey, startFrame: 1 });
      return;
    }

    if (this.isWalking) {
      if (sprite.anims.currentFrame?.textureKey === this.baseKey) this.halt();
      else this.stopping = true; // onFrame에서 다음 기본 포즈가 나올 때 멈춘다
      return;
    }

    if (sprite.texture.key !== this.baseKey) sprite.setTexture(this.baseKey);
    this.idleMs += sprite.scene.game.loop.delta;
    sprite.setAngle(Math.sin((this.idleMs / IDLE_PERIOD_MS) * Math.PI * 2) * IDLE_SWAY_DEG);
  }

  onFrame(animation, frame) {
    if (this.stopping && frame.textureKey === this.baseKey) this.halt();
  }

  halt() {
    this.stopping = false;
    this.sprite.anims.stop();
    this.sprite.setTexture(this.baseKey);
  }
}
