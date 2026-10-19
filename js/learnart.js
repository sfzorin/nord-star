// Illustrations for the "Учебник" (top views unless noted). Plain SVG strings, no external assets.

import { C, svg, text as t, arrow, wind as kWind, buoy, boatTop, route as path, pill, at, rnd, tick } from './learnkit.js?v=8';

const { WIND, OK, TXT, MUTED, WARN } = C, A = C.GIVE, B = C.RIGHT;
const wind = (x = 22, y = 8) => kWind(x + 8, y + 6, 180, 36);
const boat = (x, y, hdg, color = B, rel = null, sail = true, scale, gennaker) => boatTop(x, y, hdg, color, rel ?? 0, { noSail: sail === false, scale, gennaker });
const mark = (x, y) => buoy(x, y);
void TXT;

export const ART = {
  // How sail + keel make the boat go forward: sail force forward-to-leeward, keel force to windward, sum = ahead.
  force: (() => {
    const bx = 205, by = 165, h = -40;                    // starboard tack, wind from the top
    const sail = at(bx, by, h - 72, 78), keel = at(bx, by, h + 90, 66);
    const sum = [bx + (sail[0] - bx) + (keel[0] - bx), by + (sail[1] - by) + (keel[1] - by)];
    const ahead = at(bx, by, h, 70);
    return svg(360, 280, `${wind(22, 6)}
      ${boat(bx, by, h, B, 40)}
      ${arrow(bx, by, sail[0], sail[1], OK, 3)}${pill(sail[0] - 4, sail[1] + 26, 'тяга паруса', OK)}
      ${arrow(bx, by, keel[0], keel[1], A, 3)}${pill(keel[0] + 6, keel[1] - 14, 'упор киля', A)}
      ${path(`M${sail[0]},${sail[1]} L${sum[0]},${sum[1]} L${keel[0]},${keel[1]}`, MUTED, 1.2, '3 4')}
      ${arrow(bx, by, ahead[0], ahead[1], '#fff', 3.5)}${pill(ahead[0] - 22, ahead[1] - 14, 'итог: ход вперёд', TXT)}`, 'Силы на парусе и киле');
  })(),

  // Up and down the course in tacks and gybes.
  zigzag: (() => {
    const w = rnd([262, 128], [200, 50], [110, 130], 'p', 16), g = rnd([186, 210], [230, 250], [274, 196], 'p', 14);
    return svg(360, 360, `${wind()}
    <line x1="110" y1="322" x2="250" y2="322" stroke="#ffb020" stroke-width="2.4" stroke-dasharray="7 5"/>
    ${buoy(110, 322)}<rect x="241" y="313" width="18" height="18" rx="3" fill="#4fc3f7" stroke="#fff" stroke-width="1.6"/>
    ${pill(180, 350, 'линия старта', '#ffb020')}
    <line x1="150" y1="250" x2="230" y2="250" stroke="${TXT}" stroke-width="1.2" stroke-dasharray="3 4" opacity="0.7"/>
    ${mark(150, 250)}${mark(230, 250)}${pill(180, 286, 'ворота', TXT)}
    ${mark(200, 50)}${pill(222, 54, 'наветренный знак', TXT, 'start')}
    ${path(`M180,318 L100,236 L262,128 L${w.a} ${w.arc}`, B, 2.6, '')}
    ${tick(180, 318, 100, 236, B)}${tick(100, 236, 262, 128, B)}${tick(262, 128, 214, 66, B)}
    ${path(`M${w.b} L110,130 L186,210 L${g.a} ${g.arc} L274,196`, A, 2.6, '7 5')}
    ${tick(186, 62, 110, 130, A)}${tick(110, 130, 186, 210, A)}${tick(258, 214, 274, 196, A)}
    ${boat(200, 169, 56, B, -45, true, 0.7)}${boat(130, 151, 136, A, -136, true, 0.7)}
    ${pill(8, 300, 'вверх: галсами', B, 'start')}${pill(8, 186, 'вниз: фордевинды', A, 'start')}
    ${pill(282, 192, '2-й круг', A, 'start', 11)}`, 'Лавировка галсами вверх и вниз');
  })(),


  // Heel and the crew on the rail (view from astern).
  heel: svg(360, 260, `${arrow(24, 80, 104, 80)}${pill(64, 66, 'ветер', WIND, 'middle', 11)}
    <g transform="translate(230,150) rotate(18)">
      <path d="M-60,-10 L60,-10 L54,18 C30,34 -30,34 -54,18 Z" fill="#e9eef3" stroke="#8ea6b9"/>
      <rect x="-3" y="-140" width="6" height="130" fill="#c3ced7"/><path d="M0,-140 Q40,-80 4,-12" fill="#f4f7fa" stroke="#9fb3c4"/>
      <rect x="-3" y="18" width="6" height="45" fill="#5b7fa3" stroke="#a9c8e6"/><ellipse cx="0" cy="66" rx="13" ry="7" fill="#5b7fa3" stroke="#a9c8e6"/>
    </g>
    ${[0, 1, 2].map((i) => `<circle cx="${176 + i * 11}" cy="${124 - i * 3.5}" r="5.5" fill="${A}" stroke="#061422"/>`).join('')}
    ${pill(6, 120, 'откренка: экипаж', A, 'start', 11)}${pill(6, 142, 'на наветренном борту', A, 'start', 11)}
    ${pill(344, 248, 'бульб выпрямляет', TXT, 'end')}`, 'Крен и откренка'),

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

  // Windward-leeward course, numbered marks.
  wl: svg(360, 360, `${wind(22, 6)}
    <line x1="112" y1="320" x2="248" y2="320" stroke="#ffb020" stroke-width="3"/>
    ${buoy(112, 320)}<rect x="240" y="311" width="18" height="18" rx="3" fill="#4fc3f7" stroke="#fff" stroke-width="1.6"/>
    ${pill(180, 346, 'старт и финиш', '#ffb020')}
    ${mark(180, 54)}${pill(198, 58, '1 наветренный', TXT, 'start')}
    ${mark(130, 66)}${pill(130, 30, '1A отбойник', TXT)}
    ${mark(160, 268)}${mark(200, 268)}${pill(214, 290, '4S / 4P ворота', TXT, 'start')}
    ${(() => { const w = rnd([236, 150], [180, 54], [130, 66], 'p', 14), o = rnd([180, 54], [130, 66], [96, 140], 'p', 13), g = rnd([182, 206], [200, 268], [240, 236], 'p', 14);
      return path(`M150,318 L100,240 L236,150 L${w.a} ${w.arc} L${o.a} ${o.arc}`, B, 2.4, '') + path(`M${o.b} L96,140 L182,206 L${g.a} ${g.arc} L240,236`, A, 2.4, '7 5')
        + tick(150, 318, 100, 240, B) + tick(100, 240, 236, 150, B) + tick(236, 150, 194, 76, B) + tick(96, 140, 182, 206, A) + tick(225, 251, 240, 236, A); })()}
    ${boat(125, 279, -33, B, 40, true, 0.7)}${boat(130, 220, 56, B, -45, true, 0.7)}${boat(214, 112, -30, B, 40, true, 0.7)}${boat(140, 173, 128, A, -128, true, 0.7)}
    ${pill(8, 290, 'вверх галсами', B, 'start')}${pill(352, 200, 'вниз галсами', A, 'end')}`, 'Наветренно-подветренная дистанция'),

  // Triangle course.
  triangle: svg(360, 320, `${wind(22, 6)}
    ${mark(190, 50)}${mark(80, 160)}${mark(190, 250)}
    <line x1="140" y1="288" x2="240" y2="288" stroke="#ffb020" stroke-width="3"/>${pill(190, 312, 'старт и финиш', '#ffb020')}
    ${(() => { const m1 = rnd([190, 286], [190, 50], [80, 160], 'p', 15), m2 = rnd([190, 50], [80, 160], [190, 250], 'p', 15), m3 = rnd([80, 160], [190, 250], [206, 90], 'p', 15);
      return path(`M190,286 L${m1.a} ${m1.arc}`, B, 2.4, '') + path(`M${m1.b} L${m2.a} ${m2.arc} L${m3.a}`, A, 2.4, '7 5') + path(`M${m3.a} ${m3.arc} L216,96`, B, 2.4, '')
        + tick(190, 286, 204, 60, B) + tick(180, 66, 90, 150, A) + tick(90, 170, 180, 240, A); })()}
    ${pill(206, 46, '1', TXT, 'start')}${pill(60, 164, '2', TXT, 'end')}${pill(206, 262, '3', TXT, 'start')}
    ${pill(320, 160, 'вверх', B, 'end')}${pill(96, 96, 'бакштаг', A, 'end')}${pill(112, 232, 'бакштаг', A, 'end')}`, 'Треугольник'),

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
    ${path('M80,210 C100,150 130,95 165,62 A18,18 0 0 1 198,72 C204,110 212,170 232,215', B, 2.6, '')}
    ${path('M110,210 C146,140 156,106 164,90', WARN, 2, '4 4')}
    ${t(60, 140, 'широко зайти', { fill: B, bold: true })}${t(225, 140, 'узко выйти', { fill: B, bold: true })}
    ${t(100, 225, 'плохо: впритык к знаку и выход наружу', { size: 11, fill: WARN })}`, 'Огибание знака'),

  // Gybe under gennaker: the sail goes round the front of the forestay.
  gennGybe: svg(360, 300, `${wind(22, 6)}
    ${path('M84,58 L180,170 L84,282', MUTED, 2, '6 5')}
    ${boat(112, 92, 140, B, -140, true, 1.1, true)}${boat(180, 168, 180, A, 179, true, 1.1, true)}${boat(112, 246, 220, B, 140, true, 1.1, true)}
    ${pill(150, 120, '1 бакштаг', B, 'start')}${pill(272, 214, '2 корма через ветер', A)}${pill(150, 262, '3 новый галс', B, 'start')}
    ${pill(252, 40, 'парус уходит вперёд,', TXT)}${pill(252, 64, 'перед штагом', TXT)}`, 'Поворот фордевинд на геннакере'),

  // Tack under jib: three moments.
  jibTack: svg(360, 260, `${wind(22, 6)}
    ${path('M110,236 L180,146 L110,56', MUTED, 2, '6 5')}
    ${boat(132, 208, 40, B, -40)}${boat(180, 140, 0, A, 0, true, 1.2)}${boat(132, 84, -40, B, 40)}
    ${pill(130, 252, '1 «Поворот!»', B)}${pill(252, 186, '2 нос через ветер:', A)}${pill(252, 210, 'отдать старый шкот', A)}${pill(140, 40, '3 выбрать новый', B)}`, 'Поворот оверштаг на стакселе'),

  // Two-turns penalty.
  penalty: svg(360, 240, `${wind(22, 6)}
    ${path('M40,190 L120,150 C150,135 170,110 150,90 C130,70 105,95 120,120 C135,145 170,130 175,110 C180,90 160,72 140,80 C125,88 130,115 160,122 L320,100', A, 2.6, '')}
    ${pill(240, 152, 'два полных оборота', A)}${pill(240, 176, '2 оверштага + 2 фордевинда', A)}`, 'Штрафные обороты'),

  // Man overboard: quick stop.
  mob: svg(360, 300, `${wind(22, 6)}
    <circle cx="150" cy="120" r="7" fill="#ff4f4f" stroke="#fff"/>${pill(150, 102, 'человек', '#ff8a8a')}
    ${path('M80,200 L150,135 C190,95 250,90 260,130 C268,170 220,200 190,170 C170,150 160,138 156,128', B, 2.6, '')}
    ${pill(16, 236, '1 крик и показывать рукой', TXT, 'start')}${pill(16, 258, '2 круг за борт, точка MOB', TXT, 'start')}
    ${pill(16, 280, '3 сразу разворот, подход против ветра', TXT, 'start')}`, 'Человек за бортом'),
};

