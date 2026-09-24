// 이미지 에셋. 원본은 public/assets에 있고, 로딩 후 투명 여백을 잘라내고 게임에서 쓸 크기로 미리 줄여
// 캔버스 텍스처로 만든다. 그래서 게임 코드는 setScale 없이 텍스처 크기 그대로 쓰면 된다.
// - 학생/좀비 (public/assets/school): 한 장짜리 그림이라 걷기·피격·처치·공격 프레임은 기울이거나 색을 바꿔 만든다.
// - 아이콘/파티클/상점 코스튬 미리보기 (Kenney Platformer Pack, CC0)
import { COSTUMES, PLAYER_CHARACTERS, characterTextureKey } from '../shop/shopData.js';

const RAW = 'raw:';
const BASE = 'assets/';
const SCHOOL = 'school/';

// 적 종류별 그림과 표시 높이 (px). filter: 같은 그림을 다른 종류로 구분하는 색 변환 (캔버스 filter 문법).
// 달리는 좀비/탱커 좀비는 전용 그림이 없어 기본 좀비를 작게·크게 줄이고 색을 바꿔 쓴다.
const ENEMY_SPRITES = {
  enemy: { file: 'enemy_zombie_basic', height: 64 },
  'enemy-runner': { file: 'enemy_zombie_basic', height: 54, filter: 'hue-rotate(35deg) saturate(1.5) brightness(1.1)' },
  'enemy-tank': { file: 'enemy_zombie_basic', height: 84, filter: 'sepia(0.5) brightness(0.7) contrast(1.2)' },
  miniboss: { file: 'enemy_zombie_subboss', height: 120 },
  boss: { file: 'enemy_zombie_boss', height: 150 },
};

const PLAYER_HEIGHT = 80;
const PLAYER_BIG_HEIGHT = 190; // 타이틀 화면용
const HEAD_RATIO = 0.42; // HUD 얼굴 아이콘: 그림 윗부분에서 잘라 쓰는 비율

// 한 장짜리 그림으로 만드는 파생 프레임. 이름 뒤에 붙는 접미사 → { 기울기(도), 색 변환 }
// 걷기는 발을 축으로 좌우로 번갈아 기울여 뒤뚱거리게 보이게 한다.
const WADDLE_DEG = 5;
const DERIVED = {
  tiltRight: { rotate: WADDLE_DEG },
  tiltLeft: { rotate: -WADDLE_DEG },
  hit: { filter: 'sepia(1) saturate(5) hue-rotate(-40deg) brightness(0.9)' },
  dead: { filter: 'grayscale(1) brightness(0.55)' },
  attack: { filter: 'drop-shadow(0 0 5px #ff1744) drop-shadow(0 0 3px #ff1744) saturate(1.3)' },
};
const PLAYER_FRAMES = { '-walk1': DERIVED.tiltRight, '-walk2': DERIVED.tiltLeft, '-hit': DERIVED.hit };
const ENEMY_FRAMES = { '-move': DERIVED.tiltRight, '-move2': DERIVED.tiltLeft, '-dead': DERIVED.dead, '-attack': DERIVED.attack };

// 상점 코스튬 탭의 외계인 미리보기 (게임 속 캐릭터는 학생 그림)
const COSTUME_BIG_BOX = { w: 120, h: 170 };

// 스테이지별 탑다운 바닥 무늬 (이음새 없이 반복되는 타일). 패럴랙스 층 구성은 Parallax.js
// tileScale: 무늬 확대 배율, tint: 무늬에 곱할 색. 스테이지 수보다 짧으면 마지막 무늬를 계속 사용
export const STAGE_GROUNDS = [
  { tile: 'bg_floor_school_hallway', tileScale: 0.5, tint: 0xffffff },
];

export function groundOf(stage) {
  return STAGE_GROUNDS[Math.min(stage, STAGE_GROUNDS.length) - 1];
}

export function groundKey(stage) {
  return `${RAW}${groundOf(stage).tile}`;
}

