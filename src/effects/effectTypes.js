import Phaser from 'phaser';
import { LEVEL_UP_EFFECTS, MAX_EFFECT_LEVEL } from './effectData.js';
import { playSfx } from '../systems/Sound.js';

const { DegToRad } = Phaser.Math;
const { Distance } = Phaser.Math;
const FIRST_TRIGGER_MS = 300; // 효과를 얻고 첫 발동까지
const RETRY_MS = 200; // 대상이 없어 발동하지 못했을 때 다시 시도하는 간격
const ZONE_DEPTH = -1; // 장판은 배경(-9) 위, 플레이어(0)와 적(1) 아래에 깐다

// 레벨업 효과 공통: 모든 타이머를 매 프레임 delta로 진행한다 (레벨업 화면 일시정지 중엔 함께 멈춤).
// cooldownMs가 있는 효과는 쿨타임마다 trigger()를 부르고, trigger가 false를 돌려주면(대상 없음) 곧 다시 시도한다.
class LevelUpEffect {
  constructor(scene, id) {
    this.scene = scene;
    this.id = id;
    this.data = LEVEL_UP_EFFECTS[id];
    this.level = 1;
    this.cooldownRemaining = FIRST_TRIGGER_MS;
  }

  get stats() {
    return this.data.levels[this.level - 1];
  }

  get isMaxLevel() {
    return this.level >= MAX_EFFECT_LEVEL;
  }

  get player() {
    return this.scene.player;
  }

  upgrade() {
    if (!this.isMaxLevel) this.level++;
  }

  update(delta) {
    if (this.stats.cooldownMs) {
      this.cooldownRemaining -= delta;
      if (this.cooldownRemaining <= 0) {
        this.cooldownRemaining = this.trigger() === false ? RETRY_MS : this.stats.cooldownMs;
      }
    }
    this.tick(delta);
  }

  trigger() {}
  tick() {}
  destroy() {}

  activeEnemies() {
    return this.scene.enemies.getChildren().filter((e) => e.active);
  }

  // 반경 안의 적 (적의 몸집 반경 포함, 처치해도 안전하게 복사본)
  enemiesWithin(x, y, radius) {
    return this.activeEnemies().filter((e) => Distance.Between(x, y, e.x, e.y) <= radius + e.radius);
  }

