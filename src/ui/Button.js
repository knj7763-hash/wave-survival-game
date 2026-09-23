import { FONT_FAMILY } from '../config.js';
import { playSfx } from '../systems/Sound.js';

const COLORS = {
  primary: { fill: 0x2e7d32, stroke: 0x69f0ae },
  normal: { fill: 0x2a3142, stroke: 0x4a5468 },
  warn: { fill: 0x6d4c41, stroke: 0xffb74d },
  disabled: { fill: 0x1f2533, stroke: 0x2e3546 },
};

// 사각형 + 글자 버튼. enabled=false면 회색으로 표시되고 눌리지 않는다.
export function createButton(scene, x, y, w, h, label, onClick, {
  enabled = true, style = 'normal', fontSize = 18, depth = 0,
} = {}) {
  const palette = COLORS[enabled ? style : 'disabled'];
  const bg = scene.add.rectangle(0, 0, w, h, palette.fill).setStrokeStyle(2, palette.stroke);
  const text = scene.add.text(0, 0, label, {
    fontFamily: FONT_FAMILY, fontSize: `${fontSize}px`, color: enabled ? '#ffffff' : '#5f6878', align: 'center',
  }).setOrigin(0.5);
  const button = scene.add.container(x, y, [bg, text]).setDepth(depth);

  if (enabled) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffd54f));
    bg.on('pointerout', () => bg.setStrokeStyle(2, palette.stroke));
    bg.on('pointerdown', () => {
      playSfx(scene, 'click');
      onClick();
    });
  }
  return button;
}
