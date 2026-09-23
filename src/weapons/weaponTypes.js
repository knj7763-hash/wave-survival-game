import Phaser from 'phaser';
import Weapon from './Weapon.js';

const { DegToRad } = Phaser.Math;

class Gun extends Weapon {
  fire(angle) {
    const { damage, speed, count } = this.stats;
    // 전설 등급은 2발을 살짝 벌려서 발사
    const spread = DegToRad(8);
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
      this.shoot('bullet', angle + offset, { speed, damage });
    }
  }
}

class Sword extends Weapon {
  fire(angle) {
    const { range, damage, arcDeg } = this.stats;
    const { x, y } = this.player;
    const halfArc = DegToRad(arcDeg) / 2;

    for (const e of this.enemiesWithin(x, y, range)) {
      const diff = Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(x, y, e.x, e.y) - angle);
      if (Math.abs(diff) <= halfArc) e.takeDamage(damage);
    }

    const g = this.scene.add.graphics().setDepth(6);
    g.fillStyle(0xe0f7ff, 0.55);
    g.slice(x, y, range, angle - halfArc, angle + halfArc).fillPath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
  }
}

class Bow extends Weapon {
  fire(angle) {
    const { damage, speed, pierce } = this.stats;
    this.shoot('arrow', angle, { speed, damage, pierce });
  }
}

class Knuckle extends Weapon {
  fire(angle) {
    const { range, damage, hitRadius } = this.stats;
    // 플레이어 앞쪽 지점을 중심으로 작은 원형 범위 타격
    const hx = this.player.x + Math.cos(angle) * range * 0.6;
    const hy = this.player.y + Math.sin(angle) * range * 0.6;

    for (const e of this.enemiesWithin(hx, hy, hitRadius)) e.takeDamage(damage);

    const fist = this.scene.add.circle(hx, hy, hitRadius * 0.6, 0xffcc80, 0.8).setDepth(6);
    this.scene.tweens.add({
      targets: fist, scale: 1.5, alpha: 0, duration: 100, onComplete: () => fist.destroy(),
    });
  }
}

class Crossbow extends Weapon {
  fire(angle) {
    const { damage, speed } = this.stats;
    this.shoot('bolt', angle, { speed, damage });
  }
}

class Shotgun extends Weapon {
  fire(angle) {
    const { damage, speed, pellets, spreadDeg, falloff } = this.stats;
    const spread = DegToRad(spreadDeg);
    for (let i = 0; i < pellets; i++) {
      const offset = (i / (pellets - 1) - 0.5) * spread;
      this.shoot('pellet', angle + offset, { speed, damage, falloff });
    }
  }
}

class Laser extends Weapon {
  constructor(...args) {
    super(...args);
    this.beamUntil = 0;
    this.beamAngle = 0;
    this.nextTickAt = 0;
    this.graphics = this.scene.add.graphics().setDepth(6);
  }

  fire(angle, time) {
    this.beamAngle = angle;
    this.beamUntil = time + this.stats.duration;
    this.nextTickAt = time;
  }

  update(time) {
    super.update(time);
    this.graphics.clear();
    if (time >= this.beamUntil) return;

    // 빔은 발사 방향으로 고정, 시작점은 플레이어를 따라감
    const { range, width, damage, tickMs } = this.stats;
    const line = new Phaser.Geom.Line();
    Phaser.Geom.Line.SetToAngle(line, this.player.x, this.player.y, this.beamAngle, range);

    const flicker = 0.75 + Math.random() * 0.25;
    this.graphics.lineStyle(width, 0xff4081, 0.5 * flicker).strokeLineShape(line);
    this.graphics.lineStyle(width * 0.4, 0xffffff, flicker).strokeLineShape(line);

    if (time < this.nextTickAt) return;
    this.nextTickAt = time + tickMs;

    const hitCircle = new Phaser.Geom.Circle();
    const targets = this.scene.enemies.getChildren().filter((e) => {
      hitCircle.setTo(e.x, e.y, e.radius + width / 2);
      return e.active && Phaser.Geom.Intersects.LineToCircle(line, hitCircle);
    });
    for (const e of targets) e.takeDamage(damage);
  }
}

export const WEAPON_CLASSES = {
  gun: Gun,
  sword: Sword,
  bow: Bow,
  knuckle: Knuckle,
  crossbow: Crossbow,
  shotgun: Shotgun,
  laser: Laser,
};
