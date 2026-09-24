import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, STORAGE_KEYS } from '../config.js';
import { loadSave, writeSave } from '../systems/SaveData.js';
import { createButton } from '../ui/Button.js';
import { playSfx, playMusic, toggleMute } from '../systems/Sound.js';
import { SKILLS, MAX_EQUIPPED_SKILLS } from '../skills/skillData.js';
import { WEAPONS, TIER_NAMES, describeUpgrade } from '../weapons/weaponData.js';
import {
  MATERIALS, ITEMS, MAX_ITEM_LEVEL, ENHANCE_TABLE, COSTUMES, WEAPON_PRICES, costumeTextureKey,
} from '../shop/shopData.js';
import {
  buySkill, upgradeSkill, toggleEquipSkill, skillUpgradeCost,
  enhanceItem, itemStatValue, getItemStats,
  buyWeapon, upgradeWeapon, equipWeapon, weaponTierCost,
  buyCostume, equipCostume,
} from '../shop/shopLogic.js';

const TABS = { weapons: '무기', skills: '스킬', items: '장비 강화', costumes: '코스튬' };
const CARD_W = 340;
const CARD_H = 400;
const CARD_TOP = 175;
const CARD_GAP = 30;
const TEXT = { fontFamily: FONT_FAMILY, color: '#ffffff' };
const COSTUME_CARD_W = 220; // 코스튬은 5종이라 좁은 카드로 한 줄에 배치
const COSTUME_CARD_GAP = 16;
// 무기는 7종이라 4열 2줄 격자
const WEAPON_COLS = 4;
const WEAPON_CARD_W = 285;
const WEAPON_CARD_H = 200;
const WEAPON_GRID_TOP = 160;
const WEAPON_GAP_X = 16;
const WEAPON_GAP_Y = 12;
const TIER_COLORS = ['#cfd6e4', '#64b5f6', '#ffd54f'];
const DEV_COINS = 1000; // 개발용 C 키로 얻는 코인

const FAIL_MESSAGES = { coins: '코인이 부족합니다', materials: '재료가 부족합니다', max: '이미 최대 단계입니다' };

