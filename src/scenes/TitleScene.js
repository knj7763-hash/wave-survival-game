import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, STORAGE_KEYS } from '../config.js';
import { loadSave } from '../systems/SaveData.js';
import { costumeTextureKey } from '../shop/shopData.js';
import { createButton } from '../ui/Button.js';

const TEXT = { fontFamily: FONT_FAMILY, color: '#ffffff' };

const CONTROLS = [
  ['WASD / 방향키', '이동 (공격은 자동)'],
  ['1 / 2 / 3', '스킬 사용 (게이지가 차면)'],
  ['F', '스킬 AUTO 켜기/끄기'],
  ['M', '소리 켜기/끄기'],
];

// 첫 화면. 브라우저는 첫 입력 전까지 소리를 막으므로, 여기서 클릭하면 음악도 함께 시작된다.
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const save = loadSave();
    this.cameras.main.setBackgroundColor('#141824');

    // 배경: 양쪽 가장자리에서 다가오는 적 실루엣
    for (let i = 0; i < 14; i++) {
      const left = i % 2 === 0;
      const e = this.add.image(left ? -30 : GAME_WIDTH + 30, Phaser.Math.Between(80, GAME_HEIGHT - 80), 'enemy')
        .setAlpha(0.25).setFlipX(left);
      this.tweens.add({
        targets: e, x: cx + (left ? -160 : 160), duration: Phaser.Math.Between(4000, 9000),
        delay: i * 500, repeat: -1,
      });
    }

    this.add.image(cx, 170, costumeTextureKey(save.costumes.equipped, save.costumes.gender)).setScale(3);
    this.add.text(cx, 275, '웨이브 서바이벌', {
      ...TEXT, fontSize: '64px', stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(cx, 330, '몰려오는 적을 버티고, 보스를 쓰러뜨려라', { ...TEXT, fontSize: '20px', color: '#b0b8c8' })
      .setOrigin(0.5);

    CONTROLS.forEach(([key, desc], i) => {
      const y = 385 + i * 28;
      this.add.text(cx - 20, y, key, { ...TEXT, fontSize: '17px', color: '#ffd54f' }).setOrigin(1, 0.5);
      this.add.text(cx + 20, y, desc, { ...TEXT, fontSize: '17px', color: '#cfd6e4' }).setOrigin(0, 0.5);
    });

    const best = loadBest();
    this.add.text(cx, 520, `최고 생존 기록 ${formatTime(best)}   ·   보유 코인 💰${save.coins}`, {
      ...TEXT, fontSize: '16px', color: '#8a93a6',
    }).setOrigin(0.5);

    createButton(this, cx, 590, 260, 60, '게임 시작 ▶', () => this.startGame(), { style: 'primary', fontSize: 24 });
    this.add.text(cx, 640, 'Enter 키로도 시작할 수 있어요', { ...TEXT, fontSize: '14px', color: '#6b7488' }).setOrigin(0.5);
    this.input.keyboard.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
  }

  startGame() {
    if (this.starting) return;
    this.starting = true;
    this.scene.start('Game', { stage: 1 });
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
