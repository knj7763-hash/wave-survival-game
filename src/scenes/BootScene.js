import Phaser from 'phaser';
import { COSTUMES, GENDERS, costumeTextureKey } from '../shop/shopData.js';
import { generateSounds } from '../systems/Sound.js';

const SKIN = 0xffe0bd;
const HAIR = 0x4e342e;

function drawCharacter(g, costume, gender) {
  const female = gender === 'female';

  // 몸통/하의
  if (costume === 'basic') {
    g.fillStyle(female ? 0xf48fb1 : 0x4fc3f7).fillRoundedRect(8, 20, 24, 24, 6);
  } else if (costume === 'uniform') {
    g.fillStyle(0xfafafa).fillRect(9, 20, 22, 14); // 흰 셔츠
    g.fillStyle(0x212121);
    if (female) {
      g.fillTriangle(8, 42, 20, 32, 32, 42).fillRect(12, 32, 16, 6); // 짧은 치마
      g.fillStyle(SKIN).fillRect(12, 42, 5, 2).fillRect(23, 42, 5, 2);
      g.fillStyle(0xd32f2f).fillTriangle(17, 20, 20, 25, 23, 20); // 리본
    } else {
      g.fillRect(10, 34, 20, 10); // 바지
      g.fillStyle(0x212121).fillRect(19, 20, 3, 10); // 넥타이
    }
  } else if (costume === 'swimsuit') {
    g.fillStyle(SKIN).fillRoundedRect(9, 20, 22, 24, 5);
    if (female) {
      g.fillStyle(0x26c6da).fillRect(10, 24, 20, 5).fillRect(11, 34, 18, 6);
    } else {
      g.fillStyle(0x1e88e5).fillRect(10, 33, 20, 9); // 반바지
    }
  }

  // 머리 (긴 머리는 뒤쪽=왼쪽으로 늘어뜨림)
  if (female) g.fillStyle(HAIR).fillRect(9, 8, 8, 18);
  g.fillStyle(SKIN).fillCircle(20, 12, 10);
  g.fillStyle(HAIR).fillEllipse(19, 5, 22, 10);
  g.fillStyle(0x222222).fillCircle(24, 11, 2); // 눈

  g.fillStyle(0x666666).fillRect(26, 28, 14, 5); // 총
  g.fillStyle(0x37474f).fillRect(11, 44, 7, 4).fillRect(22, 44, 7, 4); // 발
}

// 아트 에셋이 준비되기 전까지 쓸 임시 도형 텍스처를 한 번만 만든다.
// 재시작 시 GameScene만 다시 시작하므로 로딩이 발생하지 않는다.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    // 플레이어: 코스튬 × 성별 조합. 기본 방향은 오른쪽을 바라봄 (flipX로 왼쪽 전환)
    for (const costume of Object.keys(COSTUMES)) {
      for (const gender of Object.keys(GENDERS)) {
        drawCharacter(g, costume, gender);
        g.generateTexture(costumeTextureKey(costume, gender), 40, 48);
        g.clear();
      }
    }

    // 일반 적: 기본 방향은 왼쪽을 바라봄
    g.fillStyle(0xe53935).fillCircle(16, 16, 15);
    g.fillStyle(0xffffff).fillCircle(9, 12, 4).fillCircle(19, 12, 4);
    g.fillStyle(0x000000).fillCircle(8, 12, 2).fillCircle(18, 12, 2);
    g.generateTexture('enemy', 32, 32);
    g.clear();

    // 러너: 작고 빠른 주황색 적 (왼쪽을 바라봄)
    g.fillStyle(0xffa726).fillTriangle(0, 12, 24, 0, 24, 24);
    g.fillStyle(0xffffff).fillCircle(9, 10, 3);
    g.fillStyle(0x000000).fillCircle(8, 10, 1.5);
    g.generateTexture('enemy-runner', 24, 24);
    g.clear();

    // 탱커: 크고 느린 초록색 적 (왼쪽을 바라봄)
    g.fillStyle(0x2e7d32).fillRoundedRect(0, 0, 44, 44, 10);
    g.fillStyle(0x66bb6a).fillRoundedRect(4, 4, 36, 36, 8);
    g.fillStyle(0xffffff).fillCircle(12, 16, 5).fillCircle(26, 16, 5);
    g.fillStyle(0x000000).fillCircle(11, 16, 2.5).fillCircle(25, 16, 2.5);
    g.fillStyle(0x1b5e20).fillRect(10, 30, 20, 4);
    g.generateTexture('enemy-tank', 44, 44);
    g.clear();

    // 파티클용 작은 빛
    g.fillStyle(0xffffff).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.clear();

    // 준보스: 보라색, 뿔 두 개 (왼쪽을 바라봄)
    g.fillStyle(0x6a1b9a).fillTriangle(14, 14, 20, 0, 26, 12).fillTriangle(34, 12, 40, 0, 46, 14);
    g.fillStyle(0x8e24aa).fillCircle(30, 32, 27);
    g.fillStyle(0xffffff).fillCircle(18, 26, 7).fillCircle(36, 26, 7);
    g.fillStyle(0xffeb3b).fillCircle(16, 26, 4).fillCircle(34, 26, 4);
    g.fillStyle(0x000000).fillRect(16, 42, 22, 4);
    g.generateTexture('miniboss', 60, 60);
    g.clear();

    // 보스: 검붉은 몸에 왕관 (왼쪽을 바라봄)
    g.fillStyle(0xffc107).fillTriangle(24, 22, 30, 2, 38, 22).fillTriangle(40, 22, 48, 0, 56, 22)
      .fillTriangle(58, 22, 66, 2, 72, 22);
    g.fillStyle(0xb71c1c).fillCircle(48, 54, 42);
    g.fillStyle(0xffffff).fillCircle(30, 46, 10).fillCircle(58, 46, 10);
    g.fillStyle(0xff1744).fillCircle(27, 46, 6).fillCircle(55, 46, 6);
    g.fillStyle(0x000000).fillTriangle(24, 70, 64, 70, 44, 80);
    g.generateTexture('boss', 96, 96);
    g.clear();

    // 투사체: 모두 오른쪽(0 rad)을 향하게 그리고 발사 각도로 회전
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
    g.clear();

    // 보스 미사일: 붉은 테두리에 밝은 중심
    g.fillStyle(0xff1744).fillCircle(7, 7, 7);
    g.fillStyle(0xffcdd2).fillCircle(7, 7, 3);
    g.generateTexture('enemy-bullet', 14, 14);
    g.clear();

    // 경험치 오브: 청록색 마름모
    g.fillStyle(0x1de9b6).fillPoints([{ x: 5, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 5 }], true);
    g.fillStyle(0xffffff, 0.8).fillCircle(4, 4, 1.5);
    g.generateTexture('xp-orb', 10, 10);
    g.clear();

    g.destroy();
    generateSounds(this);
    this.scene.start('Title');
  }
}
