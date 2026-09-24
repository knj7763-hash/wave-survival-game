// 이미지 에셋 (Kenney Platformer Pack, CC0). 원본은 public/assets에 있고,
// 로딩 후 투명 여백을 잘라내고 게임에서 쓸 크기로 미리 줄여 캔버스 텍스처로 만든다.
// 그래서 게임 코드는 setScale 없이 텍스처 크기 그대로 쓰면 된다 (충돌 반경 계산도 기존과 동일).
import { COSTUMES } from '../shop/shopData.js';

const RAW = 'raw:';
const BASE = 'assets/';

// 적 종류별 이미지: [기본, 이동, 처치] 원본과 맞출 상자 크기 (px)
const ENEMY_SPRITES = {
  enemy: { frames: ['slimeGreen', 'slimeGreen_move', 'slimeGreen_dead'], box: 40 },
  'enemy-runner': { frames: ['fly', 'fly_move', 'fly_dead'], box: 38 },
  'enemy-tank': { frames: ['slimeBlock', 'slimeBlock_move', 'slimeBlock_dead'], box: 52 },
  miniboss: { frames: ['barnacle', 'barnacle_attack', 'barnacle_dead'], box: 80 },
  boss: { frames: ['saw', 'saw_move', 'saw_dead'], box: 112 },
};

const PLAYER_FRAMES = ['stand', 'walk1', 'walk2', 'hit'];
const PLAYER_BOX = { w: 46, h: 64 };
const PLAYER_BIG_BOX = { w: 120, h: 170 }; // 타이틀/상점 미리보기용

// 스테이지별 배경 (스테이지 수보다 짧으면 마지막 배경을 계속 사용)
export const STAGE_BACKGROUNDS = ['colored_grass', 'colored_desert', 'colored_shroom', 'colored_land', 'blue_shroom'];

// 배경은 채도를 낮추고 어둡게 깔아서, 초록 슬라임/외계인 같은 캐릭터가 풀밭 배경에 묻히지 않게 한다
export const BACKGROUND_TINT = 0x7c8699;

export function backgroundKey(stage) {
  return `${RAW}bg-${STAGE_BACKGROUNDS[Math.min(stage, STAGE_BACKGROUNDS.length) - 1]}`;
}

export function preloadAssets(scene) {
  const img = (key, path) => scene.load.image(RAW + key, BASE + path);
  for (const { color } of Object.values(COSTUMES)) {
    for (const f of PLAYER_FRAMES) img(`alien${color}_${f}`, `players/alien${color}_${f}.png`);
    img(`hudPlayer_${color.toLowerCase()}`, `hud/hudPlayer_${color.toLowerCase()}.png`);
  }
  for (const { frames } of Object.values(ENEMY_SPRITES)) for (const f of frames) img(f, `enemies/${f}.png`);
  for (const p of ['fireball', 'brickBrown', 'brickGrey']) img(p, `particles/${p}.png`);
  for (const h of ['hudCoin', 'hudHeart_full', 'hudHeart_half', 'hudHeart_empty']) img(h, `hud/${h}.png`);
  for (const i of ['gemBlue', 'gemYellow', 'star']) img(i, `items/${i}.png`);
  img('spikes', 'tiles/spikes.png');
  for (const b of STAGE_BACKGROUNDS) img(`bg-${b}`, `backgrounds/${b}.png`);
}

// 로딩된 원본으로 게임용 텍스처와 애니메이션을 만든다
export function buildAssets(scene) {
  for (const [id, { color }] of Object.entries(COSTUMES)) {
    bake(scene, PLAYER_FRAMES.map((f) => [f === 'stand' ? `player-${id}` : `player-${id}-${f}`, `alien${color}_${f}`]),
      PLAYER_BOX.w, PLAYER_BOX.h);
    bake(scene, [[`player-${id}-big`, `alien${color}_stand`]], PLAYER_BIG_BOX.w, PLAYER_BIG_BOX.h);
    bake(scene, [[`hud-player-${id}`, `hudPlayer_${color.toLowerCase()}`]], 40, 40);
    scene.anims.create({
      key: `player-${id}-walk`, frameRate: 8, repeat: -1,
      frames: [{ key: `player-${id}-walk1` }, { key: `player-${id}-walk2` }],
    });
  }

  for (const [key, { frames: [idle, move, dead], box }] of Object.entries(ENEMY_SPRITES)) {
    bake(scene, [[key, idle], [`${key}-move`, move], [`${key}-dead`, dead]], box, box);
    scene.anims.create({ key: `${key}-walk`, frameRate: 5, repeat: -1, frames: [{ key }, { key: `${key}-move` }] });
  }

  bake(scene, [['enemy-bullet', 'fireball']], 18, 18);
  bake(scene, [['fx-fire', 'fireball']], 20, 20);
  bake(scene, [['fx-brick-brown', 'brickBrown']], 10, 10);
  bake(scene, [['fx-brick-grey', 'brickGrey']], 10, 10);
  bake(scene, [['fx-star', 'star']], 20, 20);
  bake(scene, [['fx-spikes', 'spikes']], 20, 20); // 가시 장판 (레벨업 효과)
  bake(scene, [['xp-orb', 'gemBlue']], 16, 16);
  bake(scene, [['xp-orb-big', 'gemYellow']], 24, 24);
  bake(scene, [['hud-coin', 'hudCoin']], 26, 26);
  bake(scene, [['hud-heart-full', 'hudHeart_full']], 24, 24);
  bake(scene, [['hud-heart-half', 'hudHeart_half']], 24, 24);
  bake(scene, [['hud-heart-empty', 'hudHeart_empty']], 24, 24);
}

// frames: [[새 키, 원본 키], ...]. 모든 프레임의 불투명 영역을 합친 범위로 똑같이 잘라서
// 애니메이션 중에 위치가 흔들리지 않게 하고, boxW×boxH 안에 들어가도록 비율을 유지해 줄인다.
function bake(scene, frames, boxW, boxH) {
  const sources = frames.map(([, raw]) => scene.textures.get(RAW + raw).getSourceImage());
  const box = sources.map(opaqueBounds).reduce(unionBounds);
  const scale = Math.min(boxW / box.w, boxH / box.h);
  const w = Math.max(1, Math.round(box.w * scale));
  const h = Math.max(1, Math.round(box.h * scale));

  frames.forEach(([key], i) => {
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(downscale(sources[i], box, w, h), 0, 0, w, h);
    tex.refresh();
  });
}

function opaqueBounds(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: img.width, h: img.height };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function unionBounds(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

// 한 번에 크게 줄이면 계단 현상이 생기므로 절반씩 여러 번 줄인다
function downscale(img, box, w, h) {
  let canvas = document.createElement('canvas');
  canvas.width = box.w;
  canvas.height = box.h;
  canvas.getContext('2d').drawImage(img, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);

  while (canvas.width / 2 >= w && canvas.height / 2 >= h) {
    const half = document.createElement('canvas');
    half.width = Math.round(canvas.width / 2);
    half.height = Math.round(canvas.height / 2);
    const ctx = half.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, half.width, half.height);
    canvas = half;
  }
  return canvas;
}
