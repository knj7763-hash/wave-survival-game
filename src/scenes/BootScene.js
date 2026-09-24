import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../config.js';
import { preloadAssets, buildAssets } from '../systems/Assets.js';
import { generateSounds } from '../systems/Sound.js';
import { createEffectTextures } from '../effects/effectTypes.js';

// 이미지 에셋을 불러와 게임용 텍스처로 만들고, 그림이 없는 투사체는 도형 텍스처로 만든다.
// 재시작 시 GameScene만 다시 시작하므로 로딩은 한 번만 일어난다.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '불러오는 중...', {
      fontFamily: FONT_FAMILY, fontSize: '24px', color: '#b0b8c8',
    }).setOrigin(0.5);
    this.load.on('progress', (p) => text.setText(`불러오는 중... ${Math.round(p * 100)}%`));
    preloadAssets(this);
  }

  create() {
    buildAssets(this);

    // 투사체: 모두 오른쪽(0 rad)을 향하게 그리고 발사 각도로 회전
    const g = this.add.graphics();
    g.fillStyle(0xffeb3b).fillCircle(4, 4, 4);
    g.generateTexture('bullet', 8, 8);
    g.clear();

    g.fillStyle(0x8d6e63).fillRect(0, 2, 18, 2); // 화살대
    g.fillStyle(0xeeeeee).fillTriangle(16, 0, 22, 3, 16, 6); // 촉
    g.generateTexture('arrow', 22, 6);
    g.clear();

    g.fillStyle(0x90a4ae).fillRect(0, 1, 14, 4);
    g.fillStyle(0xcfd8dc).fillTriangle(12, 0, 18, 3, 12, 6);
    g.generateTexture('bolt', 18, 6);
    g.clear();

    g.fillStyle(0xffa726).fillCircle(3, 3, 3);
    g.generateTexture('pellet', 6, 6);
    g.destroy();

    createEffectTextures(this); // 레벨업 효과 (구체, 축구공, 미사일, 부메랑, 톱날)

    generateSounds(this);
    this.scene.start('Title');
  }
}
