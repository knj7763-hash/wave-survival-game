import Phaser from 'phaser';

// 총알/화살/석궁 볼트/샷건 탄환 공용 투사체
export default class Projectile extends Phaser.Physics.Arcade.Image {
  // onHit(enemy, projectile): 적에게 피해를 준 직후 호출 (분열/폭발 등 등급 효과)
  // ignore: 처음부터 맞지 않을 적 (분열 화살이 원래 맞은 적을 다시 맞히지 않게)
  fire({ angle, speed, damage, maxDistance, pierce = 0, falloff = 0, onHit = null, ignore = null }) {
    this.startX = this.x;
    this.startY = this.y;
    this.damage = damage;
    this.maxDistance = maxDistance;
    this.pierce = pierce; // 추가로 관통할 수 있는 적 수
    this.falloff = falloff; // 최대 사거리에서 줄어드는 데미지 비율
    this.onHit = onHit;
    this.hitEnemies = new Set(ignore ? [ignore] : []);

    this.setRotation(angle).setDepth(5);
    this.body.setSize(10, 10, true);
    this.scene.physics.velocityFromRotation(angle, speed, this.body.velocity);
    return this;
  }

  get travelled() {
    return Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y);
  }

  // 그룹의 runChildUpdate로 매 프레임 호출
  update() {
    if (this.travelled > this.maxDistance) this.destroy();
  }

  hit(enemy) {
    if (!this.active || !enemy.active || this.hitEnemies.has(enemy)) return;
    this.hitEnemies.add(enemy);

    const distRatio = Math.min(1, this.travelled / this.maxDistance);
    const { x, y } = enemy; // 처치되어도 효과 위치는 남도록 미리 기억
    enemy.takeDamage(Math.round(this.damage * (1 - this.falloff * distRatio)));
    this.onHit?.(enemy, x, y, this);

    if (this.pierce-- <= 0) this.destroy();
  }
}