export function preloadAssets(scene) {
  const img = (key, path) => scene.load.image(RAW + key, BASE + path);
  for (const { color } of Object.values(COSTUMES)) img(`alien${color}_stand`, `players/alien${color}_stand.png`);
  for (const { file } of Object.values(PLAYER_CHARACTERS)) img(file, `${SCHOOL}${file}.png`);
  // 기본/달리는/탱커 좀비는 같은 그림을 쓰므로 한 번만 불러온다
  for (const file of new Set(Object.values(ENEMY_SPRITES).map((s) => s.file))) img(file, `${SCHOOL}${file}.png`);
  for (const p of ['fireball', 'brickBrown', 'brickGrey']) img(p, `particles/${p}.png`);
  for (const h of ['hudCoin', 'hudHeart_full', 'hudHeart_half', 'hudHeart_empty']) img(h, `hud/${h}.png`);
  for (const i of ['gemBlue', 'gemYellow', 'star']) img(i, `items/${i}.png`);
  img('spikes', 'tiles/spikes.png');
  for (const { tile } of STAGE_GROUNDS) img(tile, `${SCHOOL}${tile}.png`);
}

// 로딩된 원본으로 게임용 텍스처와 애니메이션을 만든다
export function buildAssets(scene) {
  for (const [id, { file }] of Object.entries(PLAYER_CHARACTERS)) {
    const key = characterTextureKey(id);
    bakeCharacter(scene, key, file, PLAYER_HEIGHT, PLAYER_FRAMES);
    bakeCharacter(scene, characterTextureKey(id, true), file, PLAYER_BIG_HEIGHT);
    bakeHead(scene, `hud-${key}`, file, 44);
    scene.anims.create({
      key: `${key}-walk`, frameRate: 7, repeat: -1, frames: [{ key: `${key}-walk1` }, { key: `${key}-walk2` }],
    });
  }
  for (const [id, { color }] of Object.entries(COSTUMES)) {
    bake(scene, [[`player-${id}-big`, `alien${color}_stand`]], COSTUME_BIG_BOX.w, COSTUME_BIG_BOX.h);
  }

  for (const [key, { file, height, filter }] of Object.entries(ENEMY_SPRITES)) {
    bakeCharacter(scene, key, file, height, ENEMY_FRAMES, filter);
    scene.anims.create({
      key: `${key}-walk`, frameRate: 5, repeat: -1, frames: [{ key: `${key}-move` }, { key: `${key}-move2` }],
    });
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

// 한 장짜리 캐릭터 그림을 height 높이로 줄여 key 텍스처로 만들고, frames의 파생 프레임(`${key}${접미사}`)도 만든다.
// 기울인 프레임이 잘리지 않도록 모든 프레임을 같은 크기의 여백 있는 캔버스에 그린다 (애니메이션 중 위치 흔들림 없음).
// 그림이 실제로 차지하는 영역은 텍스처 customData.body에 남겨서 충돌 판정 크기를 맞출 때 쓴다.
function bakeCharacter(scene, key, raw, height, frames = {}, baseFilter = '') {
  const src = scene.textures.get(RAW + raw).getSourceImage();
  const box = opaqueBounds(src);
  const scale = height / box.h;
  const w = Math.max(1, Math.round(box.w * scale));
  const h = Math.max(1, Math.round(box.h * scale));
  const pad = Math.ceil(h * 0.1);
  const canvasW = w + pad * 2;
  const canvasH = h + pad * 2;
  const art = downscale(src, box, w, h);

  for (const [suffix, { rotate = 0, filter = '' }] of Object.entries({ '': {}, ...frames })) {
    const tex = scene.textures.createCanvas(key + suffix, canvasW, canvasH);
    const ctx = tex.getContext();
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = [baseFilter, filter].filter(Boolean).join(' ') || 'none';
    // 발 (아래쪽 가운데)을 축으로 기울인다
    ctx.translate(canvasW / 2, pad + h);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(art, -w / 2, -h, w, h);
    tex.refresh();
    tex.customData.body = { x: pad, y: pad, w, h };
  }
}

// 캐릭터 그림의 윗부분 (얼굴)만 잘라 size×size 아이콘으로 만든다
function bakeHead(scene, key, raw, size) {
  const src = scene.textures.get(RAW + raw).getSourceImage();
  const box = opaqueBounds(src);
  const head = { x: box.x, y: box.y, w: box.w, h: Math.round(box.h * HEAD_RATIO) };
  const scale = Math.min(size / head.w, size / head.h);
  const w = Math.max(1, Math.round(head.w * scale));
  const h = Math.max(1, Math.round(head.h * scale));
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(downscale(src, head, w, h), 0, 0, w, h);
  tex.refresh();
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
