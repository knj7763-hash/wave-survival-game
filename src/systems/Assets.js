// 이미지 에셋. 원본은 public/assets에 있고, 로딩 후 투명 여백을 잘라내고 게임에서 쓸 크기로 미리 줄여
// 캔버스 텍스처로 만든다. 그래서 게임 코드는 setScale 없이 텍스처 크기 그대로 쓰면 된다.
// - 학생/좀비 (public/assets/school): 기본 포즈 + 걷기 그림(walk_a/b)이 있으면 진짜 걷기 애니메이션을 만들고,
//   없으면 (준보스/보스) 기본 포즈를 좌우로 기울인 프레임으로 뒤뚱거리게 한다. 피격·처치·공격 프레임은 기본 포즈의 색을 바꿔 만든다.
// - 아이콘/파티클/상점 코스튬 미리보기 (Kenney Platformer Pack, CC0)
import { COSTUMES, PLAYER_CHARACTERS, characterTextureKey } from '../shop/shopData.js';

const RAW = 'raw:';
const BASE = 'assets/';
const SCHOOL = 'school/';

// 적 종류별 그림과 표시 높이 (px). walk: 걷기 그림 [a, b]. filter: 같은 그림을 다른 종류로 구분하는 색 변환 (캔버스 filter 문법).
// 달리는 좀비/탱커 좀비는 전용 그림이 없어 기본 좀비(걷기 포함)를 작게·크게 줄이고 색을 바꿔 쓴다.
const ZOMBIE_WALK = ['enemy_zombie_basic_walk_a', 'enemy_zombie_basic_walk_b'];
const ENEMY_SPRITES = {
  enemy: { file: 'enemy_zombie_basic', walk: ZOMBIE_WALK, height: 64 },
  'enemy-runner': {
    file: 'enemy_zombie_basic', walk: ZOMBIE_WALK, height: 54, filter: 'hue-rotate(35deg) saturate(1.5) brightness(1.1)',
  },
  'enemy-tank': {
    file: 'enemy_zombie_basic', walk: ZOMBIE_WALK, height: 84, filter: 'sepia(0.5) brightness(0.7) contrast(1.2)',
  },
  miniboss: { file: 'enemy_zombie_subboss', height: 120 },
  boss: { file: 'enemy_zombie_boss', height: 150 },
};

const PLAYER_HEIGHT = 80;
const PLAYER_BIG_HEIGHT = 190; // 타이틀 화면용
const HEAD_RATIO = 0.42; // HUD 얼굴 아이콘: 그림 윗부분에서 잘라 쓰는 비율
const ALIGN_HEAD_RATIO = 0.3; // 걷기 프레임 가로 정렬 기준: 그림 윗부분(머리)의 가운데를 맞춘다

// 걷기 애니메이션: 기본 → a → 기본 → b. 실제 재생 속도는 WalkCycle이 이동 속도에 맞춰 timeScale로 조절한다.
export const WALK_BASE_FPS = 10;

// 기본 포즈로 만드는 파생 프레임. 이름 뒤에 붙는 접미사 → { 기울기(도), 색 변환 }
// 걷기 그림이 없는 준보스/보스는 발을 축으로 좌우로 번갈아 기울여 뒤뚱거리게 보이게 한다.
const WADDLE_DEG = 5;
const DERIVED = {
  tiltRight: { rotate: WADDLE_DEG },
  tiltLeft: { rotate: -WADDLE_DEG },
  hit: { filter: 'sepia(1) saturate(5) hue-rotate(-40deg) brightness(0.9)' },
  dead: { filter: 'grayscale(1) brightness(0.55)' },
  attack: { filter: 'drop-shadow(0 0 5px #ff1744) drop-shadow(0 0 3px #ff1744) saturate(1.3)' },
};
const PLAYER_FRAMES = { '-hit': DERIVED.hit };
const ENEMY_FRAMES = { '-dead': DERIVED.dead, '-attack': DERIVED.attack };
const WADDLE_FRAMES = { '-move': DERIVED.tiltRight, '-move2': DERIVED.tiltLeft };

