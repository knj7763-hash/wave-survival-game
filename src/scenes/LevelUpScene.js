import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../config.js';

const CARD_W = 300;
const CARD_H = 300;
const CARD_GAP = 36;
const INPUT_DELAY_MS = 250; // 이동 중 실수로 바로 선택되지 않게 잠깐 입력을 막는다

const TAG_COLORS = { new: '#69f0ae', upgrade: '#ffd54f', heal: '#ff8a80' };
const BORDER = { normal: 0x3d4658, hover: 0xffd54f };

// 게임 씬 위에 띄우는 레벨업 선택 화면 (레벨업 효과 3개 중 1개).
// data: { level, choices: [{ type, icon, title, tag, level?, maxLevel?, lines }], owned: [{ icon, name, level }],
//         maxOwned, onPick(choice) }
export default class LevelUpScene extends Phaser.Scene {
  constructor() {
    super('LevelUp');
  }

  create({ level, choices, owned = [], maxOwned = 0, onPick }) {
    this.onPick = onPick;
    this.picked = false;
    this.readyAt = this.time.now + INPUT_DELAY_MS;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const base = { fontFamily: FONT_FAMILY, color: '#ffffff' };

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setOrigin(0);
    this.add.text(cx, cy - 250, `LEVEL UP!  Lv ${level}`, { ...base, fontSize: '44px', color: '#ffd54f' })
      .setOrigin(0.5);
    this.add.text(cx, cy - 200, '레벨업 효과를 하나 선택하세요  (클릭 또는 1 / 2 / 3)', {
      ...base, fontSize: '18px', color: '#b0b8c8',
    }).setOrigin(0.5);

    const totalW = choices.length * CARD_W + (choices.length - 1) * CARD_GAP;
    choices.forEach((choice, i) => {
      const x = cx - totalW / 2 + CARD_W / 2 + i * (CARD_W + CARD_GAP);
      this.createCard(x, cy + 10, choice, i, base);
    });

    this.createOwnedRow(cx, cy + 215, owned, maxOwned, base);

    this.input.keyboard.on('keydown', (event) => {
      const index = Number(event.key) - 1;
      if (choices[index]) this.pick(choices[index]);
    });
  }

  createCard(x, y, choice, index, base) {
    const card = this.add.rectangle(x, y, CARD_W, CARD_H, 0x1f2533)
      .setStrokeStyle(3, BORDER.normal)
      .setInteractive({ useHandCursor: true });

    const top = y - CARD_H / 2;
    this.add.text(x - CARD_W / 2 + 14, top + 12, `${index + 1}`, { ...base, fontSize: '16px', color: '#6b7488' });
    this.add.text(x, top + 16, choice.tag, { ...base, fontSize: '15px', color: TAG_COLORS[choice.type] })
      .setOrigin(0.5, 0);
    this.add.text(x, top + 42, choice.icon ?? '', { ...base, fontSize: '42px' }).setOrigin(0.5, 0);
    this.add.text(x, top + 100, choice.title, { ...base, fontSize: '28px' }).setOrigin(0.5, 0);
    if (choice.maxLevel) this.createLevelPips(x, top + 146, choice.level, choice.maxLevel);
    this.add.text(x, top + 170, choice.lines.join('\n'), {
      ...base, fontSize: '15px', color: '#cfd6e4', align: 'center', lineSpacing: 5,
      wordWrap: { width: CARD_W - 32, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    card.on('pointerover', () => card.setStrokeStyle(3, BORDER.hover));
    card.on('pointerout', () => card.setStrokeStyle(3, BORDER.normal));
    card.on('pointerdown', () => this.pick(choice));
  }

  // 강화 단계 표시: 이번에 얻는 단계까지 채운 칸, 이번에 새로 채워지는 칸은 강조
  createLevelPips(x, y, level, maxLevel) {
    const size = 14;
    const gap = 8;
    const startX = x - ((maxLevel - 1) * (size + gap)) / 2;
    for (let i = 1; i <= maxLevel; i++) {
      const color = i < level ? 0xffd54f : i === level ? 0x69f0ae : 0x2e3546;
      this.add.rectangle(startX + (i - 1) * (size + gap), y, size, size, color)
        .setStrokeStyle(1, 0x000000, 0.5).setAngle(45);
    }
  }

  // 아래쪽: 현재 보유 효과 (n / 최대)
  createOwnedRow(cx, y, owned, maxOwned, base) {
    const list = owned.length ? owned.map((e) => `${e.icon} ${e.name} Lv${e.level}`).join('    ') : '없음';
    this.add.text(cx, y, `보유 효과 ${owned.length} / ${maxOwned}`, { ...base, fontSize: '16px', color: '#8a93a6' })
      .setOrigin(0.5);
    this.add.text(cx, y + 28, list, { ...base, fontSize: '16px', color: '#cfd6e4' }).setOrigin(0.5);
  }

  pick(choice) {
    if (this.picked || this.time.now < this.readyAt) return;
    this.picked = true;
    this.onPick(choice);
    this.scene.resume('Game');
    this.scene.stop();
  }
}
