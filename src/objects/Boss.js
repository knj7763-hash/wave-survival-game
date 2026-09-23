import Phaser from 'phaser';
import Enemy from './Enemy.js';
import { BOSS_AI, GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { playSfx } from '../systems/Sound.js';

const PLAYER_HIT_RADIUS = 12; // 광역 공격 판정 시 더해 주는 플레이어 몸집
const WARN_COLOR = 0xff1744;
const SCREEN_MARGIN = 80; // 낙뢰가 떨어질 수 있는 화면 가장자리 여백

// 준보스/보스. 추격 → 패턴 → 추격을 반복한다.
// 패턴 진행은 모두 씬 타이머/트윈으로 처리해서, 레벨업 화면으로 일시정지되면 함께 멈춘다.
//
// state: chase(추격) | hold(제자리) | dash(돌진 중) | scripted(트윈으로 이동 중) | slowChase(느린 추격)
export default class Boss extends Enemy {
  startAI() {
    this.ai = BOSS_AI[this.typeId];
    this.state = 'chase';
    this.lastPattern = null;
    this.timers = [];
    this.fx = []; // 패턴 중 만든 경고 표시 등 (보스가 죽으면 함께 정리)
    this.scheduleNextPattern();
    return this;
  }

  chase(target, now) {
    switch (this.state) {
      case 'chase':
        super.chase(target, now);
        break;
      case 'slowChase':
        this.scene.physics.moveToObject(this, target, this.speed * BOSS_AI.lightning.chaseSpeedScale);
        this.setFlipX(this.body.velocity.x > 0);
        break;
      case 'hold':
      case 'scripted':
        this.setVelocity(0, 0);
        break;
      // 'dash'는 돌진 속도를 그대로 유지
    }
  }

  // ─── 패턴 순환 ───────────────────────────────────────

  scheduleNextPattern() {
    this.state = 'chase';
    const [min, max] = this.ai.idleMs;
    this.later(Phaser.Math.Between(min, max), () => this.startPattern());
  }

  startPattern() {
    const options = this.ai.patterns.filter((p) => p !== this.lastPattern);
    const pattern = Phaser.Utils.Array.GetRandom(options);
    this.lastPattern = pattern;

    // 보스만 패턴 진입 시 무작위 방향 전환 (준보스는 없음)
    if (this.typeId === 'boss') this.scene.waves.onBossPatternStart();

    const run = {
      dash: this.patternDash,
      shockwave: this.patternShockwave,
      missiles: this.patternMissiles,
      lightning: this.patternLightning,
    }[pattern];
    run.call(this);
  }

  // ─── 패턴: 돌진 ──────────────────────────────────────

  patternDash() {
    const cfg = BOSS_AI.dash;
    const player = this.scene.player;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.state = 'hold';
    this.setFlipX(Math.cos(angle) > 0);
    playSfx(this.scene, 'dashWarn');

    // 돌진 방향 경고선 (깜빡임)
    const warn = this.addFx(this.scene.add.graphics().setDepth(4));
    const end = new Phaser.Math.Vector2().setToPolar(angle, cfg.warnLength).add(this);
    warn.lineStyle(this.radius * 1.4, WARN_COLOR, 0.25).lineBetween(this.x, this.y, end.x, end.y);
    this.scene.tweens.add({ targets: warn, alpha: 0.3, duration: 120, yoyo: true, repeat: -1 });

    this.later(cfg.windupMs, () => {
      this.removeFx(warn);
      this.state = 'dash';
      this.scene.physics.velocityFromRotation(angle, cfg.speed, this.body.velocity);

      this.later(cfg.dashMs, () => {
        this.state = 'hold';
        this.later(cfg.recoverMs, () => this.scheduleNextPattern());
      });
    });
  }

  // ─── 패턴: 전방위 광역 공격 (준보스) ─────────────────────

  patternShockwave() {
    const cfg = BOSS_AI.shockwave;
    this.state = 'hold';

    // 범위 테두리 + 안쪽이 점점 차오르는 원
    const outline = this.addFx(this.scene.add.circle(this.x, this.y, cfg.radius)
      .setStrokeStyle(3, WARN_COLOR, 0.8).setDepth(4));
    const fill = this.addFx(this.scene.add.circle(this.x, this.y, cfg.radius, WARN_COLOR, 0.25)
      .setScale(0).setDepth(4));
    this.scene.tweens.add({ targets: fill, scale: 1, duration: cfg.windupMs });

    this.later(cfg.windupMs, () => {
      this.removeFx(outline);
      this.removeFx(fill);

      const blast = this.scene.add.circle(this.x, this.y, cfg.radius, 0xffffff, 0.6).setDepth(7);
      this.scene.tweens.add({
        targets: blast, alpha: 0, scale: 1.15, duration: 250, onComplete: () => blast.destroy(),
      });
      this.scene.cameras.main.shake(150, 0.008);
      playSfx(this.scene, 'explosion');

      const player = this.scene.player;
      if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= cfg.radius + PLAYER_HIT_RADIUS) {
        this.scene.damagePlayer(this.scaled(cfg.damage));
      }
      this.later(400, () => this.scheduleNextPattern());
    });
  }

  // ─── 패턴: 중앙 이동 후 전방위 미사일 (보스) ──────────────

  patternMissiles() {
    const cfg = BOSS_AI.missiles;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, cx, cy);

    this.state = 'scripted';
    this.scene.tweens.add({
      targets: this,
      x: cx,
      y: cy,
      duration: Math.max(200, (dist / cfg.moveSpeed) * 1000),
      ease: 'Sine.InOut',
      onComplete: () => {
        if (!this.active) return;
        for (let v = 0; v < cfg.volleys; v++) {
          this.later(v * cfg.volleyGapMs, () => this.fireRing(cfg, v));
        }
        this.later(cfg.volleys * cfg.volleyGapMs + 300, () => this.scheduleNextPattern());
      },
    });
  }

  fireRing(cfg, volleyIndex) {
    const step = (Math.PI * 2) / cfg.bulletsPerVolley;
    const offset = (volleyIndex % 2) * (step / 2); // 발사마다 반 칸씩 엇갈려서 빈틈 위치를 바꿈
    for (let i = 0; i < cfg.bulletsPerVolley; i++) {
      this.scene.enemyBullets.create(this.x, this.y, 'enemy-bullet')
        .fire(offset + i * step, cfg.bulletSpeed, this.scaled(cfg.damage));
    }
    playSfx(this.scene, 'missile');
  }

  // ─── 패턴: 낙뢰 (보스) ────────────────────────────────

  patternLightning() {
    const cfg = BOSS_AI.lightning;
    const player = this.scene.player;
    this.state = 'slowChase';

    // 한 곳은 플레이어 현재 위치, 나머지는 무작위
    const spots = [{ x: player.x, y: player.y }];
    for (let i = 1; i < cfg.strikes; i++) {
      spots.push({
        x: Phaser.Math.Between(SCREEN_MARGIN, GAME_WIDTH - SCREEN_MARGIN),
        y: Phaser.Math.Between(SCREEN_MARGIN, GAME_HEIGHT - SCREEN_MARGIN),
      });
    }

    for (const spot of spots) {
      const outline = this.addFx(this.scene.add.circle(spot.x, spot.y, cfg.radius)
        .setStrokeStyle(3, 0xffea00, 0.9).setDepth(4));
      const fill = this.addFx(this.scene.add.circle(spot.x, spot.y, cfg.radius, 0xffea00, 0.25)
        .setScale(0).setDepth(4));
      this.scene.tweens.add({ targets: fill, scale: 1, duration: cfg.delayMs });

      this.later(cfg.delayMs, () => {
        this.removeFx(outline);
        this.removeFx(fill);
        this.strike(spot, cfg);
      });
    }

    this.later(cfg.delayMs + 500, () => this.scheduleNextPattern());
  }

  strike(spot, cfg) {
    // 하늘에서 내려꽂히는 지그재그 번개
    const g = this.scene.add.graphics().setDepth(7);
    const points = [];
    for (let y = -20, i = 0; y < spot.y; y += 50, i++) {
      points.push(new Phaser.Math.Vector2(spot.x + (i % 2 ? 14 : -14), y));
    }
    points.push(new Phaser.Math.Vector2(spot.x, spot.y));
    g.lineStyle(10, 0xffea00, 0.5).strokePoints(points);
    g.lineStyle(4, 0xffffff, 1).strokePoints(points);
    g.fillStyle(0xffffff, 0.7).fillCircle(spot.x, spot.y, cfg.radius);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
    playSfx(this.scene, 'thunder', { throttleMs: 60 });

    const player = this.scene.player;
    if (Phaser.Math.Distance.Between(spot.x, spot.y, player.x, player.y) <= cfg.radius + PLAYER_HIT_RADIUS) {
      this.scene.damagePlayer(this.scaled(cfg.damage));
    }
  }

  // 스테이지 난이도에 따른 공격력
  scaled(damage) {
    return Math.round(damage * this.damageMul);
  }

  // ─── 보조 ───────────────────────────────────────────

  // 보스가 살아 있을 때만 실행되는 예약 호출
  later(delay, fn) {
    this.timers.push(this.scene.time.delayedCall(delay, () => {
      if (this.active) fn();
    }));
  }

  addFx(obj) {
    this.fx.push(obj);
    return obj;
  }

  removeFx(obj) {
    Phaser.Utils.Array.Remove(this.fx, obj);
    this.scene.tweens.killTweensOf(obj);
    obj.destroy();
  }

  die() {
    if (!this.active) return;
    for (const t of this.timers) t.remove();
    for (const obj of [...this.fx]) this.removeFx(obj);
    this.scene.tweens.killTweensOf(this); // 중앙 이동 트윈 중단
    super.die();
  }
}