  // exclude에 없는 적 중 (x, y)에서 가장 가까운 적
  nearestEnemy(x, y, range, exclude = null) {
    let best = null;
    let bestDist = range;
    for (const e of this.activeEnemies()) {
      if (exclude?.has(e)) continue;
      const d = Distance.Between(x, y, e.x, e.y);
      if (d <= bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }
}

// ─── 오라 실드: 플레이어 주위를 도는 구체 ─────────────────
class Orbit extends LevelUpEffect {
  constructor(...args) {
    super(...args);
    this.angle = 0;
    this.clock = 0;
    this.sprites = [];
    this.nextHitAt = new WeakMap(); // 적마다 다음에 피해를 줄 수 있는 시각
  }

  tick(delta) {
    const { orbs, damage, radius, orbRadius, spinDegPerSec, tickMs } = this.stats;
    while (this.sprites.length < orbs) {
      this.sprites.push(this.scene.add.image(0, 0, 'fx-orb').setDepth(6).setBlendMode('ADD'));
    }

    this.clock += delta;
    this.angle += DegToRad(spinDegPerSec) * (delta / 1000);
    const { x: px, y: py } = this.player;
    this.sprites.forEach((sprite, i) => {
      const a = this.angle + (i / orbs) * Math.PI * 2;
      const x = px + Math.cos(a) * radius;
      const y = py + Math.sin(a) * radius;
      sprite.setPosition(x, y).setRotation(-this.angle * 2);

      for (const e of this.enemiesWithin(x, y, orbRadius)) {
        if (this.clock < (this.nextHitAt.get(e) ?? 0)) continue;
        this.nextHitAt.set(e, this.clock + tickMs);
        e.takeDamage(damage);
      }
    });
  }

  destroy() {
    this.sprites.forEach((s) => s.destroy());
  }
}

// ─── 축구공: 가까운 적에게 차례로 튕기는 공 ───────────────
const BALL_MAX_LIFE_MS = 4000;

class SoccerBall extends LevelUpEffect {
  constructor(...args) {
    super(...args);
    this.balls = [];
  }

  trigger() {
    const { balls, range } = this.stats;
    const { x, y } = this.player;
    // 공마다 서로 다른 가까운 적을 먼저 노린다 (적이 적으면 같은 적을 함께 노림)
    const targets = this.activeEnemies()
      .map((e) => [e, Distance.Between(x, y, e.x, e.y)])
      .filter(([, d]) => d <= range)
      .sort((a, b) => a[1] - b[1])
      .map(([e]) => e);
    if (!targets.length) return false;

    for (let i = 0; i < balls; i++) {
      this.balls.push({
        sprite: this.scene.add.image(x, y, 'fx-ball').setDepth(6),
        target: targets[i % targets.length],
        bouncesLeft: this.stats.bounces,
        hit: new Set(),
        life: BALL_MAX_LIFE_MS,
        angle: 0,
      });
    }
    playSfx(this.scene, 'swish', { volume: 0.4, throttleMs: 80 });
    return true;
  }

  tick(delta) {
    const { damage, speed, bounceRange } = this.stats;
    for (const ball of this.balls) {
      const { sprite } = ball;
      ball.life -= delta;
      sprite.rotation += delta * 0.02;

      // 목표가 사라지면 다음 적을 찾고, 없으면 마지막 방향으로 굴러가다 사라진다
      if (!ball.target?.active) ball.target = this.nearestEnemy(sprite.x, sprite.y, bounceRange, ball.hit);
      if (ball.target) ball.angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, ball.target.x, ball.target.y);
      const step = speed * (delta / 1000);
      sprite.x += Math.cos(ball.angle) * step;
      sprite.y += Math.sin(ball.angle) * step;

      const t = ball.target;
      if (t && Distance.Between(sprite.x, sprite.y, t.x, t.y) <= t.radius + 10) {
        t.takeDamage(damage);
        ball.hit.add(t);
        ball.bouncesLeft--;
        // 다음 대상: 아직 안 맞힌 적 우선, 없으면 방금 맞힌 적만 빼고 아무나
        ball.target = ball.bouncesLeft >= 0
          ? this.nearestEnemy(sprite.x, sprite.y, bounceRange, ball.hit)
            ?? this.nearestEnemy(sprite.x, sprite.y, bounceRange, new Set([t]))
          : null;
        if (!ball.target) ball.life = Math.min(ball.life, 250);
      }
      if (ball.life <= 0 || !onScreen(this.scene, sprite, 40)) ball.done = true;
    }
    this.balls = sweep(this.balls, (b) => b.done, (b) => fadeOut(this.scene, b.sprite));
  }

  destroy() {
    this.balls.forEach((b) => b.sprite.destroy());
  }
}

// ─── 번개 체인: 무작위 적에게 낙뢰 후 주변 적에게 연쇄 ──────
class ChainLightning extends LevelUpEffect {
  trigger() {
    const candidates = this.activeEnemies().filter((e) => onScreen(this.scene, e));
    if (!candidates.length) return false;
    const { targets, damage, chainRange } = this.stats;

    const chain = [Phaser.Utils.Array.GetRandom(candidates)];
    const hit = new Set(chain);
    while (chain.length < targets) {
      const last = chain[chain.length - 1];
      const next = this.nearestEnemy(last.x, last.y, chainRange, hit);
      if (!next) break;
      chain.push(next);
      hit.add(next);
    }

    // 하늘에서 첫 대상으로 떨어지는 번개 + 대상 사이를 잇는 번개
    const g = this.scene.add.graphics().setDepth(7);
    const first = chain[0];
    // 탑다운 시점이라 화면 위쪽 끝을 하늘로 본다
    drawBolt(g, first.x + Phaser.Math.Between(-30, 30), this.scene.viewRect().top - 10, first.x, first.y, 10);
    for (let i = 1; i < chain.length; i++) drawBolt(g, chain[i - 1].x, chain[i - 1].y, chain[i].x, chain[i].y, 6);
    for (const e of chain) {
      g.fillStyle(0xe3f2fd, 0.8).fillCircle(e.x, e.y, e.radius * 0.8);
      e.takeDamage(damage);
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    playSfx(this.scene, 'thunder', { volume: 0.35, throttleMs: 100 });
    return true;
  }
}

// ─── 장판 공통 (회전 톱날, 가시 장판): 제자리에 남아 tickMs마다 범위 피해 ───
class ZoneEffect extends LevelUpEffect {
  constructor(...args) {
    super(...args);
    this.zones = [];
  }

  // view: 장판 표시 객체 (컨테이너), spin: 초당 회전(rad)
  addZone(x, y, view, spin = 0) {
    const { radius, durationMs, tickMs } = this.stats;
    this.zones.push({ x, y, radius, remaining: durationMs, tickAcc: tickMs, view, spin });
  }

