import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, LEVEL_UP, WAVE_TYPES, ENEMY_TYPES,
  COIN_REWARDS, xpToNextLevel, STORAGE_KEYS, CAMERA, SPAWN,
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
import Parallax, { stageLayers } from '../systems/Parallax.js';
import { getLoadout, getItemStats, getEquippedWeapon } from '../shop/shopLogic.js';
import { MATERIALS, characterTextureKey } from '../shop/shopData.js';
import { TIER_NAMES } from '../weapons/weaponData.js';
import { WEAPON_CLASSES } from '../weapons/weaponTypes.js';
import LevelUpEffects from '../effects/LevelUpEffects.js';
import { MAX_OWNED_EFFECTS } from '../effects/effectData.js';

const BOSS_BAR_W = 500;
const BOSS_ARROW_MARGIN = 36; // 화면 밖 보스를 가리키는 화살표와 화면 가장자리 사이 거리
const RELOCATE_SPREAD = 0.6; // 멀어진 적을 다시 배치할 때 진행 방향에서 벗어나는 최대 각도 (rad)
const HEART_HP = 10; // 하트 1개 = 체력 10 (반 칸 = 5)
const BG_DIM = 0.35; // 캐릭터와 경고 표시가 잘 보이도록 배경을 어둡게 덮는 정도
const BOSS_NAMES = { miniboss: '준보스', boss: 'BOSS' };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.startStage = data.stage ?? 1;
    // 런 시작 시점의 영구 데이터 (상점에서 산 무기/스킬/아이템/코스튬)
    const save = loadSave();
    this.weaponLoadout = getEquippedWeapon(save);
    this.loadout = getLoadout(save);
    this.playerStats = getItemStats(save);
    this.playerTexture = characterTextureKey(save.character);
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
    this.effectText = null;
    this.banner = null;
  }

  create() {
    this.waves = new WaveManager(this, this.startStage);

    // 탑다운 무한 월드: 플레이어는 원점에서 시작하고 카메라가 따라간다 (중앙 부근 데드존 안에서는 카메라 고정)
    this.player = new Player(this, 0, 0, this.playerTexture);
    this.cameras.main
      .startFollow(this.player, true, CAMERA.lerp, CAMERA.lerp)
      .setDeadzone(CAMERA.deadzoneW, CAMERA.deadzoneH)
      .centerOn(0, 0);

    this.drawBackground();
    this.effects = new Effects(this);

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

    // 무기는 상점에서 장착한 것 하나로 고정. 레벨업으로는 무기와 별개인 레벨업 효과를 얻는다.
    const { id: weaponId, level: weaponLevel } = this.weaponLoadout;
    this.weapon = new WEAPON_CLASSES[weaponId](this, this.player, weaponId, weaponLevel);
    this.levelUpEffects = new LevelUpEffects(this);

    this.skills = new SkillManager(this, this.loadout);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,N,L,M,ONE,TWO,THREE,F');
    ['ONE', 'TWO', 'THREE'].forEach((key, slot) => this.keys[key].on('down', () => this.useSkill(slot)));
    this.keys.F.on('down', () => this.toggleSkillAuto());
    this.keys.M.on('down', () => this.updateMuteText(toggleMute(this)));
    // 개발용 (npm run dev에서만): N 키로 현재 웨이브 즉시 클리어, L 키로 즉시 레벨업
    if (import.meta.env.DEV) {
      this.keys.N.on('down', () => {
        if (!this.isGameOver) this.waves.skipWave();
      });
      this.keys.L.on('down', () => {
        if (!this.isGameOver) this.gainXp(xpToNextLevel(this.level) - this.xp);
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
      if (!enemy.active) continue;
      this.relocateIfFar(enemy);
      enemy.chase(this.player, time);
    }

    this.parallax.update(delta);
    this.weapon.update(time);
    this.levelUpEffects.update(delta);
    this.skills.update(delta, time);

    this.updateHud();
    this.skillBar.update(time);

    // 경험치는 물리 충돌 중에 오르므로, 레벨업 화면은 프레임 끝에서 연다.
    if (this.pendingLevelUps > 0) this.openLevelUp();
  }

  // ─── 적 ──────────────────────────────────────────────

  // diff: difficultyFor(stage, wave) 결과 (체력/속도/공격력 배율).
  // along: 화면 바깥 둘레 위의 등장 위치 (0~1, spawnPoint 참고). 생략하면 사방 중 무작위.
  spawnEnemy(typeId, diff, along = Math.random()) {
    const type = ENEMY_TYPES[typeId];
    const { x, y } = this.spawnPoint(along, type.radius);
    if (type.isBoss) {
      const boss = new Boss(this, x, y);
      this.enemies.add(boss, true);
      return boss.setup(typeId, diff).startAI();
    }
    // get()은 사라지는 중인(비활성) 적을 재사용할 수 있으므로 항상 새로 만든다.
    return this.enemies.create(x, y).setup(typeId, diff);
  }

  // 지금 카메라에 보이는 월드 영역. pad만큼 사방으로 넓힌다.
  viewRect(pad = 0) {
    const cam = this.cameras.main;
    return new Phaser.Geom.Rectangle(cam.scrollX - pad, cam.scrollY - pad, cam.width + pad * 2, cam.height + pad * 2);
  }

  // 화면 바깥 사각형 둘레 위의 점. along은 둘레를 따라 0~1 (위 → 오른쪽 → 아래 → 왼쪽 순서),
  // 범위를 벗어나면 한 바퀴 돌아 이어진다. extra: 적 몸집 반경 등 추가로 더 바깥에 둘 거리.
  spawnPoint(along, extra = 0) {
    const view = this.viewRect(SPAWN.margin + extra);
    const { width: w, height: h } = view;
    let d = Phaser.Math.Wrap(along, 0, 1) * 2 * (w + h);
    if (d < w) return { x: view.x + d, y: view.y };
    d -= w;
    if (d < h) return { x: view.right, y: view.y + d };
    d -= h;
    if (d < w) return { x: view.right - d, y: view.bottom };
    d -= w;
    return { x: view.x, y: view.bottom - d };
  }

  // 등장 둘레의 전체 길이 (px). 둘레 위 거리를 along 단위로 바꿀 때 쓴다.
  spawnPerimeter() {
    const view = this.viewRect(SPAWN.margin);
    return 2 * (view.width + view.height);
  }

  // 화면 중앙에서 angle 방향으로 뻗은 선이 화면 바깥 둘레와 만나는 점
  edgePoint(angle, extra = 0) {
    const view = this.viewRect(SPAWN.margin + extra);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = Math.min(view.width / 2 / Math.abs(cos || 1e-6), view.height / 2 / Math.abs(sin || 1e-6));
    return { x: view.centerX + cos * t, y: view.centerY + sin * t };
  }

  // 플레이어에게서 너무 멀어진 적은 진행 방향 앞쪽 화면 밖으로 옮긴다 (계속 도망만 다닐 수 없게).
  // 보스는 패턴 중에는 경고 표시 위치가 어긋나지 않도록 추격 중일 때만 옮긴다.
  relocateIfFar(enemy) {
    const { player } = this;
    if (Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y) < SPAWN.relocateDistance) return;
    if (enemy.isBoss && enemy.state !== 'chase') return;
    const v = player.body.velocity;
    const heading = v.lengthSq() > 1
      ? Math.atan2(v.y, v.x)
      : Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
    const { x, y } = this.edgePoint(heading + Phaser.Math.FloatBetween(-RELOCATE_SPREAD, RELOCATE_SPREAD), enemy.radius);
    enemy.setPosition(x, y);
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

  // ─── 경험치 / 레벨업 효과 ───────────────────────────────

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
      owned: this.levelUpEffects.summary(),
      maxOwned: MAX_OWNED_EFFECTS,
      onPick: (choice) => this.applyLevelUpChoice(choice),
    });
    this.scene.pause();
  }

  // 신규 효과 + 보유 효과 강화 중 무작위 3개. 부족하면 (모두 최대 강화 등) 체력 회복으로 채운다.
  buildLevelUpChoices() {
    const choices = this.levelUpEffects.buildChoices(LEVEL_UP.choiceCount);
    if (choices.length < LEVEL_UP.choiceCount) {
      choices.push({
        type: 'heal', icon: '❤️', title: '체력 회복', tag: '회복', lines: [`체력 +${LEVEL_UP.healAmount}`],
      });
    }
    return choices;
  }

  applyLevelUpChoice(choice) {
    if (choice.type === 'heal') this.player.heal(LEVEL_UP.healAmount);
    else this.levelUpEffects.addOrUpgrade(choice.id);
    this.effectText.setText(this.effectSummary());
    this.updateHud();
  }

  // 화면 왼쪽 아래 보유 효과 표시: "⚽ 2  ⚡ 1 ..."
  effectSummary() {
    return this.levelUpEffects.summary().map(({ icon, level }) => `${icon} ${level}`).join('   ');
  }

  // ─── 게임 종료 ───────────────────────────────────────

  gameOver() {
    this.player.anims.stop();
    this.player.setTexture(`${this.playerTexture}-hit`).setTint(0x888888);
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
    this.weapon.graphics?.clear(); // 레이저 빔 제거
    this.levelUpEffects.destroy(); // 궤도 구체/장판/투사체 제거
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

  // fn 안에서 새로 만든 표시 객체를 모두 화면에 고정한다 (카메라가 움직여도 제자리인 HUD/안내/결과 화면).
  // 컨테이너는 자식까지 고정한다: 클릭 판정은 자식 자신의 scrollFactor를 쓰므로 버튼이 눌리려면 필요하다.
  // (Phaser 3.90의 Container.setScrollFactor(x, y, true)는 자식 값을 바꾸지 못해서 직접 내려간다)
  fixedToScreen(fn) {
    const before = new Set(this.children.list);
    const result = fn();
    const pin = (obj) => {
      obj.setScrollFactor?.(0);
      obj.list?.forEach(pin);
    };
    for (const obj of this.children.list) {
      if (!before.has(obj)) pin(obj);
    }
    return result;
  }

  // 스테이지별 탑다운 패럴랙스 바닥 + 캐릭터와 경고 표시가 잘 보이도록 어둡게 덮는 층
  drawBackground() {
    this.parallax = new Parallax(this, stageLayers(this.waves.stage));
    this.fixedToScreen(() => this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d1017, BG_DIM).setOrigin(0).setDepth(-9));
  }

  // 웨이브 매니저가 다음 스테이지로 넘어갈 때 호출
  onStageChanged(stage) {
    this.parallax.setLayers(stageLayers(stage));
  }

  // 화면 위쪽 중앙에 잠깐 떠오르는 안내 문구
  showBanner(title, sub, color) {
    this.fixedToScreen(() => this.createBanner(title, sub, color));
  }

  createBanner(title, sub, color) {
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
    this.fixedToScreen(() => this.buildHud());
    this.updateHud();
  }

  buildHud() {
    // 배경 그림 위에서도 읽히도록 외곽선을 둔다
    const style = { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };

    // 체력: 캐릭터 얼굴 + 하트 (하트 1개 = 체력 10)
    this.add.image(38, 36, `hud-${this.playerTexture}`).setDepth(10);
    this.hearts = [];
    for (let i = 0; i < Math.ceil(this.player.maxHp / HEART_HP); i++) {
      this.hearts.push(this.add.image(74 + i * 26, 26, 'hud-heart-full').setDepth(10));
    }
    this.hpText = this.add.text(74 + this.hearts.length * 26, 14, '', { ...style, fontSize: '18px' }).setDepth(10);

    // 경험치 바: 화면 최상단 전체 폭
    this.add.rectangle(0, 0, GAME_WIDTH, 6, 0x000000, 0.6).setOrigin(0).setDepth(10);
    this.xpBar = this.add.rectangle(0, 0, 0, 6, 0x1de9b6).setOrigin(0).setDepth(10);
    this.levelText = this.add.text(62, 44, '', { ...style, fontSize: '17px', color: '#1de9b6' }).setDepth(10);

    this.stageText = this.add.text(GAME_WIDTH / 2, 16, '', { ...style, fontSize: '22px' })
      .setOrigin(0.5, 0).setDepth(10);
    this.waveInfoText = this.add.text(GAME_WIDTH / 2, 46, '', { ...style, fontSize: '16px', color: '#b0b8c8' })
      .setOrigin(0.5, 0).setDepth(10);

    // 준보스/보스 체력바
    const barX = GAME_WIDTH / 2 - BOSS_BAR_W / 2;
    this.bossBarBg = this.add.rectangle(barX, 72, BOSS_BAR_W, 14, 0x000000, 0.6).setOrigin(0).setDepth(10);
    this.bossBar = this.add.rectangle(barX + 2, 74, BOSS_BAR_W - 4, 10, 0xe53935).setOrigin(0).setDepth(10);

    this.timeText = this.add.text(GAME_WIDTH - 20, 18, '', style).setOrigin(1, 0).setDepth(10);
    this.coinText = this.add.text(GAME_WIDTH - 20, 46, '', { ...style, fontSize: '16px', color: '#ffd54f' })
      .setOrigin(1, 0).setDepth(10);
    this.coinIcon = this.add.image(0, 56, 'hud-coin').setScale(0.75).setDepth(10);
    this.killText = this.add.text(0, 46, '', { ...style, fontSize: '16px', color: '#cfd6e4' })
      .setOrigin(1, 0).setDepth(10);
    this.muteText = this.add.text(GAME_WIDTH - 20, 70, '', { ...style, fontSize: '14px', color: '#8a93a6' })
      .setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => this.updateMuteText(toggleMute(this)));
    this.updateMuteText(isMuted());

    // 왼쪽 아래: 레벨업 효과 (위) + 장착 무기 (아래)
    const weapon = `${this.weapon.data.name} ${TIER_NAMES[this.weapon.level - 1]}`;
    this.add.text(20, GAME_HEIGHT - 16, weapon, { ...style, fontSize: '16px' }).setOrigin(0, 1).setDepth(10);
    this.effectText = this.add.text(20, GAME_HEIGHT - 42, '', { ...style, fontSize: '18px' })
      .setOrigin(0, 1).setDepth(10);
    this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 16,
      `WASD 이동 · 1/2/3 스킬 · F AUTO${import.meta.env.DEV ? '\nN 웨이브 스킵 · L 즉시 레벨업 (개발용)' : ''}`, {
        ...style, fontSize: '14px', color: '#8a93a6', align: 'right',
      }).setOrigin(1, 1).setDepth(10);

    this.skillBar = new SkillBar(this, this.skills, {
      onUse: (slot) => this.useSkill(slot),
      onToggleAuto: () => this.toggleSkillAuto(),
    });

    // 화면 밖에 있는 준보스/보스 방향을 가장자리에서 가리키는 화살표 (오른쪽을 향하게 그리고 회전)
    this.bossArrow = this.add.triangle(0, 0, 0, -12, 24, 0, 0, 12, 0xff5252)
      .setStrokeStyle(2, 0x000000).setDepth(10).setVisible(false);
  }

  updateHud() {
    const { hp, maxHp } = this.player;
    this.hearts.forEach((heart, i) => {
      const left = hp - i * HEART_HP;
      heart.setTexture(left >= HEART_HP ? 'hud-heart-full' : left >= HEART_HP / 2 ? 'hud-heart-half' : 'hud-heart-empty');
    });
    this.hpText.setText(`${hp} / ${maxHp}`);
    this.timeText.setText(`생존 ${formatTime(this.elapsedMs)}`);
    // 오른쪽 위: [처치 N]  [코인 아이콘] +N (오른쪽 정렬이라 글자 폭에 맞춰 아이콘 위치를 옮긴다)
    this.coinText.setText(`+${this.runCoinTotal}`);
    this.coinIcon.x = this.coinText.x - this.coinText.width - 13;
    this.killText.setText(`처치 ${this.kills}`).setPosition(this.coinIcon.x - 16 - this.killText.width, 46);

    const need = xpToNextLevel(this.level);
    this.xpBar.width = GAME_WIDTH * Math.min(1, this.xp / need);
    this.levelText.setText(`Lv ${this.level}   EXP ${this.xp} / ${need}`);

    const { stage, wave, waveType, state, boss } = this.waves;
    this.stageText.setText(`STAGE ${stage}  ·  WAVE ${wave} / ${WAVE_TYPES.length}`);

    const showBoss = state === 'fighting' && boss?.active;
    this.updateBossArrow(showBoss ? boss : null);
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

  // 보스가 화면 밖이면 화면 중앙→보스 방향으로 가장자리에 화살표를 띄운다
  updateBossArrow(boss) {
    const cam = this.cameras.main;
    const view = this.viewRect();
    const offscreen = boss && !Phaser.Geom.Rectangle.Contains(view, boss.x, boss.y);
    this.bossArrow.setVisible(!!offscreen);
    if (!offscreen) return;

    const angle = Phaser.Math.Angle.Between(view.centerX, view.centerY, boss.x, boss.y);
    const halfW = cam.width / 2 - BOSS_ARROW_MARGIN;
    const halfH = cam.height / 2 - BOSS_ARROW_MARGIN;
    const t = Math.min(halfW / Math.abs(Math.cos(angle) || 1e-6), halfH / Math.abs(Math.sin(angle) || 1e-6));
    const blink = 0.6 + 0.4 * Math.sin(this.time.now / 120);
    this.bossArrow.setPosition(cam.width / 2 + Math.cos(angle) * t, cam.height / 2 + Math.sin(angle) * t)
      .setRotation(angle).setAlpha(blink);
  }

  showResult(...args) {
    this.fixedToScreen(() => this.createResult(...args));
  }

  createResult(title, color, { bestMs, isNewRecord }, totalCoins) {
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
    withCoinIcon(line(cy - 5, `획득 코인  +${this.runCoinTotal}`, { fontSize: '30px', color: '#ffd54f' }));
    line(cy + 32, parts.join('  ·  '), { fontSize: '16px', color: '#b0b8c8' });
    const mats = Object.entries(this.runMaterials).map(([id, n]) => `${MATERIALS[id].name} ×${n}`);
    if (mats.length) line(cy + 58, `획득 재료  ${mats.join(', ')}`, { fontSize: '16px', color: '#ce93d8' });
    withCoinIcon(line(cy + 92, `보유 코인  ${totalCoins}`, { fontSize: '18px' }));

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

// 가운데 정렬된 글자 왼쪽에 코인 아이콘을 붙인다
function withCoinIcon(text) {
  const size = text.height * 0.9;
  text.scene.add.image(text.x - text.width / 2 - size * 0.7, text.y, 'hud-coin')
    .setDisplaySize(size, size).setDepth(text.depth);
  return text;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
