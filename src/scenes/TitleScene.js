import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, STORAGE_KEYS } from '../config.js';
import { loadSave, writeSave } from '../systems/SaveData.js';
import { characterTextureKey, PLAYER_CHARACTERS } from '../shop/shopData.js';
import { setCharacter } from '../shop/shopLogic.js';
import { groundKey, groundOf } from '../systems/Assets.js';
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
    // 배경: 게임과 같은 복도 바닥을 어둡게 깔아 둔다
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, groundKey(1)).setOrigin(0).setTileScale(groundOf(1).tileScale);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d1017, 0.6).setOrigin(0);

    // 배경: 양쪽 가장자리에서 다가오는 적 실루엣
    for (let i = 0; i < 14; i++) {
      const left = i % 2 === 0;
      const e = this.add.sprite(left ? -30 : GAME_WIDTH + 30, Phaser.Math.Between(80, GAME_HEIGHT - 80), 'enemy')
        .setAlpha(0.35).setFlipX(!left).play('enemy-walk'); // 그림이 오른쪽을 바라보므로 오른쪽에서 오는 적만 반전
      e.anims.timeScale = 0.6; // 천천히 다가오는 속도에 맞춰 걸음도 느리게
      this.tweens.add({
        targets: e, x: cx + (left ? -160 : 160), duration: Phaser.Math.Between(4000, 9000),
        delay: i * 500, repeat: -1,
      });
    }

    this.characterImage = this.add.image(cx, 135, characterTextureKey(save.character, true));
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
    // [최고 기록 · 보유 코인] [코인 아이콘] [숫자]를 한 줄로 이어 붙여 가운데 정렬
    const infoStyle = { ...TEXT, fontSize: '16px', color: '#b0b8c8' };
    const label = this.add.text(0, 520, `최고 생존 기록 ${formatTime(best)}   ·   보유 코인 `, infoStyle).setOrigin(0, 0.5);
    const icon = this.add.image(0, 520, 'hud-coin').setScale(0.7);
    const amount = this.add.text(0, 520, ` ${save.coins}`, { ...infoStyle, color: '#ffd54f' }).setOrigin(0, 0.5);
    label.x = cx - (label.width + icon.displayWidth + amount.width) / 2;
    icon.x = label.x + label.width + icon.displayWidth / 2;
    amount.x = icon.x + icon.displayWidth / 2;

    // 무기는 런 전에 상점에서 고르므로 타이틀에서도 상점으로 갈 수 있다
    createButton(this, cx - 140, 590, 260, 60, '게임 시작 ▶', () => this.startGame(), { style: 'primary', fontSize: 24 });
    createButton(this, cx + 140, 590, 260, 60, '상점 (무기 선택)', () => this.scene.start('Shop'), { style: 'warn', fontSize: 22 });
    this.add.text(cx, 640, 'Enter 키로도 시작할 수 있어요', { ...TEXT, fontSize: '14px', color: '#6b7488' }).setOrigin(0.5);
    this.input.keyboard.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard.once('keydown-SPACE', () => this.startGame());

    // 개발용 (npm run dev에서만): G 키로 남학생/여학생 전환 (성별 선택 UI를 만들기 전 확인용)
    if (import.meta.env.DEV) {
      this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, 'G 캐릭터 전환 (개발용)', { ...TEXT, fontSize: '12px', color: '#6b7488' })
        .setOrigin(1, 1);
      this.input.keyboard.on('keydown-G', () => {
        const save = loadSave();
        const ids = Object.keys(PLAYER_CHARACTERS);
        setCharacter(save, ids[(ids.indexOf(save.character) + 1) % ids.length]);
        writeSave(save);
        this.characterImage.setTexture(characterTextureKey(save.character, true));
      });
    }
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
