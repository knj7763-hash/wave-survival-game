import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, STORAGE_KEYS } from '../config.js';
import { loadSave, writeSave } from '../systems/SaveData.js';
import { createButton } from '../ui/Button.js';
import { playSfx, playMusic, toggleMute } from '../systems/Sound.js';
import { SKILLS, MAX_EQUIPPED_SKILLS } from '../skills/skillData.js';
import {
  MATERIALS, ITEMS, MAX_ITEM_LEVEL, ENHANCE_TABLE, COSTUMES, GENDERS, costumeTextureKey,
} from '../shop/shopData.js';
import {
  buySkill, upgradeSkill, toggleEquipSkill, skillUpgradeCost,
  enhanceItem, itemStatValue, getItemStats,
  buyCostume, equipCostume, setGender,
} from '../shop/shopLogic.js';

const TABS = { skills: '스킬', items: '장비 강화', costumes: '코스튬' };
const CARD_W = 340;
const CARD_H = 400;
const CARD_TOP = 175;
const CARD_GAP = 30;
const TEXT = { fontFamily: FONT_FAMILY, color: '#ffffff' };

const FAIL_MESSAGES = { coins: '코인이 부족합니다', materials: '재료가 부족합니다', max: '이미 최대 단계입니다' };

// 게임 종료 후 들르는 상점. 스킬 구매/강화/장착, 장비 강화, 코스튬 구매/장착.
export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.tab = data?.tab ?? 'skills';
    this.dirty = false;
  }

  create() {
    this.save = loadSave();
    this.cameras.main.setBackgroundColor('#141824');

    this.add.text(40, 28, '상점', { ...TEXT, fontSize: '36px' });
    this.coinText = this.add.text(GAME_WIDTH - 40, 30, '', { ...TEXT, fontSize: '28px', color: '#ffd54f' }).setOrigin(1, 0);
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
    this.coinText.setText(`💰 ${coins}`);
    this.materialText.setText(Object.entries(MATERIALS).map(([id, m]) => `${m.name} ×${materials[id]}`).join('   '));

    Object.entries(TABS).forEach(([id, label], i) => {
      this.page.add(createButton(this, 110 + i * 170, 125, 150, 44, label, () => {
        this.tab = id;
        this.setMessage('');
        this.requestRender();
      }, { style: this.tab === id ? 'warn' : 'normal' }));
    });

    const renderTab = { skills: this.renderSkills, items: this.renderItems, costumes: this.renderCostumes }[this.tab];
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
    const { owned, equipped, gender } = this.save.costumes;

    Object.entries(GENDERS).forEach(([id, label], i) => {
      this.page.add(createButton(this, GAME_WIDTH - 150 + i * 90, 125, 80, 40, label, () => {
        setGender(this.save, id);
        this.commit(`${label}자 캐릭터로 변경`);
      }, { style: gender === id ? 'warn' : 'normal' }));
    });

    Object.entries(COSTUMES).forEach(([id, costume], i) => {
      const x = this.addCard(i);
      const has = owned.includes(id);
      const isEquipped = equipped === id;

      this.page.add(this.add.image(x, CARD_TOP + 105, costumeTextureKey(id, gender)).setScale(3.2));
      this.addText(x, CARD_TOP + 200, costume.name, { fontSize: '24px' });
      this.addText(x, CARD_TOP + 236, costume.desc, { fontSize: '14px', color: '#cfd6e4' });
      this.addText(x, CARD_TOP + 262, '외형 전용 (능력치 없음)', { fontSize: '12px', color: '#8a93a6' });

      if (!has) {
        this.addButton(x, CARD_TOP + 330, `구매  💰${costume.price}`,
          () => this.act(buyCostume(this.save, id), `${costume.name} 구매 및 장착!`), {
            enabled: this.save.coins >= costume.price, style: 'primary',
          });
      } else {
        this.addButton(x, CARD_TOP + 330, isEquipped ? '장착 중' : '장착',
          () => this.act(equipCostume(this.save, id), `${costume.name} 장착`), { enabled: !isEquipped });
      }
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
