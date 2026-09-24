import Phaser from 'phaser';

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
    // 카메라에 보이는 영역을 벗어나면 제거 (탑다운 무한 월드라 화면 좌표가 아닌 카메라 기준)
    if (!this.scene.viewRect(OFFSCREEN_MARGIN).contains(this.x, this.y)) this.destroy();
  }
}