  tick(delta) {
    const { damage, tickMs } = this.stats;
    for (const zone of this.zones) {
      zone.remaining -= delta;
      zone.view.rotation += zone.spin * (delta / 1000);
      zone.tickAcc += delta;
      if (zone.tickAcc >= tickMs) {
        zone.tickAcc -= tickMs;
        for (const e of this.enemiesWithin(zone.x, zone.y, zone.radius)) e.takeDamage(damage);
      }
    }
    this.zones = sweep(this.zones, (z) => z.remaining <= 0, (z) => fadeOut(this.scene, z.view));
  }

  destroy() {
    this.zones.forEach((z) => z.view.destroy());
  }
}

// 진행 방향 앞에 회전 칼날 장판. 멈춰 있으면 마지막으로 움직인 방향 (처음엔 바라보는 방향).
class SawBlade extends ZoneEffect {
  constructor(...args) {
    super(...args);
    this.dir = new Phaser.Math.Vector2(this.player.flipX ? -1 : 1, 0);
  }

  tick(delta) {
    const v = this.player.body.velocity;
    if (v.lengthSq() > 1) this.dir.copy(v).normalize();
    super.tick(delta);
  }

  trigger() {
    const { radius, offset } = this.stats;
    const x = this.player.x + this.dir.x * offset;
    const y = this.player.y + this.dir.y * offset;
    const blade = this.scene.add.image(0, 0, 'fx-saw').setDisplaySize(radius * 2, radius * 2);
    const glow = this.scene.add.circle(0, 0, radius, 0xcfd8dc, 0.12).setStrokeStyle(2, 0xeceff1, 0.5);
    const view = this.scene.add.container(x, y, [glow, blade]).setDepth(ZONE_DEPTH).setScale(0.3);
    this.scene.tweens.add({ targets: view, scale: 1, duration: 150, ease: 'Back.Out' });
    this.addZone(x, y, view, Math.PI * 4);
    playSfx(this.scene, 'swish', { volume: 0.5, throttleMs: 80 });
  }
}

// 발밑에 솟는 가시 지대
class SpikeField extends ZoneEffect {
  trigger() {
    const { radius } = this.stats;
    const { x, y } = this.player;
    const items = [this.scene.add.circle(0, 0, radius, 0x5d4037, 0.35).setStrokeStyle(3, 0xa1887f, 0.7)];
    // 원 안에 가시를 고르게 흩뿌린다 (가운데 1개 + 동심원)
    const rings = [[0, 1], [0.45, 6], [0.8, 11]];
    for (const [r, n] of rings) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r;
        items.push(this.scene.add.image(Math.cos(a) * radius * r, Math.sin(a) * radius * r, 'fx-spikes').setOrigin(0.5, 1));
      }
    }
    const view = this.scene.add.container(x, y, items).setDepth(ZONE_DEPTH);
    // 가시가 아래에서 솟아오르는 연출
    const spikes = items.slice(1).map((s) => s.setScale(1, 0));
    this.scene.tweens.add({ targets: spikes, scaleY: 1, duration: 140, ease: 'Back.Out' });
    this.addZone(x, y, view);
  }
}

// ─── 유도 미사일: 가장 가까운 적을 추적해 폭발 ─────────────
const MISSILE_SEEK_RANGE = 900;

class HomingMissile extends LevelUpEffect {
  constructor(...args) {
    super(...args);
    this.missiles = [];
  }

  trigger() {
    const { x, y } = this.player;
    const target = this.nearestEnemy(x, y, MISSILE_SEEK_RANGE);
    if (!target) return false;
    const { count, lifeMs } = this.stats;
    const aim = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    // 여러 발은 부채꼴로 흩어졌다가 휘어져 들어간다
    for (let i = 0; i < count; i++) {
      const angle = aim + (count > 1 ? (i / (count - 1) - 0.5) * DegToRad(100) : 0);
      this.missiles.push({
        sprite: this.scene.add.image(x, y, 'fx-missile').setDepth(6).setRotation(angle),
        angle, target, life: lifeMs,
      });
    }
    playSfx(this.scene, 'missile', { volume: 0.5, throttleMs: 80 });
    return true;
  }

