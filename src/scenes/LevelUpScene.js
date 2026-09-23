import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../config.js';

const CARD_W = 300;
const CARD_H = 240;
const CARD_GAP = 36;
const INPUT_DELAY_MS = 250; // 이동 중 실수로 바로 선택되지 않게 잠깐 입력을 막는다

const TAG_COLORS = { new: '#69f0ae', upgrade: '#ffd54f', heal: '#ff8a80' };

// 게임 씬 위에 띄우는 레벨업 선택 화면.
// data: { level, choices: [{ type, title, tag, lines }], onPick(choice) }
export default class LevelUpScene extends Phaser.Scene {
  constructor() {
    super('LevelUp');
  }

  create({ level, choices, onPick }) {
    this.onPick = onPick;
    this.picked = false;
    this.readyAt = this.time.now + INPUT_DELAY_MS;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const base = { fontFamily: FONT_FAMILY, color: '#ffffff' };

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0);
    this.add.text(cx, cy - 200, `LEVEL UP!  Lv ${level}`, { ...base, fontSize: '44px', color: '#ffd54f' })
      .setOrigin(0.5);
    this.add.text(cx, cy - 150, '업그레이드를 하나 선택하세요  (클릭 또는 1 / 2 / 3)', {
      ...base, fontSize: '18px', color: '#b0b8c8',
    }).setOrigin(0.5);

    const totalW = choices.length * CARD_W + (choices.length - 1) * CARD_GAP;
    choices.forEach((choice, i) => {
      const x = cx - totalW / 2 + CARD_W / 2 + i * (CARD_W + CARD_GAP);
      this.createCard(x, cy + 40, choice, i, base);
    });

    this.input.keyboard.on('keydown', (event) => {
      const index = Number(event.key) - 1;
      if (choices[index]) this.pick(choices[index]);
    });
  }

  createCard(x, y, choice, index, base) {
    const card = this.add.rectangle(x, y, CARD_W, CARD_H, 0x1f2533)
      .setStrokeStyle(3, 0x3d4658)
      .setInteractive({ useHandCursor: true });

    const top = y - CARD_H / 2;
    this.add.text(x - CARD_W / 2 + 14, top + 12, `${index + 1}`, { ...base, fontSize: '16px', color: '#6b7488' });
    this.add.text(x, top + 30, choice.tag, { ...base, fontSize: '16px', color: TAG_COLORS[choice.type] })
      .setOrigin(0.5, 0);
    this.add.text(x, top + 58, choice.title, { ...base, fontSize: '30px' }).setOrigin(0.5, 0);
    this.add.text(x, top + 112, choice.lines.join('\n'), {
      ...base, fontSize: '16px', color: '#cfd6e4', align: 'center', lineSpacing: 6,
      wordWrap: { width: CARD_W - 32, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    card.on('pointerover', () => card.setStrokeStyle(3, 0xffd54f));
    card.on('pointerout', () => card.setStrokeStyle(3, 0x3d4658));
    card.on('pointerdown', () => this.pick(choice));
  }

  pick(choice) {
    if (this.picked || this.time.now < this.readyAt) return;
    this.picked = true;
    this.onPick(choice);
    this.scene.resume('Game');
    this.scene.stop();
  }
}
