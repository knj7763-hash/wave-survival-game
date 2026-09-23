// 스킬 3종 데이터. levels[0..4] = 강화 1~5단계.
// price: 구매가 (구매 시 Lv1). upgradeCosts[n-1]: Lvn → Lvn+1 강화비 (Lv5가 최대라 마지막 값은 현재 미사용)

export const SKILLS = {
  fireBreath: {
    name: '화염 브레스',
    icon: '🔥',
    color: 0xff7043,
    desc: '상하좌우 4갈래로 화염을 뿜어 지속 피해',
    summary: (s) => `틱당 피해 ${s.damage} · ${s.durationMs / 1000}초`,
    cooldownMs: 15000,
    price: 300,
    upgradeCosts: [100, 150, 200, 250, 300],
    // durationMs 동안 tickMs마다 부채꼴(length, halfAngleDeg) 안의 적에게 damage
    levels: [
      { damage: 6, durationMs: 1500, tickMs: 150, length: 240, halfAngleDeg: 20 },
      { damage: 8, durationMs: 1600, tickMs: 150, length: 255, halfAngleDeg: 21 },
      { damage: 10, durationMs: 1700, tickMs: 150, length: 270, halfAngleDeg: 22 },
      { damage: 13, durationMs: 1850, tickMs: 150, length: 285, halfAngleDeg: 23 },
      { damage: 16, durationMs: 2000, tickMs: 150, length: 300, halfAngleDeg: 25 },
    ],
  },
  fireShield: {
    name: '화염 보호막',
    icon: '🛡️',
    color: 0xffb300,
    desc: '10초간 받는 피해 감소, 닿은 적에게 반사 피해',
    summary: (s) => `받는 피해 -${Math.round(s.reduction * 100)}% · 반사 ${s.reflect}`,
    cooldownMs: 15000,
    price: 250,
    upgradeCosts: [100, 150, 200, 250, 300],
    // reduction: 받는 피해 감소 비율, reflect: 접촉한 적에게 주는 피해 (적마다 reflectGapMs 간격)
    levels: [
      { durationMs: 10000, reduction: 0.3, reflect: 5, reflectGapMs: 400 },
      { durationMs: 10000, reduction: 0.35, reflect: 7, reflectGapMs: 400 },
      { durationMs: 10000, reduction: 0.4, reflect: 9, reflectGapMs: 400 },
      { durationMs: 10000, reduction: 0.45, reflect: 12, reflectGapMs: 400 },
      { durationMs: 10000, reduction: 0.5, reflect: 15, reflectGapMs: 400 },
    ],
  },
  thunderBreath: {
    name: '썬더 브레스',
    icon: '⚡',
    color: 0x64b5f6,
    desc: '대각선 4갈래로 화면 끝까지 번개, 맞은 적 기절',
    summary: (s) => `피해 ${s.damage}×${s.pulses} · 기절 ${s.stunMs / 1000}초`,
    cooldownMs: 15000,
    price: 300,
    upgradeCosts: [100, 150, 200, 250, 300],
    // pulses번 pulseGapMs 간격으로 번개. 맞은 일반 적은 stunMs 동안 멈춤 (보스 제외)
    levels: [
      { damage: 25, pulses: 3, pulseGapMs: 200, width: 26, stunMs: 1000 },
      { damage: 32, pulses: 3, pulseGapMs: 200, width: 28, stunMs: 1100 },
      { damage: 40, pulses: 3, pulseGapMs: 200, width: 30, stunMs: 1200 },
      { damage: 50, pulses: 4, pulseGapMs: 180, width: 32, stunMs: 1300 },
      { damage: 62, pulses: 4, pulseGapMs: 180, width: 36, stunMs: 1500 },
    ],
  },
};

export const MAX_EQUIPPED_SKILLS = 3;
