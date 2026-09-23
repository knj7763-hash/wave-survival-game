import Phaser from 'phaser';
import { XP } from '../config.js';

// 적 처치 시 떨어지는 경험치 오브. 플레이어가 가까이 오면 끌려간다.
export default class XpOrb extends Phaser.Physics.Arcade.Image {
  setup(value) {
    this.value = value;
    this.magnetized = false;
    this.setDepth(2);
    // 준보스/보스가 떨어뜨린 큰 오브는 금색으로 크게 표시
    if (value > 1) this.setScale(1.8).setTint(0xffd54f);
    this.body.setCircle(5);
    return this;
  }

  // 그룹의 runChildUpdate로 매 프레임 호출
  update() {
    const player = this.scene.player;
    if (!this.magnetized &&
        Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= XP.pickupRadius) {
      this.magnetized = true; // 한 번 끌리기 시작하면 끝까지 따라감
    }
    if (this.magnetized) this.scene.physics.moveToObject(this, player, XP.magnetSpeed);
  }
}
