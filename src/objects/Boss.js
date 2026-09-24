import Phaser from 'phaser';
import Enemy from './Enemy.js';
import { BOSS_AI } from '../config.js';
import { playSfx } from '../systems/Sound.js';

const PLAYER_HIT_RADIUS = 12; // 광역 공격 판정 시 더해 주는 플레이어 몸집
const WARN_COLOR = 0xff1744;
const SCREEN_MARGIN = 80; // 낙뢰가 떨어질 수 있는 화면 가장자리 여백
const MISSILE_POSITION_DIST = 280; // 미사일 패턴: 보스가 자리 잡는 플레이어와의 거리

// 설정값이 [min, max]면 그 범위에서 무작위, 숫자면 그대로
function randomMs(value) {
  return Array.isArray(value) ? Phaser.Math.Between(value[0], value[1]) : value;
}

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
    this.updateLook();
    switch (this.state) {
      case 'chase':
        super.chase(target, now);
        break;
      case 'slowChase':
        this.scene.physics.moveToObject(this, target, this.speed * BOSS_AI.lightning.chaseSpeedScale);
        this.faceToward(this.body.velocity.x);
        break;
      case 'hold':
      case 'scripted':
        this.setVelocity(0, 0);
        break;
      // 'dash'는 돌진 속도를 그대로 유지
    }
  }

  // 패턴을 준비/실행하는 동안은 붉은 기운을 두른 공격 자세 (추격 중엔 걷기 애니메이션)
  updateLook() {
    const attacking = this.state !== 'chase';
    if (attacking && !this.attackPose) {
      this.anims.stop();
      this.setTexture(`${this.baseTexture}-attack`);
    } else if (!attacking && this.attackPose) {
      this.anims.play(`${this.baseTexture}-walk`);
    }
    this.attackPose = attacking;
  }

  // ─── 패턴 순환 ───────────────────────────────────────

  scheduleNextPattern() {
    this.state = 'chase';
    this.later(randomMs(this.ai.idleMs), () => this.startPattern());
  }

  startPattern() {
    const options = this.ai.patterns.filter((p) => p !== this.lastPattern);
    const pattern = Phaser.Utils.Array.GetRandom(options);
    this.lastPattern = pattern;

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
    const [min, max] = BOSS_AI.dash.chain[this.typeId];
    this.dashChain(Phaser.Math.Between(min, max), true);
  }

  // remaining번 연속 돌진. 첫 돌진만 준비 시간이 길다.
  dashChain(remaining, isFirst) {
    const cfg = BOSS_AI.dash;
    const player = this.scene.player;
    // 플레이어가 움직이는 방향으로 앞질러 조준 (가만히 있으면 정조준)
    const aimX = player.x + player.body.velocity.x * cfg.aimLead;
    const aimY = player.y + player.body.velocity.y * cfg.aimLead;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, aimX, aimY);
    this.state = 'hold';
    this.faceToward(Math.cos(angle));
    playSfx(this.scene, 'dashWarn');

    // 돌진 방향 경고선 (깜빡임)
    const warn = this.addFx(this.scene.add.graphics().setDepth(4));
    const end = new Phaser.Math.Vector2().setToPolar(angle, cfg.warnLength).add(this);
    warn.lineStyle(this.radius * 1.4, WARN_COLOR, 0.25).lineBetween(this.x, this.y, end.x, end.y);
    this.scene.tweens.add({ targets: warn, alpha: 0.3, duration: 120, yoyo: true, repeat: -1 });

    this.later(isFirst ? randomMs(cfg.windupMs) : cfg.chainWindupMs, () => {
      this.removeFx(warn);
      this.state = 'dash';
      this.scene.physics.velocityFromRotation(angle, cfg.speed, this.body.velocity);

      this.later(cfg.dashMs, () => {
        this.state = 'hold';
        if (remaining > 1) this.dashChain(remaining - 1, false);
        else this.later(cfg.recoverMs, () => this.scheduleNextPattern());
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
    const windupMs = randomMs(cfg.windupMs);
    this.scene.tweens.add({ targets: fill, scale: 1, duration: windupMs });

    this.later(windupMs, () => {
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

      if (Math.random() < cfg.followUpChance) this.shockwaveRing(cfg);
      else this.later(400, () => this.scheduleNextPattern());
    });
  }

  // 광역 공격 직후 바깥 고리 폭발: 첫 폭발을 피해 빠져나간 위치를 노린다. 안쪽 원은 안전.
  shockwaveRing(cfg) {
    const { x, y } = this;
    const width = cfg.ringOuter - cfg.ringInner;
    const mid = (cfg.ringOuter + cfg.ringInner) / 2;
    const ring = this.addFx(this.scene.add.circle(x, y, mid).setStrokeStyle(width, WARN_COLOR, 0.22).setDepth(4));
    const edge = this.addFx(this.scene.add.circle(x, y, cfg.ringOuter).setStrokeStyle(3, WARN_COLOR, 0.8).setDepth(4));
    this.scene.tweens.add({ targets: ring, alpha: 0.5, duration: 110, yoyo: true, repeat: -1 });

    this.later(cfg.ringWindupMs, () => {
      this.removeFx(ring);
      this.removeFx(edge);

      const blast = this.scene.add.circle(x, y, mid).setStrokeStyle(width, 0xffffff, 0.6).setDepth(7);
      this.scene.tweens.add({
        targets: blast, alpha: 0, scale: 1.08, duration: 250, onComplete: () => blast.destroy(),
      });
      this.scene.cameras.main.shake(150, 0.008);
      playSfx(this.scene, 'explosion');

      const player = this.scene.player;
      const d = Phaser.Math.Distance.Between(x, y, player.x, player.y);
      if (d >= cfg.ringInner - PLAYER_HIT_RADIUS && d <= cfg.ringOuter + PLAYER_HIT_RADIUS) {
        this.scene.damagePlayer(this.scaled(cfg.damage));
      }
      this.later(400, () => this.scheduleNextPattern());
    });
  }

  // ─── 패턴: 플레이어 근처로 이동 후 전방위 미사일 (보스) ─────────

  // 탑다운 무한 월드라 화면 중앙 대신, 지금 있는 쪽에서 플레이어와 일정 거리만큼 떨어진 지점으로 이동한다
  patternMissiles() {
    const cfg = BOSS_AI.missiles;
    const player = this.scene.player;
    const side = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
    const cx = player.x + Math.cos(side) * MISSILE_POSITION_DIST;
    const cy = player.y + Math.sin(side) * MISSILE_POSITION_DIST;
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
          this.later(v * cfg.volleyGapMs, () => this.fireRing(cfg));
        }
        this.later(cfg.volleys * cfg.volleyGapMs + 300, () => this.scheduleNextPattern());
      },
    });
  }

  fireRing(cfg) {
    const damage = this.scaled(cfg.damage);
    const fire = (angle) => this.scene.enemyBullets.create(this.x, this.y, 'enemy-bullet')
      .fire(angle, cfg.bulletSpeed, damage);

    // 전방위 고리: 발사마다 빈틈 위치가 무작위로 바뀐다
    const step = (Math.PI * 2) / cfg.bulletsPerVolley;
    const offset = Math.random() * step;
    for (let i = 0; i < cfg.bulletsPerVolley; i++) fire(offset + i * step);

    // 플레이어를 노리는 부채꼴 탄: 고리 빈틈에 가만히 서 있으면 맞는다
    const player = this.scene.player;
    const aim = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const spread = Phaser.Math.DegToRad(cfg.aimedSpreadDeg);
    for (let i = 0; i < cfg.aimedBullets; i++) {
      fire(aim - spread / 2 + (spread * i) / Math.max(1, cfg.aimedBullets - 1));
    }
    playSfx(this.scene, 'missile');
  }

  // ─── 패턴: 낙뢰 (보스) ────────────────────────────────

  patternLightning() {
    const cfg = BOSS_AI.lightning;
    const player = this.scene.player;
    this.state = 'slowChase';

    // 한 곳은 플레이어 현재 위치, 나머지는 지금 화면 안 무작위
    const view = this.scene.viewRect(-SCREEN_MARGIN);
    const spots = [{ x: player.x, y: player.y }];
    for (let i = 1; i < cfg.strikes; i++) {
      spots.push({
        x: Phaser.Math.Between(view.left, view.right),
        y: Phaser.Math.Between(view.top, view.bottom),
      });
    }

    const delayMs = randomMs(cfg.delayMs);
    for (const spot of spots) this.warnStrike(spot, delayMs, cfg);

    // 추적 낙뢰: 그 시점의 플레이어 위치를 노려 연달아 예고
    for (let i = 1; i <= cfg.followUps; i++) {
      this.later(i * cfg.followUpGapMs, () => {
        this.warnStrike({ x: player.x, y: player.y }, cfg.followUpDelayMs, cfg);
      });
    }

    const endMs = Math.max(delayMs, cfg.followUps * cfg.followUpGapMs + cfg.followUpDelayMs);
    this.later(endMs + 400, () => this.scheduleNextPattern());
  }

  warnStrike(spot, delayMs, cfg) {
    const outline = this.addFx(this.scene.add.circle(spot.x, spot.y, cfg.radius)
      .setStrokeStyle(3, 0xffea00, 0.9).setDepth(4));
    const fill = this.addFx(this.scene.add.circle(spot.x, spot.y, cfg.radius, 0xffea00, 0.25)
      .setScale(0).setDepth(4));
    this.scene.tweens.add({ targets: fill, scale: 1, duration: delayMs });

    this.later(delayMs, () => {
      this.removeFx(outline);
      this.removeFx(fill);
      this.strike(spot, cfg);
    });
  }

  strike(spot, cfg) {
    // 하늘(화면 위쪽 끝)에서 내려꽂히는 지그재그 번개
    const g = this.scene.add.graphics().setDepth(7);
    const points = [];
    for (let y = this.scene.viewRect().top - 20, i = 0; y < spot.y; y += 50, i++) {
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
