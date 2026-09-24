import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { groundKey, groundOf } from './Assets.js';

// 탑다운 패럴랙스 배경. 각 층은 화면 크기의 반복 무늬(TileSprite)를 화면에 고정해 두고,
// 카메라 위치 × factor만큼 무늬를 밀어서 스크롤한다. 상하좌우 어느 방향으로 움직여도 따라 흐른다.
//   factor 1   = 땅과 함께 움직임 (월드에 붙어 있는 바닥)
//   factor > 1 = 카메라에 더 가까운 층 (예: 형광등 불빛 얼룩, 더 빨리 흐름)
//   factor < 1 = 더 먼 층 (더 느리게 흐름)
// drift: 카메라와 상관없이 흘러가는 속도 (px/s), tileScale: 무늬 확대 배율
// 그래픽을 바꿀 때는 stageLayers의 층 목록만 고치면 된다. 지금은 바닥 한 층만 쓴다.
export function stageLayers(stage) {
  const ground = groundOf(stage);
  return [
    { key: groundKey(stage), factor: 1, tileScale: ground.tileScale, tint: ground.tint, depth: -10 },
  ];
}

export default class Parallax {
  constructor(scene, layers) {
    this.scene = scene;
    this.elapsedMs = 0;
    this.layers = layers.map((cfg) => ({
      cfg,
      sprite: scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, cfg.key)
        .setOrigin(0).setScrollFactor(0).setDepth(cfg.depth ?? -10)
        .setAlpha(cfg.alpha ?? 1).setTint(cfg.tint ?? 0xffffff)
        .setTileScale(cfg.tileScale ?? 1),
    }));
  }

  // 스테이지가 바뀌면 같은 구조의 층 목록으로 무늬만 교체한다
  setLayers(layers) {
    layers.forEach((cfg, i) => {
      const layer = this.layers[i];
      if (!layer) return;
      layer.cfg = cfg;
      layer.sprite.setTexture(cfg.key).setTint(cfg.tint ?? 0xffffff).setAlpha(cfg.alpha ?? 1)
        .setTileScale(cfg.tileScale ?? 1);
    });
  }

  update(delta) {
    this.elapsedMs += delta;
    const cam = this.scene.cameras.main;
    const t = this.elapsedMs / 1000;
    for (const { cfg, sprite } of this.layers) {
      const scale = cfg.tileScale ?? 1;
      // tilePosition은 무늬 원본 픽셀 단위라 확대 배율로 나눠야 화면 이동량과 맞는다
      sprite.tilePositionX = (cam.scrollX * cfg.factor + (cfg.drift?.x ?? 0) * t) / scale;
      sprite.tilePositionY = (cam.scrollY * cfg.factor + (cfg.drift?.y ?? 0) * t) / scale;
    }
  }
}
