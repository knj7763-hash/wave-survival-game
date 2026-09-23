import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, LEVEL_UP, WAVE_TYPES, ENEMY_TYPES,
  COIN_REWARDS, xpToNextLevel, STORAGE_KEYS,
} from '../config.js';
import Player from '../objects/Player.js';
import Enemy, { ENEMY_EVENTS } from '../objects/Enemy.js';
import Boss from '../objects/Boss.js';
import EnemyBullet from '../objects/EnemyBullet.js';
import Projectile from '../objects/Projectile.js';
import XpOrb from '../objects/XpOrb.js';
import WaveManager from '../systems/WaveManager.js';
import Effects from '../systems/Effects.js';
import { playSfx, stopMusic, toggleMute, isMuted } from '../systems/Sound.js';
import SkillManager from '../systems/SkillManager.js';
import SkillBar from '../ui/SkillBar.js';
import { createButton } from '../ui/Button.js';
import { loadSave, writeSave } from '../systems/SaveData.js';
import { getLoadout, getItemStats } from '../shop/shopLogic.js';
import { MATERIALS, costumeTextureKey } from '../shop/shopData.js';
import { WEAPONS, STARTING_WEAPON, TIER_NAMES, describeUpgrade } from '../weapons/weaponData.js';
import { WEAPON_CLASSES } from '../weapons/weaponTypes.js';

