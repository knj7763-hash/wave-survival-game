import Phaser from 'phaser';
import Weapon from './Weapon.js';

const { DegToRad } = Phaser.Math;

// count개의 각도를 center를 중심으로 spread(rad) 안에 고르게 나눈다
function fanAngles(center, count, spread) {
  if (count <= 1) return [center];
  return Array.from({ length: count }, (_, i) => center + (i / (count - 1) - 0.5) * spread);
}

// 일반: 단발 → 강화: 2연발 → 전설: 3연발 + 관통
class Gun extends Weapon {
  fire(angle) {
    const { damage, speed, burst, burstGapMs, pierce = 0 } = this.stats;
    this.burst(burst, burstGapMs, () => this.shoot('bullet', angle, { speed, damage, pierce }));
  }
}

// 일반: 부채꼴 베기 → 강화: 베기 범위 확장 → 전설: spinEvery번째 베기가 360도 회전베기
class Sword extends Weapon {
  constructor(...args) {
    super(...args);
    this.swings = 0;
  }

  fire(angle) {
    const { range, damage, arcDeg, spinEvery } = this.stats;
    this.swings++;
    if (spinEvery && this.swings % spinEvery === 0) {
      this.spin(range, damage);
      return;
    }

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

  // 주변 전체를 한 바퀴 베기
  spin(range, damage) {
    const { x, y } = this.player;
    for (const e of this.enemiesWithin(x, y, range)) e.takeDamage(damage);

    // 그래픽을 플레이어 위치에 두고 (0,0) 기준으로 그려서 회전/확대 트윈이 제자리에서 돌게 한다
    const g = this.scene.add.graphics({ x, y }).setDepth(6);
    g.fillStyle(0xe0f7ff, 0.3).fillCircle(0, 0, range);
    g.lineStyle(6, 0xffffff, 0.9).beginPath().arc(0, 0, range - 4, 0, Math.PI * 1.4).strokePath();
    this.scene.tweens.add({
      targets: g, angle: 360, scale: 1.08, alpha: 0, duration: 260, onComplete: () => g.destroy(),
    });
  }
}

// 일반: 관통 단발 → 강화: 2발 동시 (각도 벌어짐) → 전설: 첫 명중 시 파편 화살로 분열
class Bow extends Weapon {
  fire(angle) {
    const { damage, speed, pierce, arrows, spreadDeg = 0, splitCount } = this.stats;
    const onHit = splitCount ? (enemy, x, y, arrow) => this.split(enemy, x, y, arrow) : null;
    for (const a of fanAngles(angle, arrows, DegToRad(spreadDeg))) {
      this.shoot('arrow', a, { speed, damage, pierce, onHit });
    }
  }

  split(enemy, x, y, arrow) {
    if (arrow.hasSplit) return; // 관통하며 여러 번 맞혀도 분열은 한 번만
    arrow.hasSplit = true;
    const { damage, speed, splitCount, splitDamageRatio, splitRange, splitSpreadDeg } = this.stats;
    for (const a of fanAngles(arrow.rotation, splitCount, DegToRad(splitSpreadDeg))) {
      this.shoot('arrow', a, {
        x, y, speed, damage: Math.round(damage * splitDamageRatio), maxDistance: splitRange, ignore: enemy,
      }).setScale(0.7).setTint(0xffe082);
    }
  }
}

// 일반: 빠른 연타 → 강화: heavyEvery타마다 넉백 강타 → 전설: 연타 중 주변에 주먹 오라 지속 피해
class Knuckle extends Weapon {
  constructor(...args) {
    super(...args);
    this.punches = 0;
    this.lastPunchAt = -Infinity;
    this.nextAuraAt = 0;
    this.graphics = this.scene.add.graphics().setDepth(2); // 오라 표시 (게임 종료 시 GameScene이 지움)
  }