  tick(delta) {
    const { speed, turnDegPerSec } = this.stats;
    for (const m of this.missiles) {
      const { sprite } = m;
      m.life -= delta;
      if (!m.target?.active) m.target = this.nearestEnemy(sprite.x, sprite.y, MISSILE_SEEK_RANGE);
      if (m.target) {
        const want = Phaser.Math.Angle.Between(sprite.x, sprite.y, m.target.x, m.target.y);
        m.angle = Phaser.Math.Angle.RotateTo(m.angle, want, DegToRad(turnDegPerSec) * (delta / 1000));
      }
      const step = speed * (delta / 1000);
      sprite.x += Math.cos(m.angle) * step;
      sprite.y += Math.sin(m.angle) * step;
      sprite.setRotation(m.angle);

      // 아무 적에게나 닿거나 수명이 다하면 폭발
      const touching = this.activeEnemies().some((e) => Distance.Between(sprite.x, sprite.y, e.x, e.y) <= e.radius + 6);
      if (touching || m.life <= 0) this.explode(m);
    }
    this.missiles = this.missiles.filter((m) => !m.done);
  }

  explode(m) {
    const { damage, blastRadius } = this.stats;
    const { x, y } = m.sprite;
    m.done = true;
    m.sprite.destroy();
    for (const e of this.enemiesWithin(x, y, blastRadius)) e.takeDamage(damage);
    const boom = this.scene.add.circle(x, y, blastRadius, 0xff7043, 0.5).setDepth(6).setScale(0.3);
    this.scene.tweens.add({ targets: boom, scale: 1, alpha: 0, duration: 220, onComplete: () => boom.destroy() });
    this.scene.effects.hit(x, y, 5);
    playSfx(this.scene, 'blast', { volume: 0.35, throttleMs: 60 });
  }

  destroy() {
    this.missiles.forEach((m) => m.sprite.destroy());
  }
}

// ─── 부메랑: 적 방향으로 날아갔다가 플레이어에게 돌아오는 관통 투사체 ───
const BOOMERANG_HIT_RADIUS = 16;

class Boomerang extends LevelUpEffect {
  constructor(...args) {
    super(...args);
    this.boomerangs = [];
  }

  trigger() {
    const { x, y } = this.player;
    const { count, distance, spreadDeg } = this.stats;
    const target = this.nearestEnemy(x, y, distance + 100);
    if (!target) return false;
    const aim = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    for (let i = 0; i < count; i++) {
      const angle = aim + (count > 1 ? (i / (count - 1) - 0.5) * DegToRad(spreadDeg) : 0);
      this.boomerangs.push({
        sprite: this.scene.add.image(x, y, 'fx-boomerang').setDepth(6),
        startX: x, startY: y, angle, elapsed: 0, returning: false, hit: new Set(),
      });
    }
    playSfx(this.scene, 'swish', { volume: 0.5, throttleMs: 80 });
    return true;
  }

  tick(delta) {
    const { damage, distance, flightMs } = this.stats;
    const half = flightMs / 2;
    for (const b of this.boomerangs) {
      b.elapsed += delta;
      b.sprite.rotation += delta * 0.025;

      if (!b.returning && b.elapsed >= half) {
        // 되돌아오는 길에는 같은 적을 다시 맞힐 수 있다
        b.returning = true;
        b.apexX = b.sprite.x;
        b.apexY = b.sprite.y;
        b.hit.clear();
      }
      if (!b.returning) {
        // 나갈 때는 점점 느려지고
        const p = Phaser.Math.Easing.Quadratic.Out(b.elapsed / half);
        b.sprite.setPosition(b.startX + Math.cos(b.angle) * distance * p, b.startY + Math.sin(b.angle) * distance * p);
      } else {
        // 돌아올 때는 점점 빨라지며 플레이어의 현재 위치로
        const p = Phaser.Math.Easing.Quadratic.In(Math.min(1, (b.elapsed - half) / half));
        b.sprite.setPosition(
          Phaser.Math.Linear(b.apexX, this.player.x, p),
          Phaser.Math.Linear(b.apexY, this.player.y, p),
        );
        if (p >= 1) b.done = true;
      }

      for (const e of this.enemiesWithin(b.sprite.x, b.sprite.y, BOOMERANG_HIT_RADIUS)) {
        if (b.hit.has(e)) continue;
        b.hit.add(e);
        e.takeDamage(damage);
      }
    }
    this.boomerangs = sweep(this.boomerangs, (b) => b.done, (b) => b.sprite.destroy());
  }

  destroy() {
    this.boomerangs.forEach((b) => b.sprite.destroy());
  }
}

// ─── 공용 도우미 ─────────────────────────────────────

// 지금 카메라에 보이는 영역 안인지 (margin만큼 바깥까지 포함)
function onScreen(scene, obj, margin = 0) {
  return scene.viewRect(margin).contains(obj.x, obj.y);
}

// isDone인 항목은 cleanup 후 빼고, 나머지만 담은 새 목록을 반환
function sweep(list, isDone, cleanup) {
  const keep = [];
  for (const item of list) {
    if (isDone(item)) cleanup(item);
    else keep.push(item);
  }
  return keep;
}

