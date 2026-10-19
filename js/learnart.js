// Illustrations for the "Учебник" (top views unless noted). Plain SVG strings, no external assets.

const WIND = '#4fc3f7', A = '#ffb020', B = '#4a8dff', OK = '#34e27a', TXT = '#eaf3fb', MUTED = '#7e98b0', WARN = '#ff7a6b';
const svg = (w, h, body, label = '') => `<svg class="lsvg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 12}" fill="${o.fill || TXT}" text-anchor="${o.anchor || 'start'}"${o.bold ? ' font-weight="700"' : ''}>${s}</text>`;
const arrow = (x1, y1, x2, y2, c = WIND, w = 3) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 9;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`
    + `<path d="M${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} L${x2},${y2} L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
};
const wind = (x = 22, y = 8) => arrow(x, y, x, y + 40) + t(x + 8, y + 14, 'ветер', { fill: WIND });
// Boat from above; `rel` = wind angle on the bow (+ starboard tack). Sail curve to leeward.
function boat(x, y, hdg, color = B, rel = null, sail = true) {
  const r = rel ?? 0;
  const ang = Math.abs(r) < 60 ? 12 : Math.abs(r) < 120 ? 45 : 78;
  const side = r >= 0 ? -1 : 1;
  const ex = side * Math.sin(ang * Math.PI / 180) * 19, ey = -3 + Math.cos(ang * Math.PI / 180) * 19;
  return `<g transform="translate(${x},${y}) rotate(${hdg})"><path d="M0,-20 C8,-12 9,6 6,18 L-6,18 C-9,6 -8,-12 0,-20 Z" fill="${color}" stroke="#0b1622" stroke-width="1.2"/>`
    + (sail ? `<path d="M0,-3 Q${(ex / 2 + side * 5).toFixed(1)},${(ey / 2).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>` : '') + '</g>';
}
const mark = (x, y, c = '#ff7a1a') => `<circle cx="${x}" cy="${y}" r="7" fill="${c}" stroke="#fff" stroke-width="2"/>`;
const path = (d, c = MUTED, w = 2, dash = '5 4') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-dasharray="${dash}"/>`;

export const ART = {
  // How sail + keel make the boat go forward.
  force: svg(360, 250, `${wind()}
    ${boat(180, 140, -40, B, 40)}
    ${arrow(180, 140, 230, 92, OK, 3)}${t(232, 90, 'тяга паруса', { fill: OK })}
    ${arrow(180, 140, 128, 156, A, 3)}${t(36, 176, 'сопротивление киля', { fill: A })}
    ${arrow(180, 140, 158, 82, '#fff', 3.5)}${t(118, 70, 'итог: вперёд', { bold: true })}
    `, 'Силы на парусе и киле'),

  // Up and down the course in tacks and gybes.
  zigzag: svg(360, 330, `${wind()}
    <line x1="120" y1="300" x2="240" y2="300" stroke="#ffb020" stroke-width="3"/>${t(250, 304, 'старт / финиш', { fill: '#ffb020' })}
    ${mark(180, 40)}${t(192, 44, 'наветренный знак')}${mark(165, 268)}${mark(195, 268)}${t(205, 272, 'ворота')}
    ${path('M175,298 L120,236 L205,154 L150,96 L180,48', B, 2.4, '')}
    ${path('M188,48 L250,120 L170,190 L225,262 L198,268', A, 2.4, '6 4')}
    ${t(60, 180, 'вверх: зигзаг', { fill: B, bold: true })}${t(60, 196, 'поворотами', { fill: B })}${t(60, 210, 'оверштаг', { fill: B })}
    ${t(262, 180, 'вниз: тоже', { fill: A, bold: true })}${t(262, 196, 'галсами, через', { fill: A })}${t(262, 210, 'фордевинды', { fill: A })}
    `, 'Лавировка галсами вверх и вниз'),

  // Heel and the crew on the rail (view from astern).
  heel: svg(360, 240, `${arrow(30, 70, 110, 70)}${t(30, 60, 'ветер', { fill: WIND })}
    <g transform="translate(200,170) rotate(18)">
      <path d="M-60,-10 L60,-10 L54,18 C30,34 -30,34 -54,18 Z" fill="#e9eef3" stroke="#8ea6b9"/>
      <rect x="-3" y="-150" width="6" height="140" fill="#c3ced7"/><path d="M0,-150 Q40,-90 4,-12" fill="none" stroke="#fff" stroke-width="3"/>
      <rect x="-3" y="18" width="6" height="45" fill="#162f46"/><ellipse cx="0" cy="66" rx="12" ry="6" fill="#162f46"/>
    </g>
    ${[0, 1, 2].map((i) => `<circle cx="${132 + i * 12}" cy="${150 - i * 4}" r="6" fill="${A}"/>`).join('')}
    ${t(70, 128, 'экипаж на наветренном', { fill: A })}${t(70, 142, 'борту — меньше крен', { fill: A })}
    ${t(250, 230, 'киль с бульбом выпрямляет яхту', { anchor: 'middle', size: 11, fill: MUTED })}`, 'Крен и откренка'),

  // True + boat speed = apparent wind: head-to-tail vector sum.
  apparent: svg(360, 250, `
    ${boat(300, 175, 0, B, 90)}${arrow(300, 140, 300, 92, '#fff', 2.5)}${t(312, 112, 'ход яхты', { size: 11 })}
    ${arrow(250, 60, 140, 60, WIND, 3)}${t(195, 50, 'истинный ветер', { anchor: 'middle', fill: WIND })}
    ${arrow(140, 60, 140, 160, MUTED, 3)}${t(132, 105, 'встречный', { anchor: 'end', fill: MUTED })}${t(132, 119, 'от хода', { anchor: 'end', fill: MUTED })}
    ${arrow(250, 60, 140, 160, OK, 3.5)}${t(205, 128, 'вымпельный', { fill: OK, bold: true })}
    <circle cx="250" cy="60" r="3" fill="${TXT}"/>
    ${t(20, 200, 'вымпельный = истинный + встречный', { bold: true })}
    ${t(20, 218, 'дует острее (больше с носа) и сильнее истинного', { size: 11, fill: MUTED })}`, 'Сложение истинного и встречного ветра'),

  // Telltales on the jib luff.
  telltales: svg(360, 190, ['Правильно', 'Слишком остро', 'Слишком полно'].map((name, i) => {
    const x = 20 + i * 115;
    const ww = i === 1 ? 'M0,0 q8,-10 2,-20' : 'M0,0 q14,2 28,0';
    const lw = i === 2 ? 'M0,0 q8,10 2,20' : 'M0,0 q14,-2 28,0';
    return `<rect x="${x}" y="30" width="100" height="120" rx="8" fill="#0f2133" stroke="#1d3650"/>`
      + `<path d="M${x + 40},40 L${x + 40},140" stroke="#eef3f7" stroke-width="4"/>`
      + `<g transform="translate(${x + 42},80)"><path d="${ww}" fill="none" stroke="#ff4f4f" stroke-width="2.5"/></g>`
      + `<g transform="translate(${x + 42},100)"><path d="${lw}" fill="none" stroke="#34e27a" stroke-width="2.5"/></g>`
      + t(x + 50, 22, name, { anchor: 'middle', bold: true, fill: i ? WARN : OK });
  }).join('') + t(180, 178, 'красный — наветренный колдунчик, зелёный — подветренный', { anchor: 'middle', size: 11, fill: MUTED }), 'Колдунчики'),

  // Lift and header.
  shifts: svg(360, 230, `
    ${t(90, 18, 'Левый галс: подъём', { anchor: 'middle', bold: true, fill: OK })}${arrow(70, 30, 82, 74, WIND)}
    ${boat(90, 160, 25, B, -40)}${path('M90,160 L130,80', OK, 2)}${t(90, 210, 'можно идти острее —', { anchor: 'middle', size: 11, fill: MUTED })}${t(90, 223, 'ближе к знаку', { anchor: 'middle', size: 11, fill: MUTED })}
    ${t(270, 18, 'Правый галс: отход', { anchor: 'middle', bold: true, fill: WARN })}${arrow(250, 30, 262, 74, WIND)}
    ${boat(270, 160, -60, B, 40)}${path('M270,160 L222,128', WARN, 2)}${t(270, 210, 'приходится уваливаться —', { anchor: 'middle', size: 11, fill: MUTED })}${t(270, 223, 'пора поворачивать на левый', { anchor: 'middle', size: 11, fill: MUTED })}`, 'Подъём и отход ветра'),

  // Course types.
  courses: svg(360, 260, `${wind(10, 8)}
    ${t(95, 20, 'Наветренно-подветренная', { anchor: 'middle', bold: true })}
    ${mark(95, 50)}${mark(115, 60, '#ffd27a')}${mark(85, 205)}${mark(105, 205)}
    <line x1="55" y1="230" x2="135" y2="230" stroke="#ffb020" stroke-width="3"/>
    ${path('M95,228 L95,58 M108,62 L95,200', B, 1.8)}${t(122, 62, 'отбойник', { size: 10 })}${t(118, 208, 'ворота', { size: 10 })}
    ${t(270, 20, 'Треугольник', { anchor: 'middle', bold: true })}
    ${mark(270, 50)}${mark(210, 140)}${mark(270, 205)}<line x1="230" y1="230" x2="310" y2="230" stroke="#ffb020" stroke-width="3"/>
    ${path('M270,228 L270,58 L216,136 L268,200 L270,58', B, 1.8)}${t(278, 54, '1', { bold: true })}${t(196, 144, '2', { bold: true })}${t(278, 210, '3', { bold: true })}
    `, 'Виды дистанций'),

  // Crew positions on deck.
  crew: svg(360, 250, `
    <path d="M330,125 C300,70 240,52 150,52 L30,58 L30,192 L150,198 C240,198 300,180 330,125 Z" fill="#e9eef3" stroke="#8ea6b9"/>
    <rect x="150" y="98" width="110" height="54" rx="10" fill="#d7dee5"/><circle cx="235" cy="125" r="6" fill="#9db4c6"/>
    ${[[310, 125, '1'], [242, 108, '2'], [150, 125, '3'], [110, 70, '4'], [110, 180, '5'], [80, 125, '6'], [50, 95, '7'], [50, 155, '8']].map(([x, y, n]) => `<circle cx="${x}" cy="${y}" r="11" fill="${A}"/>${t(x, y + 4, n, { anchor: 'middle', bold: true, fill: '#1a1000' })}`).join('')}
    ${t(180, 225, '1 баковый · 2 мачтовый · 3 пианист · 4–5 шкотовые', { anchor: 'middle', size: 11 })}${t(180, 240, '6 гротовый · 7 рулевой · 8 тактик', { anchor: 'middle', size: 11 })}
    ${t(330, 50, 'нос', { anchor: 'end', size: 10, fill: MUTED })}${t(32, 50, 'корма', { size: 10, fill: MUTED })}`, 'Места экипажа'),

  // Start line bias.
  bias: svg(360, 230, `${arrow(260, 10, 238, 55)}${t(266, 24, 'ветер', { fill: WIND })}
    <line x1="60" y1="150" x2="300" y2="120" stroke="#ffb020" stroke-width="3"/>
    <circle cx="60" cy="150" r="8" fill="#ffb020" stroke="#fff" stroke-width="2"/>${t(40, 175, 'пин')}
    <rect x="292" y="111" width="18" height="18" fill="#4fc3f7" stroke="#fff" stroke-width="2"/>${t(282, 150, 'комитет')}
    ${path('M300,120 L265,40', OK, 2)}${path('M60,150 L40,96', MUTED, 1.5)}
    
    ${t(250, 80, 'выгодный конец', { fill: OK, bold: true })}`, 'Перекос стартовой линии'),

  // Wide in, tight out.
  rounding: svg(360, 230, `${wind()}${mark(180, 70)}
    ${path('M90,210 C120,120 140,80 170,64 C190,58 200,70 205,90 C210,130 230,190 250,215', B, 2.6, '')}
    ${path('M110,210 C150,130 160,90 170,78', WARN, 2, '4 4')}
    ${t(60, 140, 'широко зайти', { fill: B, bold: true })}${t(225, 140, 'узко выйти', { fill: B, bold: true })}
    ${t(100, 225, 'плохо: впритык к знаку и выход наружу', { size: 11, fill: WARN })}`, 'Огибание знака'),

  // Two-turns penalty.
  penalty: svg(360, 220, `${wind()}
    ${path('M40,180 L120,140 C150,125 170,100 150,80 C130,60 105,85 120,110 C135,135 170,120 175,100 C180,80 160,62 140,70 C125,78 130,105 160,112 L300,90', A, 2.6, '')}
    ${t(200, 60, 'два полных оборота:', { fill: A, bold: true })}${t(200, 76, '2 оверштага + 2 фордевинда', { fill: A })}
    `, 'Штрафные обороты'),

  // Man overboard: quick stop.
  mob: svg(360, 240, `${wind()}
    <circle cx="150" cy="120" r="7" fill="#ff4f4f"/>${t(122, 108, 'человек', { fill: '#ff8a8a' })}
    ${path('M80,200 L150,135 C190,95 250,90 260,130 C268,170 220,200 190,170 C170,150 160,138 156,128', B, 2.6, '')}
    ${t(250, 80, '1 крик, показывать рукой', { size: 11 })}${t(250, 96, '2 круг за борт', { size: 11 })}${t(250, 112, '3 поворот, сразу к нему', { size: 11 })}${t(250, 128, '4 подход против ветра', { size: 11 })}
    `, 'Человек за бортом'),
};

// Knot sketches (rope = thick light stroke with dark edge).
const rope = (d) => `<path d="${d}" fill="none" stroke="#3b2f1a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#e8d9a8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
export const KNOT_ART = {
  'Восьмёрка': svg(200, 120, rope('M10,60 L60,60 C95,60 100,20 75,20 C50,20 55,95 90,95 C120,95 120,60 150,60 L190,60')),
  'Булинь': svg(200, 120, rope('M10,30 L100,30 C120,30 125,50 110,58 C95,66 85,50 98,42 L120,42 C150,42 160,110 110,110 C70,110 60,70 100,60')),
  'Выбленочный': svg(200, 120, `<rect x="0" y="50" width="200" height="12" rx="6" fill="#9db4c6"/>` + rope('M40,110 L70,40 C75,30 90,30 92,45 L95,75 M95,75 C98,90 115,90 118,75 L122,45 C124,30 140,30 144,40 L170,110')),
  'Прямой': svg(200, 120, rope('M10,40 L80,40 C110,40 115,80 90,80 C70,80 80,40 110,40 L190,40') + rope('M10,80 L80,80 C110,80 115,40 90,40')),
  'Шкотовый': svg(200, 120, `${rope('M190,40 L90,40 C50,40 50,90 90,90 L190,90')}${rope('M10,65 L70,65 C110,65 110,30 95,30 C80,30 82,65 120,62')}`),
  'На утке': svg(200, 120, `<path d="M40,60 L160,60 M70,60 L70,75 M130,60 L130,75" stroke="#9db4c6" stroke-width="10" stroke-linecap="round"/>` + rope('M10,95 L70,70 C110,50 150,50 160,62 C170,75 60,80 50,62 C40,48 150,45 160,60 L190,40')),
  'Два полуштыка с оборотом': svg(200, 120, `<circle cx="40" cy="60" r="22" fill="none" stroke="#9db4c6" stroke-width="7"/>` + rope('M190,60 L80,60 C40,60 30,40 40,38 C55,36 60,78 45,82 C30,86 40,62 90,62 C110,62 110,80 120,62 C130,44 140,80 150,62')),
  'Бухта троса': svg(200, 120, [0, 1, 2, 3].map((i) => rope(`M100,${20 + i * 3} C${150 + i * 4},${20 + i * 3} ${150 + i * 4},${100 - i * 3} 100,${100 - i * 3} C${50 - i * 4},${100 - i * 3} ${50 - i * 4},${20 + i * 3} 100,${20 + i * 3}`)).join('')),
};