  fire(angle, time) {
    const { range, damage, hitRadius, heavyEvery, heavyMul } = this.stats;
    this.punches++;
    this.lastPunchAt = time;
    const heavy = heavyEvery && this.punches % heavyEvery === 0;

    // 플레이어 앞쪽 지점을 중심으로 작은 원형 범위 타격
    const hx = this.player.x + Math.cos(angle) * range * 0.6;
    const hy = this.player.y + Math.sin(angle) * range * 0.6;
    const radius = heavy ? hitRadius * 1.3 : hitRadius;

    for (const e of this.enemiesWithin(hx, hy, radius)) {
      e.takeDamage(heavy ? damage * heavyMul : damage);
      if (heavy) e.knockbackFrom(this.player, time);
    }

    const fist = this.scene.add.circle(hx, hy, radius * 0.6, heavy ? 0xff7043 : 0xffcc80, 0.8).setDepth(6);
    this.scene.tweens.add({
      targets: fist, scale: heavy ? 2 : 1.5, alpha: 0, duration: heavy ? 160 : 100, onComplete: () => fist.destroy(),
    });
  }

  update(time) {
    super.update(time);
    this.graphics.clear();
    const { auraRadius, auraDamage, auraTickMs, auraLingerMs } = this.stats;
    // 오라는 최근에 연타하고 있을 때만 유지된다
    if (!auraRadius || time > this.lastPunchAt + auraLingerMs) return;

    const { x, y } = this.player;
    const pulse = 0.85 + 0.15 * Math.sin(time / 60);
    this.graphics.fillStyle(0xffab40, 0.12).fillCircle(x, y, auraRadius * pulse);
    this.graphics.lineStyle(3, 0xffcc80, 0.6).strokeCircle(x, y, auraRadius * pulse);

    if (time < this.nextAuraAt) return;
    this.nextAuraAt = time + auraTickMs;
    for (const e of this.enemiesWithin(x, y, auraRadius)) e.takeDamage(auraDamage);
  }
}

// 일반: 강한 단발 → 강화: 2연사 → 전설: 착탄 시 소폭 범위 폭발
class Crossbow extends Weapon {
  fire(angle) {
    const { damage, speed, burst, burstGapMs, blastRadius } = this.stats;
    const onHit = blastRadius ? (enemy, x, y) => this.explode(enemy, x, y) : null;
    this.burst(burst, burstGapMs, () => this.shoot('bolt', angle, { speed, damage, onHit }));
  }

  // 직격당한 적은 이미 본 피해를 받았으므로 주변 적에게만 폭발 피해
  explode(enemy, x, y) {
    const { damage, blastRadius, blastRatio } = this.stats;
    for (const e of this.enemiesWithin(x, y, blastRadius)) {
      if (e !== enemy) e.takeDamage(Math.round(damage * blastRatio));
    }

    const boom = this.scene.add.circle(x, y, blastRadius, 0xffb74d, 0.45).setDepth(6).setScale(0.4);
    this.scene.tweens.add({
      targets: boom, scale: 1, alpha: 0, duration: 200, onComplete: () => boom.destroy(),
    });
  }
}

// 일반: 부채꼴 5발 → 강화: 7발 → 전설: 탄환 관통
class Shotgun extends Weapon {
  fire(angle) {
    const { damage, speed, pellets, spreadDeg, falloff, pierce = 0 } = this.stats;
    for (const a of fanAngles(angle, pellets, DegToRad(spreadDeg))) {
      this.shoot('pellet', a, { speed, damage, falloff, pierce });
    }
  }
}

// 일반: 단일 관통 빔 → 강화: 2갈래 → 전설: 3갈래 + 굵은 빔
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
    const { range, width, damage, tickMs, beams, beamSpreadDeg = 0 } = this.stats;
    const lines = fanAngles(this.beamAngle, beams, DegToRad(beamSpreadDeg)).map((a) =>
      Phaser.Geom.Line.SetToAngle(new Phaser.Geom.Line(), this.player.x, this.player.y, a, range));

    const flicker = 0.75 + Math.random() * 0.25;
    for (const line of lines) {
      this.graphics.lineStyle(width, 0xff4081, 0.5 * flicker).strokeLineShape(line);
      this.graphics.lineStyle(width * 0.4, 0xffffff, flicker).strokeLineShape(line);
    }

    if (time < this.nextTickAt) return;
    this.nextTickAt = time + tickMs;

    // 여러 빔에 겹쳐 있어도 한 틱에 한 번만 피해 (플레이어 바로 옆 적이 3배로 녹지 않게)
    const hitCircle = new Phaser.Geom.Circle();
    const targets = this.scene.enemies.getChildren().filter((e) => {
      if (!e.active) return false;
      hitCircle.setTo(e.x, e.y, e.radius + width / 2);
      return lines.some((line) => Phaser.Geom.Intersects.LineToCircle(line, hitCircle));
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
