import Phaser from 'phaser';
import { DIFFICULTY, ENEMY_MIX, WAVE, WAVE_TYPES } from '../config.js';

// 스테이지/웨이브에 따른 난이도 배율. 웨이브가 시작될 때 한 번 계산한다.
export function difficultyFor(stage, wave) {
  const d = DIFFICULTY;
  const p = (stage - 1) * WAVE_TYPES.length + (wave - 1);
  return {
    progress: p,
    hpMul: (1 + d.hpPerStage * (stage - 1)) * (1 + d.hpPerWave * (wave - 1)),
    bossHpMul: (1 + d.bossHpPerStage * (stage - 1)) * (1 + d.hpPerWave * (wave - 1)),
    damageMul: 1 + d.damagePerStage * (stage - 1),
    speedMul: Math.min(d.maxSpeedMul, 1 + d.speedPerStep * p),
    spawnIntervalMs: Math.max(d.minSpawnIntervalMs, WAVE.normalSpawnIntervalMs * (1 - d.spawnSpeedupPerStep * p)),
    spawnBatch: Math.min(d.maxSpawnBatch, 1 + Math.floor(p / d.stepsPerExtraSpawn)),
    minionIntervalMs: Math.max(d.minMinionIntervalMs, WAVE.bossMinionIntervalMs * (1 - d.minionSpeedupPerStep * p)),
    rushIntervalMs: Math.max(d.minRushIntervalMs, WAVE.rushIntervalMs * (1 - d.rushSpeedupPerStep * p)),
    rushSize: d.rushSizeBase + Math.floor(p / d.stepsPerExtraRush),
    mix: ENEMY_MIX[Math.min(stage, ENEMY_MIX.length) - 1],
  };
}

// 구성 비율에 따라 잡몹 종류를 무작위로 고른다
export function pickEnemyType(mix) {
  let r = Math.random();
  for (const [type, weight] of Object.entries(mix)) {
    r -= weight;
    if (r <= 0) return type;
  }
  return Phaser.Utils.Array.GetRandom(Object.keys(mix));
}