const SPAWN_MARGIN = 24; // 화면 밖에서 등장하도록 가장자리 바깥 거리
const BOSS_BAR_W = 500;
const BOSS_NAMES = { miniboss: '준보스', boss: 'BOSS' };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.startStage = data.stage ?? 1;
    // 런 시작 시점의 영구 데이터 (상점에서 산 스킬/아이템/코스튬)
    const save = loadSave();
    this.loadout = getLoadout(save);
    this.playerStats = getItemStats(save);
    this.playerTexture = costumeTextureKey(save.costumes.equipped, save.costumes.gender);
    // 이번 런에서 얻은 보상 (런 종료 시 저장)
    this.runCoins = { kills: 0, waves: 0, record: 0 };
    this.runMaterials = {};
    this.elapsedMs = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.pendingLevelUps = 0;
    this.isGameOver = false;
    // 재시작해도 씬 인스턴스는 재사용되므로, 이전 판에서 파괴된 표시 객체 참조를 지운다.
    this.weaponText = null;
    this.banner = null;
  }

  create() {
    this.waves = new WaveManager(this, this.startStage);

    this.drawBackground();
    this.effects = new Effects(this);
    this.edgeIndicator = this.add.graphics();
    this.drawEdgeIndicator(this.waves.spawnSide);

    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, this.playerTexture);
    this.player.faceSide(this.waves.spawnSide);

    this.enemies = this.physics.add.group({ classType: Enemy });
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, null, this);

    this.projectiles = this.physics.add.group({ classType: Projectile, runChildUpdate: true });
    this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => proj.hit(enemy));

    this.enemyBullets = this.physics.add.group({ classType: EnemyBullet, runChildUpdate: true });
    this.physics.add.overlap(this.player, this.enemyBullets, (player, bullet) => {
      if (!bullet.active) return;
      bullet.destroy();
      this.damagePlayer(bullet.damage);
    });

    this.xpOrbs = this.physics.add.group({ classType: XpOrb, runChildUpdate: true });
    this.physics.add.overlap(this.player, this.xpOrbs, (player, orb) => this.collectOrb(orb));

    // 씬 이벤트는 재시작해도 남아 있으므로 종료 시 직접 해제한다.
    this.events.on(ENEMY_EVENTS.KILLED, this.onEnemyKilled, this);
    this.events.once('shutdown', () => this.events.off(ENEMY_EVENTS.KILLED, this.onEnemyKilled, this));

    this.weapons = [];
    this.addOrUpgradeWeapon(STARTING_WEAPON);

    this.skills = new SkillManager(this, this.loadout);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,N,M,ONE,TWO,THREE,F');
    ['ONE', 'TWO', 'THREE'].forEach((key, slot) => this.keys[key].on('down', () => this.useSkill(slot)));
    this.keys.F.on('down', () => this.toggleSkillAuto());
    this.keys.M.on('down', () => this.updateMuteText(toggleMute(this)));
    // 개발용 (npm run dev에서만): N 키로 현재 웨이브 즉시 클리어
    if (import.meta.env.DEV) {
      this.keys.N.on('down', () => {
        if (!this.isGameOver) this.waves.skipWave();
      });
    }

    this.createHud();
    this.waves.start();
  }

  update(time, delta) {
    if (this.isGameOver) return;

    this.elapsedMs += delta;

    this.player.move({
      left: this.cursors.left.isDown || this.keys.A.isDown,
      right: this.cursors.right.isDown || this.keys.D.isDown,
      up: this.cursors.up.isDown || this.keys.W.isDown,
      down: this.cursors.down.isDown || this.keys.S.isDown,
    });

    for (const enemy of this.enemies.getChildren()) {
      if (enemy.active) enemy.chase(this.player, time);
    }

    for (const weapon of this.weapons) weapon.update(time);
    this.skills.update(delta, time);

    this.updateHud();
    this.skillBar.update(time);

    // 경험치는 물리 충돌 중에 오르므로, 레벨업 화면은 프레임 끝에서 연다.
    if (this.pendingLevelUps > 0) this.openLevelUp();
  }

  // ─── 적 ──────────────────────────────────────────────

  // diff: difficultyFor(stage, wave) 결과 (체력/속도/공격력 배율)
  spawnEnemy(typeId, side, diff) {
    const type = ENEMY_TYPES[typeId];
    const offset = SPAWN_MARGIN + type.radius;
    const x = side === 'left' ? -offset : GAME_WIDTH + offset;
    const y = type.isBoss
      ? GAME_HEIGHT / 2
      : Phaser.Math.Between(SPAWN_MARGIN, GAME_HEIGHT - SPAWN_MARGIN);
    if (type.isBoss) {
      const boss = new Boss(this, x, y);
      this.enemies.add(boss, true);
      return boss.setup(typeId, diff).startAI();
    }
    // get()은 사라지는 중인(비활성) 적을 재사용할 수 있으므로 항상 새로 만든다.
    return this.enemies.create(x, y).setup(typeId, diff);
  }

  clearEnemyBullets() {
    this.enemyBullets.clear(true, true);
  }

  killAllEnemies() {
    for (const e of [...this.enemies.getChildren()]) {
      if (e.active) e.die();
    }
  }

  findNearestEnemy(x, y, range) {
    let nearest = null;
    let best = range * range;
    for (const e of this.enemies.getChildren()) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Squared(x, y, e.x, e.y);
      if (d <= best) {
        best = d;
        nearest = e;
      }
    }
    return nearest;
  }

  onEnemyKilled(enemy) {
    this.kills++;
    this.runCoins.kills += COIN_REWARDS.perKill;
    this.xpOrbs.create(enemy.x, enemy.y, 'xp-orb').setup(enemy.xpValue);
    this.skills.onEnemyKilled(enemy);
    this.waves.onEnemyKilled(enemy);
  }

  // 웨이브 클리어 보너스 (일반 10 / 준보스 25 / 보스 50). 보스는 재료 1개를 100% 드롭.
  onWaveCleared(waveType) {
    this.runCoins.waves += COIN_REWARDS.waveClear[waveType];
    if (waveType === 'boss') {
      const id = Phaser.Utils.Array.GetRandom(Object.keys(MATERIALS));
      this.runMaterials[id] = (this.runMaterials[id] ?? 0) + 1;
      this.showToast(`${MATERIALS[id].name} 획득!`);
    }
  }

  get runCoinTotal() {
    return this.runCoins.kills + this.runCoins.waves + this.runCoins.record;
  }

  healPlayerRatio(ratio) {
    const before = this.player.hp;
    this.player.heal(Math.round(this.player.maxHp * ratio));
    return this.player.hp - before;
  }

  onPlayerHit(player, enemy) {
    this.skills.onPlayerContact(enemy, this.time.now); // 화염 보호막 반사 피해
    if (!enemy.active) return;
    if (this.damagePlayer(enemy.contactDamage)) enemy.knockbackFrom(player, this.time.now);
  }

  // 모든 피격의 공통 처리 (장비 방어력, 화염 보호막 감소 적용). 무적 시간이라 피해가 없었으면 false.
  damagePlayer(amount) {
    const multiplier = this.playerStats.damageTakenMultiplier * this.skills.damageTakenMultiplier;
    const reduced = Math.max(1, Math.round(amount * multiplier));
    if (this.isGameOver || !this.player.takeDamage(reduced, this.time.now)) return false;

    this.cameras.main.shake(120, 0.006);
    this.effects.playerHurt();
    playSfx(this, 'hurt');
    if (this.player.isDead) this.gameOver();
    return true;
  }

  // 웨이브 매니저가 등장 방향을 바꿀 때 호출 (스테이지 전환 또는 보스 방향 전환)
  onSpawnSideChanged(side, isBossFlip) {
    this.drawEdgeIndicator(side);
    this.player.faceSide(side);

    this.tweens.add({
      targets: this.edgeIndicator, alpha: 0.2, duration: 150, yoyo: true, repeat: 3,
      onComplete: () => this.edgeIndicator.setAlpha(1),
    });

    if (isBossFlip) {
      const dir = side === 'left' ? '◀ 이제 적이 왼쪽에서 옵니다' : '이제 적이 오른쪽에서 옵니다 ▶';
      this.showBanner('⚠ 방향 전환!', dir, '#ff8a65');
      this.cameras.main.flash(250, 255, 80, 60);
      playSfx(this, 'alarm');
    }
  }

  // ─── 스킬 ───────────────────────────────────────────

  useSkill(slot) {
    if (this.isGameOver) return;
    const result = this.skills.use(slot);
    if (result === 'gauge' || result === 'cooldown') {
      this.skillBar.flashDenied(slot, this.time.now);
      playSfx(this, 'denied');
    }
  }

  toggleSkillAuto() {
    if (!this.isGameOver) this.skills.toggleAuto();
  }

  // ─── 무기 / 경험치 / 레벨업 ─────────────────────────────

  addOrUpgradeWeapon(id) {
    const owned = this.weapons.find((w) => w.id === id);
    if (owned) owned.upgrade();
    else this.weapons.push(new WEAPON_CLASSES[id](this, this.player, id));
    this.weaponText?.setText(this.weaponSummary());
  }

  weaponSummary() {
    return this.weapons.map((w) => `${w.data.name} ${TIER_NAMES[w.level - 1]}`).join('  ·  ');
  }

  collectOrb(orb) {
    if (!orb.active) return;
    const value = orb.value;
    orb.destroy();
    this.gainXp(value);
    playSfx(this, 'pickup', { volume: 0.6, throttleMs: 40 });
  }

  // 웨이브 클리어 시 화면의 오브를 모두 플레이어에게 끌어온다.
  magnetizeOrbs() {
    for (const orb of this.xpOrbs.getChildren()) orb.magnetized = true;
  }

  gainXp(amount) {
    this.xp += amount;
    while (this.xp >= xpToNextLevel(this.level)) {
      this.xp -= xpToNextLevel(this.level);
      this.level++;
      this.pendingLevelUps++;
    }
  }

  // 레벨업 대기 중인 만큼 차례로 선택 화면을 띄운다. 선택하는 동안 게임은 일시정지.
  openLevelUp() {
    this.pendingLevelUps--;
    this.player.setVelocity(0, 0);
    this.updateHud();
    this.effects.levelUp(this.player.x, this.player.y);
    playSfx(this, 'levelup');

    this.scene.launch('LevelUp', {
      level: this.level - this.pendingLevelUps,
      choices: this.buildLevelUpChoices(),
      onPick: (choice) => this.applyLevelUpChoice(choice),
    });
    this.scene.pause();
  }

  // 신규 무기 + 보유 무기 강화 중 무작위 3개. 부족하면 체력 회복으로 채운다.
  buildLevelUpChoices() {
    const pool = [];
    for (const [id, data] of Object.entries(WEAPONS)) {
      const owned = this.weapons.find((w) => w.id === id);
      if (!owned) {
        pool.push({ type: 'new', id, title: data.name, tag: '신규 무기', lines: [data.desc] });
      } else if (!owned.isMaxLevel) {
        pool.push({
          type: 'upgrade',
          id,
          title: data.name,
          tag: `${TIER_NAMES[owned.level - 1]} → ${TIER_NAMES[owned.level]}`,
          lines: describeUpgrade(id, owned.level),
        });
      }
    }

    const choices = Phaser.Utils.Array.Shuffle(pool).slice(0, LEVEL_UP.choiceCount);
    if (choices.length < LEVEL_UP.choiceCount) {
      choices.push({
        type: 'heal', title: '체력 회복', tag: '회복', lines: [`체력 +${LEVEL_UP.healAmount}`],
      });
    }
    return choices;
  }

  applyLevelUpChoice(choice) {
    if (choice.type === 'heal') this.player.heal(LEVEL_UP.healAmount);
    else this.addOrUpgradeWeapon(choice.id);
    this.updateHud();
  }

  // ─── 게임 종료 ───────────────────────────────────────

  gameOver() {
    this.player.setTint(0x888888);
    stopMusic();
    playSfx(this, 'gameOver');
    this.endRun('GAME OVER', '#ff5252');
  }

  victory() {
    stopMusic();
    playSfx(this, 'success');
    this.endRun('ALL CLEAR!', '#ffd54f');
  }

  endRun(title, color) {
    this.isGameOver = true;
    this.physics.pause();
    this.waves.stopTimers();
    this.time.removeAllEvents(); // 예약된 다음 웨이브 시작 등을 취소
    for (const w of this.weapons) w.graphics?.clear(); // 레이저 빔 제거
    this.skills.destroy(); // 화염 브레스/보호막 표시 제거

    const best = this.saveBestSurvival(this.elapsedMs);
    if (best.isNewRecord) this.runCoins.record = COIN_REWARDS.newRecordBonus;
    const totalCoins = this.commitRunRewards();

    this.updateHud();
    this.showResult(title, color, best, totalCoins);

    // 로그라이트: 매 런은 스테이지 1부터. 코인/재료/상점 구매만 누적된다.
    this.keys.R.once('down', () => this.scene.restart({ stage: 1 }));
  }

  // 이번 런의 코인과 재료를 영구 저장에 더하고, 저장 후 보유 코인을 반환
  commitRunRewards() {
    const save = loadSave();
    save.coins += this.runCoinTotal;
    for (const [id, n] of Object.entries(this.runMaterials)) save.materials[id] += n;
    writeSave(save);
    return save.coins;
  }

  // 최고 생존시간을 저장하고 { bestMs, isNewRecord }를 반환한다.
  saveBestSurvival(ms) {
    let bestMs = 0;
    try {
      bestMs = Number(localStorage.getItem(STORAGE_KEYS.bestSurvivalMs)) || 0;
    } catch { /* 저장소를 쓸 수 없는 환경이면 기록 없이 진행 */ }

    const isNewRecord = ms > bestMs;
    if (isNewRecord) {
      bestMs = ms;
      try {
        localStorage.setItem(STORAGE_KEYS.bestSurvivalMs, String(Math.floor(ms)));
      } catch { /* 무시 */ }
    }
    return { bestMs, isNewRecord };
  }

  // ─── 화면 표시 ───────────────────────────────────────

  drawBackground() {
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x <= GAME_WIDTH; x += 64) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += 64) g.lineBetween(0, y, GAME_WIDTH, y);
  }

  // 적이 등장하는 쪽 가장자리를 붉게 표시
  drawEdgeIndicator(side) {
    const edgeX = side === 'left' ? 0 : GAME_WIDTH - 10;
    this.edgeIndicator.clear().fillStyle(0xff3b3b, 0.35).fillRect(edgeX, 0, 10, GAME_HEIGHT);
  }

  // 화면 위쪽 중앙에 잠깐 떠오르는 안내 문구
  showBanner(title, sub, color) {
    this.banner?.destroy();
    const base = { fontFamily: FONT_FAMILY, color: '#ffffff' };
    const titleText = this.add.text(0, 0, title, { ...base, fontSize: '48px', color, stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0.5);
    const items = [titleText];
    if (sub) {
      items.push(this.add.text(0, 44, sub, { ...base, fontSize: '22px', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5));
    }

    this.banner = this.add.container(GAME_WIDTH / 2, 190, items).setDepth(15).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: this.banner, scale: 1, alpha: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1400, duration: 300 });
  }

  createHud() {
    const style = { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#ffffff' };

    this.hpBarBg = this.add.rectangle(20, 20, 240, 18, 0x000000, 0.6).setOrigin(0).setDepth(10);
    this.hpBar = this.add.rectangle(22, 22, 236, 14, 0x4caf50).setOrigin(0).setDepth(10);
    this.hpText = this.add.text(270, 18, '', style).setDepth(10);

    // 경험치 바: 화면 최상단 전체 폭
    this.add.rectangle(0, 0, GAME_WIDTH, 6, 0x000000, 0.6).setOrigin(0).setDepth(10);
    this.xpBar = this.add.rectangle(0, 0, 0, 6, 0x1de9b6).setOrigin(0).setDepth(10);
    this.levelText = this.add.text(20, 44, '', { ...style, fontSize: '18px', color: '#1de9b6' }).setDepth(10);

    this.stageText = this.add.text(GAME_WIDTH / 2, 16, '', { ...style, fontSize: '22px' })
      .setOrigin(0.5, 0).setDepth(10);
    this.waveInfoText = this.add.text(GAME_WIDTH / 2, 46, '', { ...style, fontSize: '16px', color: '#b0b8c8' })
      .setOrigin(0.5, 0).setDepth(10);

    // 준보스/보스 체력바
    const barX = GAME_WIDTH / 2 - BOSS_BAR_W / 2;
    this.bossBarBg = this.add.rectangle(barX, 72, BOSS_BAR_W, 14, 0x000000, 0.6).setOrigin(0).setDepth(10);
    this.bossBar = this.add.rectangle(barX + 2, 74, BOSS_BAR_W - 4, 10, 0xe53935).setOrigin(0).setDepth(10);

    this.timeText = this.add.text(GAME_WIDTH - 20, 18, '', style).setOrigin(1, 0).setDepth(10);
    this.killText = this.add.text(GAME_WIDTH - 20, 46, '', { ...style, fontSize: '16px', color: '#b0b8c8' })
      .setOrigin(1, 0).setDepth(10);
    this.muteText = this.add.text(GAME_WIDTH - 20, 70, '', { ...style, fontSize: '14px', color: '#8a93a6' })
      .setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => this.updateMuteText(toggleMute(this)));
    this.updateMuteText(isMuted());

    this.weaponText = this.add.text(20, GAME_HEIGHT - 16, this.weaponSummary(), { ...style, fontSize: '16px' })
      .setOrigin(0, 1).setDepth(10);
    this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 16,
      `WASD 이동 · 1/2/3 스킬 · F AUTO${import.meta.env.DEV ? '\nN 웨이브 스킵(개발용)' : ''}`, {
        ...style, fontSize: '14px', color: '#8a93a6', align: 'right',
      }).setOrigin(1, 1).setDepth(10);

    this.skillBar = new SkillBar(this, this.skills, {
      onUse: (slot) => this.useSkill(slot),
      onToggleAuto: () => this.toggleSkillAuto(),
    });

    this.updateHud();
  }

  updateHud() {
    const { hp, maxHp } = this.player;
    const ratio = hp / maxHp;
    this.hpBar.width = 236 * ratio;
    this.hpBar.fillColor = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xffc107 : 0xf44336;
    this.hpText.setText(`${hp} / ${maxHp}`);
    this.timeText.setText(`생존 ${formatTime(this.elapsedMs)}`);
    this.killText.setText(`처치 ${this.kills}  ·  코인 +${this.runCoinTotal}`);

    const need = xpToNextLevel(this.level);
    this.xpBar.width = GAME_WIDTH * Math.min(1, this.xp / need);
    this.levelText.setText(`Lv ${this.level}   EXP ${this.xp} / ${need}`);

    const { stage, wave, waveType, spawnSide, state, boss } = this.waves;
    const arrow = spawnSide === 'left' ? '◀ 왼쪽' : '오른쪽 ▶';
    this.stageText.setText(`STAGE ${stage}  ·  WAVE ${wave} / ${WAVE_TYPES.length}  ·  적 등장: ${arrow}`);

    const showBoss = state === 'fighting' && boss?.active;
    this.bossBarBg.setVisible(showBoss);
    this.bossBar.setVisible(showBoss);
    if (showBoss) {
      this.bossBar.width = (BOSS_BAR_W - 4) * Math.max(0, boss.hp / boss.maxHp);
      this.waveInfoText.setText(`${BOSS_NAMES[waveType]}  ${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`);
    } else if (state === 'fighting' && waveType === 'normal') {
      this.waveInfoText.setText(`남은 적 ${this.waves.remaining}`);
    } else {
      this.waveInfoText.setText('');
    }
  }

  showResult(title, color, { bestMs, isNewRecord }, totalCoins) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const base = { fontFamily: FONT_FAMILY, color: '#ffffff' };
    const line = (y, text, style = {}) => this.add.text(cx, y, text, { ...base, fontSize: '20px', ...style })
      .setOrigin(0.5).setDepth(21);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setDepth(20);
    line(cy - 200, title, { fontSize: '64px', color });
    line(cy - 135, `STAGE ${this.waves.stage}  ·  WAVE ${this.waves.wave}  ·  Lv ${this.level}  ·  처치 ${this.kills}`, {
      color: '#b0b8c8',
    });
    line(cy - 95, `생존 시간  ${formatTime(this.elapsedMs)}`, { fontSize: '28px' });
    line(cy - 58, isNewRecord ? `★ 신기록! ★  최고 ${formatTime(bestMs)}` : `최고 기록  ${formatTime(bestMs)}`, {
      fontSize: '22px', color: isNewRecord ? '#ffd54f' : '#b0b8c8',
    });

    // 획득 보상
    const { kills, waves, record } = this.runCoins;
    const parts = [`처치 ${kills}`, `웨이브 보너스 ${waves}`];
    if (record) parts.push(`신기록 보너스 ${record}`);
    line(cy - 5, `획득 코인  +${this.runCoinTotal}`, { fontSize: '30px', color: '#ffd54f' });
    line(cy + 32, parts.join('  ·  '), { fontSize: '16px', color: '#b0b8c8' });
    const mats = Object.entries(this.runMaterials).map(([id, n]) => `${MATERIALS[id].name} ×${n}`);
    if (mats.length) line(cy + 58, `획득 재료  ${mats.join(', ')}`, { fontSize: '16px', color: '#ce93d8' });
    line(cy + 92, `보유 코인  ${totalCoins}`, { fontSize: '18px' });

    createButton(this, cx - 120, cy + 160, 200, 52, '상점', () => this.scene.start('Shop'), {
      style: 'warn', fontSize: 22, depth: 22,
    });
    createButton(this, cx + 120, cy + 160, 200, 52, '다시 시작 (R)', () => this.scene.restart({ stage: 1 }), {
      style: 'primary', fontSize: 22, depth: 22,
    });
  }

  updateMuteText(muted) {
    this.muteText.setText(muted ? '🔇 소리 꺼짐 (M)' : '🔊 소리 켜짐 (M)');
  }

  // 플레이어 위쪽에 잠깐 떠오르는 작은 알림
  showToast(message) {
    const t = this.add.text(this.player.x, this.player.y - 40, message, {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: '#ce93d8', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, delay: 800, duration: 900, onComplete: () => t.destroy() });
  }
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