function fadeOut(scene, obj) {
  scene.tweens.add({ targets: obj, alpha: 0, duration: 200, onComplete: () => obj.destroy() });
}

// (x1, y1) → (x2, y2) 지그재그 번개
function drawBolt(g, x1, y1, x2, y2, width) {
  const len = Distance.Between(x1, y1, x2, y2);
  const segments = Math.max(4, Math.round(len / 22));
  const nx = -(y2 - y1) / (len || 1);
  const ny = (x2 - x1) / (len || 1);
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const jitter = i === 0 || i === segments ? 0 : Phaser.Math.Between(-12, 12);
    points.push(new Phaser.Math.Vector2(x1 + (x2 - x1) * t + nx * jitter, y1 + (y2 - y1) * t + ny * jitter));
  }
  g.lineStyle(width, 0x64b5f6, 0.4).strokePoints(points);
  g.lineStyle(Math.max(2, width / 3), 0xffffff, 1).strokePoints(points);
}

// 효과용 텍스처 (BootScene에서 한 번 생성). 가시(fx-spikes)는 Assets.js의 이미지 에셋.
export function createEffectTextures(scene) {
  const g = scene.add.graphics();

  // 오라 구체: 바깥 광채 + 밝은 중심
  g.fillStyle(0x4dd0e1, 0.35).fillCircle(16, 16, 16);
  g.fillStyle(0x80deea, 0.8).fillCircle(16, 16, 11);
  g.fillStyle(0xffffff, 1).fillCircle(16, 16, 6);
  g.generateTexture('fx-orb', 32, 32);
  g.clear();

  // 축구공: 흰 공 + 가운데 검은 오각형 + 테두리 조각
  g.fillStyle(0xffffff).fillCircle(11, 11, 11);
  g.fillStyle(0x212121).fillPoints(polygon(11, 11, 4.5, 5, -Math.PI / 2), true);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    g.fillPoints(polygon(11 + Math.cos(a) * 9.5, 11 + Math.sin(a) * 9.5, 2.6, 5, a), true);
  }
  g.lineStyle(1.5, 0x424242).strokeCircle(11, 11, 10.5);
  g.generateTexture('fx-ball', 22, 22);
  g.clear();

  // 유도 미사일 (오른쪽을 향함): 불꽃 + 몸통 + 탄두
  g.fillStyle(0xffb300).fillTriangle(0, 5, 7, 1, 7, 9);
  g.fillStyle(0xeceff1).fillRect(6, 2, 13, 6);
  g.fillStyle(0xe53935).fillTriangle(18, 1, 25, 5, 18, 9);
  g.fillStyle(0x90a4ae).fillTriangle(6, 0, 11, 2, 6, 2).fillTriangle(6, 10, 11, 8, 6, 8);
  g.generateTexture('fx-missile', 25, 10);
  g.clear();

  // 부메랑: 두 날개가 꺾인 V자
  g.fillStyle(0xffca28);
  g.fillPoints([{ x: 2, y: 4 }, { x: 14, y: 12 }, { x: 26, y: 4 }, { x: 28, y: 9 }, { x: 14, y: 20 }, { x: 0, y: 9 }], true);
  g.lineStyle(2, 0x8d6e63).strokePoints([{ x: 2, y: 4 }, { x: 14, y: 12 }, { x: 26, y: 4 }, { x: 28, y: 9 }, { x: 14, y: 20 }, { x: 0, y: 9 }], true);
  g.generateTexture('fx-boomerang', 28, 22);
  g.clear();

  // 회전 톱날: 톱니 원판 (반지름 32 기준, 장판 크기에 맞춰 늘려 씀)
  const teeth = 12;
  const pts = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 32 : 24;
    pts.push({ x: 32 + Math.cos(a) * r, y: 32 + Math.sin(a) * r });
  }
  g.fillStyle(0xb0bec5).fillPoints(pts, true);
  g.lineStyle(2, 0x607d8b).strokePoints(pts, true);
  g.fillStyle(0x78909c).fillCircle(32, 32, 14);
  g.fillStyle(0x37474f).fillCircle(32, 32, 5);
  g.generateTexture('fx-saw', 64, 64);
  g.destroy();
}

function polygon(cx, cy, r, sides, rotation) {
  return Array.from({ length: sides }, (_, i) => {
    const a = rotation + (i / sides) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

export const EFFECT_CLASSES = {
  orbit: Orbit,
  soccer: SoccerBall,
  chain: ChainLightning,
  saw: SawBlade,
  missile: HomingMissile,
  spikes: SpikeField,
  boomerang: Boomerang,
};
