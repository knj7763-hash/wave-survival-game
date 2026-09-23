import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, SKILL_GAUGE } from '../config.js';

const SLOT = 64;
const GAP = 12;
const DEPTH = 10;
const SLOT_Y = GAME_HEIGHT - 58; // 슬롯 중심
const GAUGE_H = 10;

// 화면 하단 중앙: 공용 게이지 + 스킬 슬롯 3칸 + AUTO 버튼
export default class SkillBar {
  constructor(scene, skills, { onUse, onToggleAuto }) {
    this.scene = scene;
    this.skills = skills;
    const text = { fontFamily: FONT_FAMILY, color: '#ffffff' };

    const count = skills.skills.length;
    if (count === 0) {
      // 장착 스킬이 없으면 안내만 표시
      this.empty = true;
      scene.add.text(GAME_WIDTH / 2, SLOT_Y + 10, '장착한 스킬 없음 · 게임 종료 후 상점에서 구매', {
        ...text, fontSize: '14px', color: '#6b7488',
      }).setOrigin(0.5).setDepth(DEPTH);
      return;
    }
    const totalW = count * SLOT + (count - 1) * GAP;
    const left = GAME_WIDTH / 2 - totalW / 2;

    // 게이지
    const gaugeY = SLOT_Y - SLOT / 2 - 22;
    scene.add.rectangle(left, gaugeY, totalW, GAUGE_H, 0x000000, 0.6).setOrigin(0, 0.5).setDepth(DEPTH);
    this.gaugeFill = scene.add.rectangle(left + 2, gaugeY, 0, GAUGE_H - 4, 0xffa000).setOrigin(0, 0.5).setDepth(DEPTH);
    this.gaugeFullW = totalW - 4;
    this.gaugeLabel = scene.add.text(left - 8, gaugeY, 'SKILL', { ...text, fontSize: '13px', color: '#ffcc80' })
      .setOrigin(1, 0.5).setDepth(DEPTH);

    // 슬롯
    this.slots = skills.skills.map((skill, i) => {
      const x = left + SLOT / 2 + i * (SLOT + GAP);
      const bg = scene.add.rectangle(x, SLOT_Y, SLOT, SLOT, 0x1f2533, 0.9)
        .setStrokeStyle(3, 0x3d4658).setDepth(DEPTH).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => onUse(i));

      scene.add.circle(x, SLOT_Y - 6, 20, skill.data.color, 0.35).setDepth(DEPTH);
      scene.add.text(x, SLOT_Y - 6, skill.data.icon, { ...text, fontSize: '24px' }).setOrigin(0.5).setDepth(DEPTH);
      scene.add.text(x, SLOT_Y + 23, `${skill.data.name} Lv${skill.level}`, { ...text, fontSize: '10px', color: '#cfd6e4' })
        .setOrigin(0.5).setDepth(DEPTH);
      scene.add.text(x - SLOT / 2 + 5, SLOT_Y - SLOT / 2 + 3, `${i + 1}`, { ...text, fontSize: '12px', color: '#8a93a6' })
        .setDepth(DEPTH + 1);

      // 쿨타임: 위에서부터 줄어드는 어두운 덮개 + 남은 초
      const cover = scene.add.rectangle(x - SLOT / 2, SLOT_Y + SLOT / 2, SLOT, 0, 0x000000, 0.65)
        .setOrigin(0, 1).setDepth(DEPTH + 1);
      const cdText = scene.add.text(x, SLOT_Y - 4, '', {
        ...text, fontSize: '20px', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(DEPTH + 2);

      return { bg, cover, cdText };
    });

    // AUTO 버튼
    const autoX = left + totalW + GAP + 36;
    this.autoBtn = scene.add.rectangle(autoX, SLOT_Y, 64, 40, 0x1f2533, 0.9)
      .setStrokeStyle(3, 0x3d4658).setDepth(DEPTH).setInteractive({ useHandCursor: true });
    this.autoText = scene.add.text(autoX, SLOT_Y, 'AUTO', { ...text, fontSize: '16px' }).setOrigin(0.5).setDepth(DEPTH);
    this.autoBtn.on('pointerdown', onToggleAuto);
  }

  update(time) {
    if (this.empty) return;
    const { skills, gauge, isGaugeFull, autoMode } = this.skills;

    this.gaugeFill.width = this.gaugeFullW * (gauge / SKILL_GAUGE.max);
    const blink = Math.floor(time / 250) % 2 === 0;
    this.gaugeFill.fillColor = isGaugeFull ? (blink ? 0xffd54f : 0xffa000) : 0xffa000;
    this.gaugeLabel.setText(isGaugeFull ? 'READY' : 'SKILL');

    skills.forEach((skill, i) => {
      const slot = this.slots[i];
      if (slot.flashUntil > time) return; // 실패 피드백 표시 중

      const cdRatio = skill.cooldownRemaining / skill.data.cooldownMs;
      slot.cover.height = SLOT * cdRatio;
      slot.cdText.setText(skill.isReady ? '' : Math.ceil(skill.cooldownRemaining / 1000));

      if (skill.isActive) slot.bg.setStrokeStyle(3, skill.data.color);
      else if (skill.isReady && isGaugeFull) slot.bg.setStrokeStyle(3, blink ? 0xffd54f : 0xffa000);
      else slot.bg.setStrokeStyle(3, 0x3d4658);
    });

    this.autoBtn.setFillStyle(autoMode ? 0x2e7d32 : 0x1f2533, 0.9);
    this.autoBtn.setStrokeStyle(3, autoMode ? 0x69f0ae : 0x3d4658);
    this.autoText.setColor(autoMode ? '#ffffff' : '#8a93a6');
  }

  // 사용할 수 없을 때 슬롯을 붉게 깜빡인다
  flashDenied(slotIndex, time) {
    const slot = this.slots?.[slotIndex];
    if (!slot) return;
    slot.flashUntil = time + 200;
    slot.bg.setStrokeStyle(3, 0xff1744);
  }
}