// 배경이 투명하지 않은 그림: 가장자리에서 이어진 배경색 영역을 지울 때 허용하는 색 차이 (RGB 차이 합)
const BACKGROUND_TOLERANCE = 60;

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
  // 기본/달리는/탱커 좀비는 같은 그림을 쓰므로 한 번만 불러온다
  const files = new Set();
  for (const { file, walk = [] } of [...Object.values(PLAYER_CHARACTERS), ...Object.values(ENEMY_SPRITES)]) {
    files.add(file);
    walk.forEach((f) => files.add(f));
  }
  for (const file of files) img(file, `${SCHOOL}${file}.png`);
  for (const p of ['fireball', 'brickBrown', 'brickGrey']) img(p, `particles/${p}.png`);
  for (const h of ['hudCoin', 'hudHeart_full', 'hudHeart_half', 'hudHeart_empty']) img(h, `hud/${h}.png`);
  for (const i of ['gemBlue', 'gemYellow', 'star']) img(i, `items/${i}.png`);
  img('spikes', 'tiles/spikes.png');
  for (const { tile } of STAGE_GROUNDS) img(tile, `${SCHOOL}${tile}.png`);
}

// 로딩된 원본으로 게임용 텍스처와 애니메이션을 만든다
export function buildAssets(scene) {
  prepared.clear();
  for (const [id, { file, walk }] of Object.entries(PLAYER_CHARACTERS)) {
    const key = characterTextureKey(id);
    bakeCharacter(scene, key, file, PLAYER_HEIGHT, { derived: PLAYER_FRAMES, walk });
    bakeCharacter(scene, characterTextureKey(id, true), file, PLAYER_BIG_HEIGHT);
    bakeHead(scene, `hud-${key}`, file, 44);
  }
  for (const [id, { color }] of Object.entries(COSTUMES)) {
    bake(scene, [[`player-${id}-big`, `alien${color}_stand`]], COSTUME_BIG_BOX.w, COSTUME_BIG_BOX.h);
  }

  for (const [key, { file, walk, height, filter }] of Object.entries(ENEMY_SPRITES)) {
    const derived = walk ? ENEMY_FRAMES : { ...ENEMY_FRAMES, ...WADDLE_FRAMES };
    bakeCharacter(scene, key, file, height, { derived, walk, filter });
    if (!walk) {
      scene.anims.create({
        key: `${key}-walk`, frameRate: 5, repeat: -1, frames: [{ key: `${key}-move` }, { key: `${key}-move2` }],
      });
    }
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

// 캐릭터 그림을 height 높이로 줄여 key 텍스처(기본 포즈)로 만든다.
//   walk: [a, b] 걷기 그림 → `${key}-walk-a/-b` 프레임과 `${key}-walk` 애니메이션 (기본 → a → 기본 → b)
//   derived: 기본 포즈를 기울이거나 색을 바꾼 파생 프레임 (`${key}${접미사}`)
//   filter: 모든 프레임에 적용할 색 변환
// 모든 프레임을 같은 크기의 여백 있는 캔버스에 그리고, 발(그림 아래쪽)과 머리 가운데를 맞춰서 프레임이 바뀌어도
// 캐릭터가 흔들리거나 크기가 바뀌지 않게 한다. 기본 포즈가 차지하는 영역은 customData.body에 남겨 충돌 판정에 쓴다.
function bakeCharacter(scene, key, raw, height, { derived = {}, walk = null, filter: baseFilter = '' } = {}) {
  const fit = (rawKey) => {
    const { image, box, headCx } = prepare(scene, rawKey);
    const scale = height / box.h;
    const w = Math.max(1, Math.round(box.w * scale));
    return { art: downscale(image, box, w, height), w, headX: (headCx - box.x) * scale };
  };
  const base = fit(raw);
  const walkFrames = walk ? { '-walk-a': fit(walk[0]), '-walk-b': fit(walk[1]) } : {};

  // 머리 가운데를 캔버스 가운데에 둘 때 그림이 좌우로 가장 많이 튀어나오는 만큼 캔버스를 넓힌다
  const pad = Math.ceil(height * 0.1);
  const half = Math.max(...[base, ...Object.values(walkFrames)].map((f) => Math.max(f.headX, f.w - f.headX)));
  const canvasW = Math.ceil(half * 2) + pad * 2;
  const canvasH = height + pad * 2;
  const body = { x: Math.round(canvasW / 2 - base.headX), y: pad, w: base.w, h: height };

  const draw = (suffix, { art, w, headX }, { rotate = 0, filter = '' } = {}) => {
    const tex = scene.textures.createCanvas(key + suffix, canvasW, canvasH);
    const ctx = tex.getContext();
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = [baseFilter, filter].filter(Boolean).join(' ') || 'none';
    // 발 (아래쪽, 머리 가운데 아래)을 축으로 기울인다
    ctx.translate(canvasW / 2, pad + height);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(art, -headX, -height, w, height);
    tex.refresh();
    tex.customData.body = body;
  };

  draw('', base);
  for (const [suffix, frame] of Object.entries(walkFrames)) draw(suffix, frame);
  for (const [suffix, opts] of Object.entries(derived)) draw(suffix, base, opts);

  if (walk) {
    scene.anims.create({
      key: `${key}-walk`,
      frameRate: WALK_BASE_FPS,
      repeat: -1,
      frames: [{ key }, { key: `${key}-walk-a` }, { key }, { key: `${key}-walk-b` }],
    });
  }
}

// 원본 그림을 한 번만 분석해 둔다 (같은 그림을 여러 크기·색으로 굽는 경우가 많다).
// image: 배경이 투명하지 않으면 배경을 지운 캔버스, box: 불투명 영역, headCx: 머리(윗부분) 가로 가운데
const prepared = new Map();

function prepare(scene, raw) {
  if (!prepared.has(raw)) {
    const image = removeBackground(scene.textures.get(RAW + raw).getSourceImage());
    const box = opaqueBounds(image);
    prepared.set(raw, { image, box, headCx: opaqueCenterX(image, box, ALIGN_HEAD_RATIO) });
  }
  return prepared.get(raw);
}

// 네 모서리가 모두 불투명하면 배경이 칠해진 그림으로 보고, 가장자리에서 이어진 배경색 영역을 투명하게 만든다.
// (캐릭터 안쪽의 흰 셔츠 등은 검은 외곽선으로 막혀 있어 지워지지 않는다)
function removeBackground(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { width: w, height: h } = c;
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  if (corners.some((p) => data[p * 4 + 3] < 250)) return img; // 이미 투명 배경

  const bg = [0, 1, 2].map((ch) => corners.reduce((sum, p) => sum + data[p * 4 + ch], 0) / corners.length);
  const isBackground = (p) => Math.abs(data[p * 4] - bg[0]) + Math.abs(data[p * 4 + 1] - bg[1])
    + Math.abs(data[p * 4 + 2] - bg[2]) <= BACKGROUND_TOLERANCE;

  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (p) => {
    if (!visited[p] && isBackground(p)) {
      visited[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }

  // 외곽선 바깥쪽에 배경색이 섞인 경계 픽셀은 배경색에 가까울수록 투명하게 (흰 테두리가 남지 않게)
  const fringe = BACKGROUND_TOLERANCE * 3;
  for (let p = 0; p < w * h; p++) {
    if (visited[p]) continue;
    const x = p % w;
    const touchesBackground = (x > 0 && visited[p - 1]) || (x < w - 1 && visited[p + 1])
      || (p >= w && visited[p - w]) || (p < w * (h - 1) && visited[p + w]);
    if (!touchesBackground) continue;
    const dist = Math.abs(data[p * 4] - bg[0]) + Math.abs(data[p * 4 + 1] - bg[1]) + Math.abs(data[p * 4 + 2] - bg[2]);
    if (dist < fringe) data[p * 4 + 3] = Math.round((dist / fringe) * 255);
  }
  ctx.putImageData(imageData, 0, 0);
  return c;
}

// box 윗부분 ratio 높이 안의 불투명 픽셀 가로 범위의 가운데
function opaqueCenterX(img, box, ratio) {
  const rows = Math.max(1, Math.round(box.h * ratio));
  const c = document.createElement('canvas');
  c.width = box.w;
  c.height = rows;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, box.x, box.y, box.w, rows, 0, 0, box.w, rows);
  const { data } = ctx.getImageData(0, 0, box.w, rows);
  let x0 = box.w;
  let x1 = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < box.w; x++) {
      if (data[(y * box.w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
  }
  return x1 < 0 ? box.x + box.w / 2 : box.x + (x0 + x1 + 1) / 2;
}

// 캐릭터 그림의 윗부분 (얼굴)만 잘라 size×size 아이콘으로 만든다
function bakeHead(scene, key, raw, size) {
  const { image: src, box } = prepare(scene, raw);
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