// 런 사이에 들르는 상점. 무기 구매/승급/장착, 스킬 구매/강화/장착, 장비 강화, 코스튬 구매/장착.
export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.tab = data?.tab ?? 'weapons';
    this.dirty = false;
  }

  create() {
    this.save = loadSave();
    this.cameras.main.setBackgroundColor('#141824');

    this.add.text(40, 28, '상점', { ...TEXT, fontSize: '36px' });
    this.coinText = this.add.text(GAME_WIDTH - 40, 30, '', { ...TEXT, fontSize: '28px', color: '#ffd54f' }).setOrigin(1, 0);
    this.coinIcon = this.add.image(0, 48, 'hud-coin').setScale(1.1);
    this.materialText = this.add.text(GAME_WIDTH - 40, 70, '', { ...TEXT, fontSize: '15px', color: '#ce93d8' }).setOrigin(1, 0);

    this.message = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 95, '', { ...TEXT, fontSize: '20px' }).setOrigin(0.5);
    this.add.text(40, GAME_HEIGHT - 45, `최고 생존 기록  ${formatTime(loadBest())}`, {
      ...TEXT, fontSize: '16px', color: '#8a93a6',
    }).setOrigin(0, 0.5);
    createButton(this, GAME_WIDTH - 150, GAME_HEIGHT - 45, 240, 56, '게임 시작 ▶ (Enter)', () => this.startRun(), {
      style: 'primary', fontSize: 20,
    });
    this.input.keyboard.on('keydown-ENTER', () => this.startRun());
    this.input.keyboard.on('keydown-M', () => toggleMute(this));
    // 개발용 (npm run dev에서만): C 키로 코인 획득
    if (import.meta.env.DEV) {
      this.input.keyboard.on('keydown-C', () => {
        this.save.coins += DEV_COINS;
        this.commit(`[개발용] 코인 +${DEV_COINS}`, '#ffd54f');
      });
      this.add.text(40, GAME_HEIGHT - 20, 'C 코인 +1000 (개발용)', { ...TEXT, fontSize: '12px', color: '#6b7488' })
        .setOrigin(0, 0.5);
    }
    playMusic(this, 'bgm');

    this.page = null;
    this.render();
  }

  // 버튼 클릭 처리 중에 그 버튼을 지우지 않도록, 화면 갱신은 다음 프레임에서 한다.
  update() {
    if (this.dirty) {
      this.dirty = false;
      this.render();
    }
  }

  requestRender() {
    this.dirty = true;
  }

  startRun() {
    this.scene.start('Game', { stage: 1 });
  }

  // ─── 화면 갱신 ──────────────────────────────────────

  render() {
    this.page?.destroy();
    this.page = this.add.container(0, 0);

    const { coins, materials } = this.save;
    this.coinText.setText(String(coins));
    this.coinIcon.x = this.coinText.x - this.coinText.width - 20;
    this.materialText.setText(Object.entries(MATERIALS).map(([id, m]) => `${m.name} ×${materials[id]}`).join('   '));

    Object.entries(TABS).forEach(([id, label], i) => {
      this.page.add(createButton(this, 110 + i * 170, 125, 150, 44, label, () => {
        this.tab = id;
        this.setMessage('');
        this.requestRender();
      }, { style: this.tab === id ? 'warn' : 'normal' }));
    });

    const renderTab = {
      weapons: this.renderWeapons, skills: this.renderSkills, items: this.renderItems, costumes: this.renderCostumes,
    }[this.tab];
    renderTab.call(this);
  }

  cardX(i) {
    return GAME_WIDTH / 2 + (i - 1) * (CARD_W + CARD_GAP);
  }

  addCard(i) {
    const x = this.cardX(i);
    this.page.add(this.add.rectangle(x, CARD_TOP + CARD_H / 2, CARD_W, CARD_H, 0x1f2533).setStrokeStyle(2, 0x3d4658));
    return x;
  }

  addText(x, y, text, style = {}) {
    const t = this.add.text(x, y, text, {
      ...TEXT, fontSize: '16px', align: 'center', wordWrap: { width: CARD_W - 40, useAdvancedWrap: true }, ...style,
    }).setOrigin(0.5, 0);
    this.page.add(t);
    return t;
  }

  addButton(x, y, label, onClick, opts) {
    this.page.add(createButton(this, x, y, CARD_W - 60, 46, label, onClick, opts));
  }

  // ─── 무기 탭 ────────────────────────────────────────

  renderWeapons() {
    const { owned, equipped } = this.save.weapons;
    this.page.add(this.add.text(GAME_WIDTH - 40, 125,
      `장착: ${WEAPONS[equipped].name} (${TIER_NAMES[owned[equipped] - 1]})  ·  런 중에는 바뀌지 않아요`, {
        ...TEXT, fontSize: '16px', color: '#b0b8c8',
      }).setOrigin(1, 0.5));

    const ids = Object.keys(WEAPON_PRICES);
    const rows = Math.ceil(ids.length / WEAPON_COLS);
    ids.forEach((id, i) => {
      const row = Math.floor(i / WEAPON_COLS);
      // 마지막 줄은 개수가 적으면 가운데로 모은다
      const inRow = row === rows - 1 ? ids.length - row * WEAPON_COLS : WEAPON_COLS;
      const col = i % WEAPON_COLS;
      const x = GAME_WIDTH / 2 + (col - (inRow - 1) / 2) * (WEAPON_CARD_W + WEAPON_GAP_X);
      const top = WEAPON_GRID_TOP + row * (WEAPON_CARD_H + WEAPON_GAP_Y);
      this.renderWeaponCard(id, x, top, owned[id] ?? 0, equipped === id);
    });
  }

  renderWeaponCard(id, x, top, level, isEquipped) {
    const weapon = WEAPONS[id];
    const narrow = { wordWrap: { width: WEAPON_CARD_W - 24, useAdvancedWrap: true } };
    this.page.add(this.add.rectangle(x, top + WEAPON_CARD_H / 2, WEAPON_CARD_W, WEAPON_CARD_H, 0x1f2533)
      .setStrokeStyle(isEquipped ? 3 : 2, isEquipped ? 0xffd54f : 0x3d4658));

    const title = this.addText(x, top + 12, weapon.name, { fontSize: '22px', ...narrow });
    if (level) {
      title.setText(`${weapon.name}  ·  ${TIER_NAMES[level - 1]}`).setColor(TIER_COLORS[level - 1]);
    }
    if (isEquipped) {
      this.page.add(this.add.text(x + WEAPON_CARD_W / 2 - 10, top + 8, '장착 중', {
        ...TEXT, fontSize: '12px', color: '#ffd54f',
      }).setOrigin(1, 0));
    }
    this.addText(x, top + 44, weapon.desc, { fontSize: '13px', color: '#8a93a6', ...narrow });

    // 미보유: 기본 능력치 / 보유: 다음 등급 변화 / 최대: 현재 형태
    const stats = weapon.levels[Math.max(level, 1) - 1];
    let info;
    let color = '#cfd6e4';
    if (!level) {
      info = `데미지 ${stats.damage} · 공격 간격 ${(stats.cooldown / 1000).toFixed(2)}초 · 사거리 ${stats.range}`;
    } else if (level < weapon.levels.length) {
      info = [`다음 등급 (${TIER_NAMES[level]})`, ...describeUpgrade(id, level).slice(0, 3)].join('\n');
      color = '#69f0ae';
    } else {
      info = `최대 등급\n★ ${stats.pattern}`;
      color = '#ffd54f';
    }
    this.addText(x, top + 68, info, { fontSize: '13px', color, lineSpacing: 2, ...narrow });

    const btnY = top + WEAPON_CARD_H - 24;
    const btnW = (WEAPON_CARD_W - 36) / 2;
    const button = (bx, w, label, onClick, opts) => this.page.add(createButton(this, bx, btnY, w, 34, label, onClick, {
      fontSize: 15, ...opts,
    }));
    if (!level) {
      const price = WEAPON_PRICES[id];
      button(x, WEAPON_CARD_W - 24, `구매  💰${price}`, () => this.act(buyWeapon(this.save, id), `${weapon.name} 구매 및 장착!`), {
        enabled: this.save.coins >= price, style: 'primary',
      });
      return;
    }
    const cost = weaponTierCost(id, level);
    button(x - btnW / 2 - 6, btnW, cost === null ? 'MAX' : `승급  💰${cost}`,
      () => this.act(upgradeWeapon(this.save, id), `${weapon.name} ${TIER_NAMES[level]} 승급 완료!`), {
        enabled: cost !== null && this.save.coins >= cost, style: 'warn',
      });
    button(x + btnW / 2 + 6, btnW, isEquipped ? '장착 중' : '장착',
      () => this.act(equipWeapon(this.save, id), `${weapon.name} 장착`), { enabled: !isEquipped });
  }

  // ─── 스킬 탭 ────────────────────────────────────────

  renderSkills() {
    const { skills, equippedSkills, coins } = this.save;
    this.page.add(this.add.text(GAME_WIDTH - 40, 125, `장착 ${equippedSkills.length} / ${MAX_EQUIPPED_SKILLS}`, {
      ...TEXT, fontSize: '18px', color: '#b0b8c8',
    }).setOrigin(1, 0.5));

    Object.entries(SKILLS).forEach(([id, skill], i) => {
      const x = this.addCard(i);
      const level = skills[id] ?? 0;
      const equipped = equippedSkills.includes(id);

      this.addText(x, CARD_TOP + 20, skill.icon, { fontSize: '40px' });
      this.addText(x, CARD_TOP + 82, skill.name, { fontSize: '24px' });
      this.addText(x, CARD_TOP + 118, level ? `Lv ${level} / 5${equipped ? '  ·  장착 중' : ''}` : '미보유', {
        color: equipped ? '#69f0ae' : level ? '#ffd54f' : '#8a93a6',
      });
      this.addText(x, CARD_TOP + 150, skill.desc, { fontSize: '14px', color: '#cfd6e4' });
      this.addText(x, CARD_TOP + 200, `${level ? '현재' : 'Lv1'}  ${skill.summary(skill.levels[Math.max(level, 1) - 1])}`, {
        fontSize: '14px',
      });
      if (level && level < 5) {
        this.addText(x, CARD_TOP + 224, `다음  ${skill.summary(skill.levels[level])}`, { fontSize: '14px', color: '#69f0ae' });
      }
      this.addText(x, CARD_TOP + 248, `쿨타임 ${skill.cooldownMs / 1000}초`, { fontSize: '13px', color: '#8a93a6' });

      if (!level) {
        this.addButton(x, CARD_TOP + 310, `구매  💰${skill.price}`, () => this.act(buySkill(this.save, id), `${skill.name} 구매 완료!`), {
          enabled: coins >= skill.price, style: 'primary',
        });
      } else {
        const cost = skillUpgradeCost(id, level);
        this.addButton(x, CARD_TOP + 310, cost === null ? 'MAX' : `강화  💰${cost}  → Lv${level + 1}`,
          () => this.act(upgradeSkill(this.save, id), `${skill.name} Lv${level + 1} 강화 완료!`), {
            enabled: cost !== null && coins >= cost, style: 'primary',
          });
        const canEquip = equipped || equippedSkills.length < MAX_EQUIPPED_SKILLS;
        this.addButton(x, CARD_TOP + 364, equipped ? '장착 해제' : '장착',
          () => this.act(toggleEquipSkill(this.save, id), equipped ? `${skill.name} 해제` : `${skill.name} 장착`), {
            enabled: canEquip,
          });
      }
    });
  }

  // ─── 장비 강화 탭 ────────────────────────────────────

  renderItems() {
    const stats = getItemStats(this.save);
    this.page.add(this.add.text(GAME_WIDTH - 40, 125,
      `방어력 ${stats.defense} (받는 피해 -${Math.round((1 - stats.damageTakenMultiplier) * 100)}%)  ·  `
      + `공격력 ${stats.attack} (주는 피해 +${Math.round((stats.damageDealtMultiplier - 1) * 100)}%)`, {
        ...TEXT, fontSize: '16px', color: '#b0b8c8',
      }).setOrigin(1, 0.5));

    Object.entries(ITEMS).forEach(([slot, item], i) => {
      const x = this.addCard(i);
      const level = this.save.items[slot];
      const value = itemStatValue(slot, level);
      const owned = this.save.materials[item.material];

      this.addText(x, CARD_TOP + 22, item.slotName, { fontSize: '14px', color: '#8a93a6' });
      this.addText(x, CARD_TOP + 48, `${item.name} +${level}`, { fontSize: '26px' });
      this.addText(x, CARD_TOP + 95, level < MAX_ITEM_LEVEL
        ? `${item.statName} ${value}  →  ${itemStatValue(slot, level + 1)}`
        : `${item.statName} ${value}  (MAX)`, { fontSize: '20px', color: '#69f0ae' });
      this.addText(x, CARD_TOP + 140, `재료: ${MATERIALS[item.material].name}\n(보유 ${owned}개)`, {
        fontSize: '14px', color: '#ce93d8',
      });

      if (level >= MAX_ITEM_LEVEL) {
        this.addButton(x, CARD_TOP + 330, 'MAX', () => {}, { enabled: false });
        return;
      }
      const { coins, materials, chance } = ENHANCE_TABLE[level];
      this.addText(x, CARD_TOP + 200, `필요  💰${coins}  ·  재료 ${materials}개`, { fontSize: '16px' });
      this.addText(x, CARD_TOP + 228, `성공 확률 ${Math.round(chance * 100)}%`, {
        fontSize: '18px', color: chance >= 0.75 ? '#69f0ae' : chance >= 0.5 ? '#ffd54f' : '#ff8a80',
      });
      if (chance < 1) {
        this.addText(x, CARD_TOP + 258, `실패 시 재료 소모 · 코인 ${Math.floor(coins / 2)} 반환`, {
          fontSize: '13px', color: '#8a93a6',
        });
      }
      this.addButton(x, CARD_TOP + 330, '강화', () => this.enhance(slot), {
        enabled: this.save.coins >= coins && owned >= materials, style: 'warn',
      });
    });
  }

  enhance(slot) {
    const item = ITEMS[slot];
    const { result, refund } = enhanceItem(this.save, slot);
    if (result === 'success') {
      this.commit(`강화 성공! ${item.name} +${this.save.items[slot]}`, '#69f0ae');
      playSfx(this, 'success');
    } else if (result === 'fail') {
      this.commit(`강화 실패... 재료 소모, 코인 ${refund} 반환`, '#ff8a80');
      this.cameras.main.shake(150, 0.005);
      playSfx(this, 'fail');
    } else {
      this.setMessage(FAIL_MESSAGES[result], '#ff8a80');
      playSfx(this, 'denied');
    }
  }

  // ─── 코스튬 탭 ──────────────────────────────────────

  renderCostumes() {
    const { owned, equipped } = this.save.costumes;
    const ids = Object.keys(COSTUMES);
    const narrow = { wordWrap: { width: COSTUME_CARD_W - 20, useAdvancedWrap: true } };

    ids.forEach((id, i) => {
      const costume = COSTUMES[id];
      const x = GAME_WIDTH / 2 + (i - (ids.length - 1) / 2) * (COSTUME_CARD_W + COSTUME_CARD_GAP);
      const has = owned.includes(id);
      const isEquipped = equipped === id;

      this.page.add(this.add.rectangle(x, CARD_TOP + CARD_H / 2, COSTUME_CARD_W, CARD_H, 0x1f2533)
        .setStrokeStyle(isEquipped ? 3 : 2, isEquipped ? 0xffd54f : 0x3d4658));
      this.page.add(this.add.image(x, CARD_TOP + 110, costumeTextureKey(id, true)).setScale(0.9));
      this.addText(x, CARD_TOP + 200, costume.name, { fontSize: '22px', ...narrow });
      this.addText(x, CARD_TOP + 236, costume.desc, { fontSize: '14px', color: '#cfd6e4', ...narrow });
      this.addText(x, CARD_TOP + 262, '외형 전용 (능력치 없음)', { fontSize: '12px', color: '#8a93a6', ...narrow });

      const [label, onClick, opts] = has
        ? [isEquipped ? '장착 중' : '장착', () => this.act(equipCostume(this.save, id), `${costume.name} 장착`), { enabled: !isEquipped }]
        : [`구매  💰${costume.price}`, () => this.act(buyCostume(this.save, id), `${costume.name} 구매 및 장착!`), {
          enabled: this.save.coins >= costume.price, style: 'primary',
        }];
      this.page.add(createButton(this, x, CARD_TOP + 330, COSTUME_CARD_W - 30, 46, label, onClick, opts));
    });
  }

  // ─── 공통 ───────────────────────────────────────────

  act(result, successMessage) {
    if (result.ok) {
      this.commit(successMessage, '#69f0ae');
      playSfx(this, 'coin');
    } else {
      this.setMessage(result.reason, '#ff8a80');
      playSfx(this, 'denied');
    }
  }

  commit(message, color = '#ffffff') {
    writeSave(this.save);
    this.requestRender();
    this.setMessage(message, color);
  }

  setMessage(text, color = '#ffffff') {
    this.message.setText(text).setColor(color).setScale(1.15);
    this.tweens.add({ targets: this.message, scale: 1, duration: 150 });
  }
}

function loadBest() {
  try {
    return Number(localStorage.getItem(STORAGE_KEYS.bestSurvivalMs)) || 0;
  } catch {
    return 0;
  }
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  return `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`;
}
