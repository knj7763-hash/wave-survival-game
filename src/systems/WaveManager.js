import Phaser from 'phaser';
import {
  WAVE, WAVE_TYPES, BOSS, STAGE_COUNT, ENEMY, STAGE_CLEAR_HEAL_RATIO, DIFFICULTY, GAME_HEIGHT,
  spawnSideForStage, normalWaveEnemyCount,
} from '../config.js';
import { difficultyFor, pickEnemyType } from './Difficulty.js';
import { playSfx, playMusic } from './Sound.js';

const WAVE_TITLES = {
  normal: { sub: '', color: '#ffffff' },
  miniboss: { sub: '준보스 등장!', color: '#ce93d8' },
  boss: { sub: 'BOSS 등장!', color: '#ff5252' },
};

// 스테이지 = 8웨이브 진행을 관리한다.
// 일반 웨이브: 정해진 수의 적을 모두 처치하면 클리어.
// 준보스/보스 웨이브: 보스를 처치하면 클리어 (남은 잡몹은 함께 소멸).
export default class WaveManager {
  constructor(scene, stage = 1) {
    this.scene = scene;
    this.stage = stage;
    this.waveIndex = 0;
    this.state = 'idle'; // idle → intro → fighting → cleared
    this.spawnSide = spawnSideForStage(stage);
    this.toSpawn = 0;
    this.boss = null;
    this.timers = [];
  }

  get wave() {
    return this.waveIndex + 1;
  }

  get waveType() {
    return WAVE_TYPES[this.waveIndex];
  }

  // 일반 웨이브에서 남은 적 수 (아직 안 나온 적 + 살아있는 적)
  get remaining() {
    return this.toSpawn + this.scene.enemies.countActive();
  }

  start() {
    this.startWave();
  }

  startWave() {
    this.state = 'intro';
    this.difficulty = difficultyFor(this.stage, this.wave);
    const { sub, color } = WAVE_TITLES[this.waveType];
    this.scene.showBanner(`WAVE ${this.wave} / ${WAVE_TYPES.length}`, sub, color);
    playSfx(this.scene, this.waveType === 'normal' ? 'waveStart' : 'alarm');
    playMusic(this.scene, this.waveType === 'boss' ? 'bgmBoss' : 'bgm');
    this.scene.time.delayedCall(WAVE.introMs, () => this.beginFight());
  }

  // y를 생략하면 화면 높이 안에서 무작위
  spawnMinion(y) {
    if (this.scene.enemies.countActive() >= ENEMY.maxAlive) return false;
    this.scene.spawnEnemy(pickEnemyType(this.difficulty.mix), this.spawnSide, this.difficulty, y);
    return true;
  }

  // 한 무리를 같은 높이 근처에 한꺼번에 등장시킨다. limit: 이번 웨이브에 남은 등장 수. 실제로 나온 수를 반환.
  spawnRush(size, limit = Infinity) {
    const spread = WAVE.rushSpreadY;
    const centerY = Phaser.Math.Between(spread + 30, GAME_HEIGHT - spread - 30);
    let spawned = 0;
    while (spawned < Math.min(size, limit)) {
      if (!this.spawnMinion(centerY + Phaser.Math.Between(-spread, spread))) break;
      spawned++;
    }
    return spawned;
  }

  beginFight() {
    this.state = 'fighting';
    const diff = this.difficulty;

    if (this.waveType === 'normal') {
      this.toSpawn = normalWaveEnemyCount(this.stage, this.wave);
      // 쉴 틈 없이 이어지는 흐름 + 주기적으로 몰려오는 무리 (웨이브 시작과 동시에 첫 무리)
      // 진행할수록 등장 간격이 짧아지고, 한 번에 나오는 수와 무리 크기가 커진다
      const rush = () => { this.toSpawn -= this.spawnRush(diff.rushSize, this.toSpawn); };
      rush();
      this.addTimer(diff.spawnIntervalMs, () => {
        for (let i = 0; i < diff.spawnBatch && this.toSpawn > 0; i++) {
          if (!this.spawnMinion()) break;
          this.toSpawn--;
        }
      });
      this.addTimer(diff.rushIntervalMs, rush);
      return;
    }

    this.boss = this.scene.spawnEnemy(this.waveType, this.spawnSide, diff);
    this.addTimer(diff.minionIntervalMs, () => this.spawnMinion());
    const bossRush = Math.round(diff.rushSize * DIFFICULTY.bossRushScale);
    this.addTimer(diff.rushIntervalMs, () => this.spawnRush(bossRush));
  }

  // 보스(Boss.startPattern)가 패턴에 진입할 때 호출. 일정 확률로 적 등장 방향이 반대로 바뀐다.
  onBossPatternStart() {
    if (Math.random() < BOSS.directionFlipChance) {
      this.setSpawnSide(this.spawnSide === 'left' ? 'right' : 'left', true);
    }
  }

  setSpawnSide(side, isBossFlip) {
    this.spawnSide = side;
    this.scene.onSpawnSideChanged(side, isBossFlip);
  }

  onEnemyKilled(enemy) {
    if (this.state !== 'fighting') return;

    if (enemy === this.boss) {
      this.clearWave();
    } else if (this.waveType === 'normal' && this.remaining === 0) {
      this.clearWave();
    }
  }

  clearWave() {
    this.state = 'cleared';
    this.stopTimers();
    this.boss = null;
    this.toSpawn = 0;

    this.scene.killAllEnemies(); // 보스 웨이브에서 남은 잡몹 정리
    this.scene.clearEnemyBullets();
    this.scene.magnetizeOrbs();
    this.scene.onWaveCleared(this.waveType); // 웨이브 클리어 코인, 보스 재료

    if (this.waveIndex === WAVE_TYPES.length - 1) {
      this.clearStage();
      return;
    }

    this.scene.showBanner('WAVE CLEAR', '', '#69f0ae');
    playSfx(this.scene, 'waveClear');
    this.scene.time.delayedCall(WAVE.breakMs, () => {
      this.waveIndex++;
      this.startWave();
    });
  }

  clearStage() {
    if (this.stage >= STAGE_COUNT) {
      this.scene.victory();
      return;
    }

    const healed = this.scene.healPlayerRatio(STAGE_CLEAR_HEAL_RATIO);
    this.scene.showBanner(`STAGE ${this.stage} CLEAR!`, `체력 +${healed} 회복`, '#ffd54f');
    playSfx(this.scene, 'success');
    this.scene.time.delayedCall(WAVE.stageBreakMs, () => {
      this.stage++;
      this.waveIndex = 0;
      this.scene.onStageChanged(this.stage);
      this.setSpawnSide(spawnSideForStage(this.stage), false);
      this.startWave();
    });
  }

  // 개발용: 현재 웨이브의 적을 모두 처치해 즉시 클리어
  skipWave() {
    if (this.state !== 'fighting') return;
    this.toSpawn = 0;
    if (this.boss) this.boss.die();
    else this.scene.killAllEnemies();
    // 아직 적이 한 마리도 나오지 않았으면 처치 이벤트가 없으므로 직접 클리어
    if (this.state === 'fighting') this.clearWave();
  }

  addTimer(delay, callback) {
    this.timers.push(this.scene.time.addEvent({ delay, loop: true, callback }));
  }

  stopTimers() {
    for (const t of this.timers) t.remove();
    this.timers = [];
  }
}
