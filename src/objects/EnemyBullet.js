import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

const OFFSCREEN_MARGIN = 60;

// 보스 미사일 등 플레이어를 노리는 적 투사체
export default class EnemyBullet extends Phaser.Physics.Arcade.Image {
  fire(angle, speed, damage) {
    this.damage = damage;
    this.setRotation(angle).setDepth(5);
    this.body.setCircle(5, this.width / 2 - 5, this.height / 2 - 5);
    this.scene.physics.velocityFromRotation(angle, speed, this.body.velocity);
    return this;
  }

  // 그룹의 runChildUpdate로 매 프레임 호출
  update() {
    if (this.x < -OFFSCREEN_MARGIN || this.x > GAME_WIDTH + OFFSCREEN_MARGIN ||
        this.y < -OFFSCREEN_MARGIN || this.y > GAME_HEIGHT + OFFSCREEN_MARGIN) {
      this.destroy();
    }
  }
}
