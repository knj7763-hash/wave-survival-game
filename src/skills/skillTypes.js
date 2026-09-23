import Phaser from 'phaser';
import { SKILLS } from './skillData.js';
import { playSfx } from '../systems/Sound.js';

const { DegToRad } = Phaser.Math;
const CARDINAL = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // 상하좌우
const DIAGONAL = [Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, -Math.PI / 4]; // 대각선
const SCREEN_REACH = 1600; // 화면 끝까지 닿는 길이

// 스킬 공통: 개별 쿨타임과 지속시간을 매 프레임 delta로 줄인다 (일시정지 시 함께 멈춤).
class Skill {
  constructor(scene, id, level) {
    this.scene = scene;
    this.id = id;
    this.data = SKILLS[id];
    this.level = level;
    this.cooldownRemaining = 0;
    this.activeRemaining = 0;
  }

  get stats() {
    return this.data.levels[this.level - 1];
  }

  get isReady() {
    return this.cooldownRemaining <= 0;
  }

  get isActive() {
    return this.activeRemaining > 0;
  }

  activate() {
    this.cooldownRemaining = this.data.cooldownMs;
    this.onActivate();
  }

  update(delta, time) {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - delta);
    if (this.activeRemaining > 0) {
      this.activeRemaining = Math.max(0, this.activeRemaining - delta);
      this.onActiveUpdate(delta, time);
      if (this.activeRemaining === 0) this.onEnd();
    }
  }

  onActivate() {}
  onActiveUpdate() {}
  onEnd() {}
  destroy() {}

  get player() {
    return this.scene.player;
  }

  activeEnemies() {
    return this.scene.enemies.getChildren().filter((e) => e.active);
  }
}

class FireBreath extends Skill {
  constructor(...args) {
    super(...args);
    this.graphics = this.scene.add.graphics().setDepth(6);
  }

  onActivate() {
    this.activeRemaining = this.stats.durationMs;
    this.tickAcc = this.stats.tickMs; // 발동 즉시 첫 피해
    playSfx(this.scene, 'fire');
  }

  onActiveUpdate(delta) {
    const { length, halfAngleDeg, damage, tickMs } = this.stats;
    const { x, y } = this.player;
    const half = DegToRad(halfAngleDeg);

    // 일렁이는 화염 부채꼴
    const flicker = 0.85 + Math.random() * 0.15;
    this.graphics.clear();
    for (const angle of CARDINAL) {
      this.graphics.fillStyle(0xff5722, 0.45 * flicker)
        .slice(x, y, length * flicker, angle - half, angle + half).fillPath();
      this.graphics.fillStyle(0xffeb3b, 0.55 * flicker)
        .slice(x, y, length * 0.55 * flicker, angle - half * 0.6, angle + half * 0.6).fillPath();
    }

    this.tickAcc += delta;
    if (this.tickAcc < tickMs) return;
    this.tickAcc -= tickMs;

    for (const e of this.activeEnemies()) {
      const dist = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (dist > length + e.radius) continue;
      const toEnemy = Phaser.Math.Angle.Between(x, y, e.x, e.y);
      // 큰 적은 몸집만큼 판정 각도를 넓혀 준다
      const allowance = half + Math.atan2(e.radius, Math.max(dist, 1));
      if (CARDINAL.some((a) => Math.abs(Phaser.Math.Angle.Wrap(toEnemy - a)) <= allowance)) {
        e.takeDamage(damage);
      }
    }
  }

  onEnd() {
    this.graphics.clear();
  }

  destroy() {
    this.graphics.clear();
  }
}

class FireShield extends Skill {
  constructor(...args) {
    super(...args);
    this.graphics = this.scene.add.graphics().setDepth(6);
  }

  onActivate() {
    this.activeRemaining = this.stats.durationMs;
    playSfx(this.scene, 'shield');
  }

  onActiveUpdate(delta, time) {
    const { x, y } = this.player;
    const pulse = 0.5 + 0.2 * Math.sin(time / 120);
    // 끝나기 2초 전부터 깜빡여서 종료를 알린다
    const ending = this.activeRemaining < 2000 && Math.floor(time / 150) % 2 === 0;
    this.graphics.clear();
    if (ending) return;
    this.graphics.fillStyle(0xff9800, 0.15).fillCircle(x, y, 38);
    this.graphics.lineStyle(4, 0xffb300, pulse).strokeCircle(x, y, 38);
  }

  // 받는 피해 배율 (1 = 감소 없음)
  get damageTakenMultiplier() {
    return this.isActive ? 1 - this.stats.reduction : 1;
  }

  // 접촉한 적에게 반사 피해 (적마다 일정 간격)
  onContact(enemy, time) {
    if (!this.isActive) return;
    if (time < (enemy.nextReflectAt ?? 0)) return;
    enemy.nextReflectAt = time + this.stats.reflectGapMs;
    enemy.takeDamage(this.stats.reflect);
  }

  onEnd() {
    this.graphics.clear();
  }

  destroy() {
    this.graphics.clear();
  }
}

class ThunderBreath extends Skill {
  onActivate() {
    this.activeRemaining = Infinity; // 번개를 모두 쏠 때까지 활성
    this.pulsesLeft = this.stats.pulses;
    this.pulseAcc = this.stats.pulseGapMs; // 발동 즉시 첫 번개
  }

  onActiveUpdate(delta, time) {
    this.pulseAcc += delta;
    while (this.pulsesLeft > 0 && this.pulseAcc >= this.stats.pulseGapMs) {
      this.pulseAcc -= this.stats.pulseGapMs;
      this.pulsesLeft--;
      this.pulse(time);
    }
    if (this.pulsesLeft === 0) this.activeRemaining = 0;
  }

  pulse(time) {
    const { damage, width, stunMs } = this.stats;
    const { x, y } = this.player;
    const g = this.scene.add.graphics().setDepth(7);
    const line = new Phaser.Geom.Line();
    const hitCircle = new Phaser.Geom.Circle();
    const hit = new Set();

    for (const angle of DIAGONAL) {
      Phaser.Geom.Line.SetToAngle(line, x, y, angle, SCREEN_REACH);
      drawJaggedBolt(g, line, width);

      for (const e of this.activeEnemies()) {
        hitCircle.setTo(e.x, e.y, e.radius + width / 2);
        if (Phaser.Geom.Intersects.LineToCircle(line, hitCircle)) hit.add(e);
      }
    }

    for (const e of hit) {
      e.stun(stunMs, time);
      e.takeDamage(damage);
    }
    this.scene.cameras.main.shake(80, 0.004);
    playSfx(this.scene, 'thunder', { volume: 0.7 });
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }
}

function drawJaggedBolt(g, line, width) {
  const points = [];
  const segments = 24;
  const nx = -Math.sin(Phaser.Geom.Line.Angle(line));
  const ny = Math.cos(Phaser.Geom.Line.Angle(line));
  for (let i = 0; i <= segments; i++) {
    const p = Phaser.Geom.Line.GetPoint(line, i / segments);
    const jitter = i === 0 ? 0 : Phaser.Math.Between(-width / 2, width / 2);
    points.push(new Phaser.Math.Vector2(p.x + nx * jitter, p.y + ny * jitter));
  }
  g.lineStyle(width, 0x64b5f6, 0.35).strokePoints(points);
  g.lineStyle(4, 0xffffff, 1).strokePoints(points);
}

export const SKILL_CLASSES = {
  fireBreath: FireBreath,
  fireShield: FireShield,
  thunderBreath: ThunderBreath,
};
