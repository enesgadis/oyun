import { hashString, seededRandom } from '../shared/meta.mjs';

const DEFAULT_PALETTE = {
  outline: '#060b14',
  white: '#f5fbff',
  black: '#080d16',
  cheek: '#ff8fab',
};

const CASE_COLORS = ['#5ef2c0', '#59d7ff', '#ffc857', '#a78bfa', '#ff8fab', '#7dd3fc', '#f0abfc'];

export function colorForSeed(seed = '') {
  return CASE_COLORS[hashString(seed) % CASE_COLORS.length];
}

function shade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function paletteFor(color) {
  return {
    ...DEFAULT_PALETTE,
    body: color,
    shade: shade(color, -48),
    light: shade(color, 52),
    glow: `${color}33`,
  };
}

const KIND_ACCESSORY = {
  bug: 'antenna',
  cart: 'screen',
  pr: 'doc',
  globe: 'ring',
  key: 'keyhole',
  db: 'screen',
  phone: 'screen',
  queue: 'lines',
  cache: 'screen',
  id: 'badge',
  flag: 'flag',
  arch: 'lines',
  pager: 'antenna',
  interview: 'glasses',
  robot: 'screen',
  mentor: 'cap',
  test: 'flask',
};

function shapeCells(shape, rnd) {
  const cells = [];
  const put = (x, y, key = 'body') => cells.push([x, y, key]);
  if (shape === 'box') {
    for (let y = 4; y <= 13; y += 1) {
      for (let x = 4; x <= 11; x += 1) {
        if ((y === 4 || y === 13) && (x === 4 || x === 11)) continue;
        put(x, y);
      }
    }
    for (let y = 9; y <= 10; y += 1) for (let x = 5; x <= 10; x += 1) put(x, y, 'screen');
  } else if (shape === 'cylinder') {
    for (let y = 4; y <= 13; y += 1) {
      for (let x = 3; x <= 12; x += 1) {
        if ((y === 4 || y === 13) && (x === 3 || x === 12)) continue;
        put(x, y);
      }
    }
    for (let x = 4; x <= 11; x += 1) {
      put(x, 5, 'shade');
      put(x, 12, 'shade');
    }
  } else if (shape === 'tall') {
    for (let y = 2; y <= 14; y += 1) {
      for (let x = 5; x <= 10; x += 1) {
        if ((y === 2 || y === 14) && (x === 5 || x === 10)) continue;
        put(x, y);
      }
    }
    for (let y = 5; y <= 9; y += 1) for (let x = 6; x <= 9; x += 1) put(x, y, 'screen');
  } else if (shape === 'doc') {
    for (let y = 3; y <= 13; y += 1) {
      for (let x = 3; x <= 12; x += 1) {
        if (y === 3 && x > 9) continue;
        if (y === 4 && x > 10) continue;
        put(x, y);
        if (y > 4 && y < 12 && (x === 7 || x === 8) && rnd() > 0.4) put(x, y, 'screen');
      }
    }
  } else {
    const top = 4 + (rnd() > 0.5 ? 1 : 0);
    for (let y = top; y <= 14; y += 1) {
      const t = (y - top) / Math.max(1, 14 - top);
      let half = 3 + Math.round(2.2 * Math.sin(t * Math.PI));
      if (y === 14) half = 3;
      if (rnd() < 0.16) half -= 1;
      for (let x = 8 - half; x < 8 + half; x += 1) put(x, y);
    }
  }
  return cells;
}

export function creatureRows({ seed = 'primer', kind = 'blob', acc = null } = {}) {
  const rnd = seededRandom(hashString(`${seed}:${kind}:${acc || ''}`));
  const grid = Array.from({ length: 16 }, () => Array(16).fill(null));
  const set = (x, y, key) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) grid[y][x] = key;
  };
  const shape = ['box', 'cylinder', 'tall', 'doc'].includes(kind) ? kind : 'blob';
  const body = shapeCells(shape, rnd);
  for (const [x, y, key] of body) set(x, y, key);

  // outline around the silhouette
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (grid[y][x]) continue;
      const near = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => nx >= 0 && nx < 16 && ny >= 0 && ny < 16 && grid[ny][nx] && grid[ny][nx] !== 'outline');
      if (near) set(x, y, 'outline');
    }
  }

  const eyeY = shape === 'tall' ? 5 : shape === 'box' ? 6 : 7;
  const cyclops = rnd() < 0.16;
  if (cyclops) {
    for (let y = eyeY; y <= eyeY + 2; y += 1) for (let x = 7; x <= 9; x += 1) set(x, y, 'white');
    set(8, eyeY + 1, 'black');
    set(8, eyeY + 2, 'black');
  } else {
    for (const ex of [5, 9]) {
      set(ex, eyeY, 'white');
      set(ex + 1, eyeY, 'white');
      set(ex, eyeY + 1, 'white');
      set(ex + 1, eyeY + 1, 'white');
      set(ex + (rnd() > 0.5 ? 0 : 1), eyeY + 1, 'black');
    }
  }
  const mouthY = eyeY + 3;
  set(7, mouthY, 'black');
  set(8, mouthY, 'black');
  if (rnd() > 0.55) {
    set(6, mouthY, 'black');
    set(9, mouthY, 'black');
  }
  set(4, mouthY, 'cheek');
  set(11, mouthY, 'cheek');

  // feet
  set(5, 15, 'outline');
  set(6, 15, 'outline');
  set(9, 15, 'outline');
  set(10, 15, 'outline');

  const accessory = acc || KIND_ACCESSORY[kind] || (rnd() > 0.5 ? 'antenna' : null);
  if (accessory === 'antenna') {
    set(7, 2, 'outline');
    set(7, 3, 'outline');
    set(7, 1, 'light');
  } else if (accessory === 'glasses') {
    const gy = eyeY - 1;
    for (let x = 4; x <= 11; x += 1) if (x !== 8) set(x, gy, 'outline');
  } else if (accessory === 'ring') {
    for (let x = 2; x <= 13; x += 1) {
      set(x, 3, 'light');
      set(x, 4, 'light');
    }
  } else if (accessory === 'cap') {
    for (let x = 5; x <= 10; x += 1) set(x, 2, 'shade');
    for (let x = 5; x <= 11; x += 1) set(x, 3, 'shade');
    set(11, 4, 'shade');
  } else if (accessory === 'keyhole') {
    set(7, 9, 'black');
    set(8, 9, 'black');
    set(7, 10, 'black');
    set(8, 10, 'black');
    set(8, 11, 'black');
  } else if (accessory === 'flag') {
    set(12, 3, 'outline');
    set(12, 4, 'outline');
    set(12, 5, 'outline');
    for (let x = 13; x <= 15; x += 1) set(x, 3, 'light');
    set(13, 4, 'light');
  } else if (accessory === 'screen') {
    for (let x = 5; x <= 10; x += 1) set(x, 10, 'screen');
    set(6, 11, 'light');
    set(7, 11, 'screen');
  } else if (accessory === 'lines') {
    for (let x = 5; x <= 10; x += 1) {
      set(x, 9, 'screen');
      set(x, 11, 'screen');
    }
  } else if (accessory === 'flask') {
    set(7, 9, 'screen');
    set(8, 9, 'screen');
    set(6, 10, 'screen');
    set(9, 10, 'screen');
    set(6, 11, 'screen');
    set(7, 11, 'screen');
    set(8, 11, 'screen');
    set(9, 11, 'screen');
  } else if (accessory === 'badge') {
    for (let x = 5; x <= 10; x += 1) set(x, 10, 'white');
    set(7, 10, 'black');
    set(8, 10, 'black');
    set(7, 11, 'black');
    set(8, 11, 'black');
  }
  return grid;
}

function drawRows(ctx, rows, x, y, scale, palette, flip = false) {
  for (let gy = 0; gy < rows.length; gy += 1) {
    for (let gx = 0; gx < 8 * 2; gx += 1) {
      const key = rows[gy]?.[gx];
      if (!key) continue;
      const color = palette[key] || palette.body;
      const px = flip ? 15 - gx : gx;
      ctx.fillStyle = color;
      ctx.fillRect(x + px * scale, y + gy * scale, scale, scale);
    }
  }
}

export function creatureDataURL({ seed = 'primer', kind = 'blob', color = '#5ef2c0', acc = null, scale = 6 } = {}) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 16 * scale;
  canvas.height = 16 * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const rows = creatureRows({ seed, kind, acc });
  drawRows(ctx, rows, 0, 0, scale, paletteFor(color));
  return canvas.toDataURL('image/png');
}

function grid(ctx, color, step = 10, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let x = 0; x < 180; x += step) ctx.fillRect(x, 0, 1, 100);
  for (let y = 0; y < 100; y += step) ctx.fillRect(0, y, 180, 1);
  ctx.restore();
}

function blink(time, offset = 0, speed = 650) {
  return Math.floor((time + offset) / speed) % 2 === 0;
}

function drawMonitor(ctx, x, y, w, h, accent, time, label = '> _') {
  ctx.fillStyle = '#050912';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#16233a';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = '#07101f';
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = accent;
  for (let i = 0; i < 4; i += 1) {
    ctx.globalAlpha = 0.3 + i * 0.12;
    ctx.fillRect(x + 7, y + 8 + i * 4, Math.max(4, w - 18 - i * 6), 1);
  }
  ctx.globalAlpha = 1;
  if (blink(time, 0, 500)) ctx.fillRect(x + 7, y + h - 10, 3, 1);
}

function drawDeskScene(ctx, { mascot, accent, time, status }) {
  ctx.fillStyle = '#0a1322';
  ctx.fillRect(0, 0, 180, 100);
  ctx.fillStyle = '#0e1b30';
  ctx.fillRect(0, 0, 180, 72);
  grid(ctx, '#14243d', 12, 0.5);
  // window
  ctx.fillStyle = '#060d1b';
  ctx.fillRect(112, 10, 54, 34);
  ctx.fillStyle = '#10213b';
  ctx.fillRect(114, 12, 50, 30);
  for (let i = 0; i < 9; i += 1) {
    const sx = 118 + ((i * 13) % 43);
    const sy = 16 + ((i * 7) % 22);
    if (blink(time, i * 200, 900)) {
      ctx.fillStyle = '#cfe9ff';
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
  ctx.fillStyle = '#0a1322';
  ctx.fillRect(139, 12, 1, 30);
  ctx.fillRect(114, 27, 50, 1);
  // desk
  ctx.fillStyle = '#241a2a';
  ctx.fillRect(0, 72, 180, 12);
  ctx.fillStyle = '#3a2a3e';
  ctx.fillRect(0, 72, 180, 3);
  ctx.fillStyle = '#141021';
  ctx.fillRect(8, 84, 4, 16);
  ctx.fillRect(168, 84, 4, 16);
  // monitor
  drawMonitor(ctx, 24, 30, 66, 40, accent, time);
  ctx.fillStyle = '#2d2438';
  ctx.fillRect(52, 70, 10, 4);
  // rack
  ctx.fillStyle = '#111c2e';
  ctx.fillRect(136, 38, 32, 34);
  ctx.strokeStyle = '#2b3c58';
  ctx.strokeRect(136.5, 38.5, 31, 33);
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = blink(time, i * 230, 500) ? accent : '#2a3a55';
    ctx.fillRect(140, 43 + i * 4, 2, 1);
    ctx.fillStyle = blink(time, i * 330, 700) ? '#ffc857' : '#2a3a55';
    ctx.fillRect(144, 43 + i * 4, 2, 1);
    ctx.fillStyle = '#20304a';
    ctx.fillRect(148, 43 + i * 4, 16, 1);
  }
  // plant
  ctx.fillStyle = '#243b35';
  ctx.fillRect(9, 58, 12, 14);
  ctx.fillStyle = '#5ef2c0';
  ctx.fillRect(12, 52, 2, 8);
  ctx.fillRect(16, 50, 2, 10);
  ctx.fillRect(8, 54, 4, 2);
  ctx.fillRect(18, 55, 3, 2);
  // mug
  ctx.fillStyle = '#e9f2ff';
  ctx.fillRect(100, 66, 6, 6);
  ctx.fillStyle = accent;
  ctx.fillRect(100, 66, 6, 1);
  ctx.fillStyle = '#e9f2ff';
  ctx.fillRect(106, 68, 2, 2);
  // mascot
  drawMascot(ctx, mascot, 72, 42, 3, accent, time, status);
  // floating status
  if (status === 'won') {
    ctx.fillStyle = '#5ef2c0';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(20 + i * 4, 18 - (i % 3) * 3, 2, 2);
  }
}

function drawServerScene(ctx, { mascot, accent, time, status }) {
  ctx.fillStyle = '#070d1a';
  ctx.fillRect(0, 0, 180, 100);
  ctx.fillStyle = '#0b1528';
  ctx.fillRect(0, 0, 180, 80);
  grid(ctx, '#12223b', 10, 0.4);
  for (const baseX of [6, 118]) {
    for (let r = 0; r < 2; r += 1) {
      const rx = baseX + r * 28;
      ctx.fillStyle = '#101d32';
      ctx.fillRect(rx, 14, 24, 58);
      ctx.strokeStyle = '#263a5c';
      ctx.strokeRect(rx + 0.5, 14.5, 23, 57);
      for (let i = 0; i < 11; i += 1) {
        ctx.fillStyle = '#08111f';
        ctx.fillRect(rx + 3, 18 + i * 5, 18, 3);
        ctx.fillStyle = blink(time, i * 170, 420) ? accent : '#1b2c49';
        ctx.fillRect(rx + 17, 19 + i * 5, 1, 1);
        ctx.fillStyle = blink(time, i * 260, 700) ? '#ffc857' : '#1b2c49';
        ctx.fillRect(rx + 19, 19 + i * 5, 1, 1);
      }
    }
  }
  // console
  drawMonitor(ctx, 54, 46, 72, 30, accent, time);
  ctx.fillStyle = '#0c1728';
  ctx.fillRect(54, 76, 72, 4);
  // floor
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 80, 180, 20);
  grid(ctx, '#13223a', 10, 0.5);
  drawMascot(ctx, mascot, 66, 44, 3, accent, time, status);
  // cables
  ctx.strokeStyle = '#1c2d49';
  ctx.beginPath();
  ctx.moveTo(14, 80);
  ctx.bezierCurveTo(70, 92, 100, 86, 172, 80);
  ctx.stroke();
  if (status === 'won') {
    ctx.fillStyle = accent;
    for (let i = 0; i < 6; i += 1) ctx.fillRect(20 + i * 25, 10 + (i % 2) * 3, 2, 2);
  }
}

function drawMobileScene(ctx, { mascot, accent, time, status }) {
  ctx.fillStyle = '#0a1220';
  ctx.fillRect(0, 0, 180, 100);
  ctx.fillStyle = '#0f1c30';
  ctx.fillRect(0, 0, 180, 100);
  grid(ctx, '#172943', 14, 0.35);
  // halo
  ctx.fillStyle = `${accent}22`;
  ctx.fillRect(44, 8, 92, 82);
  // phone
  ctx.fillStyle = '#050a13';
  ctx.fillRect(54, 8, 72, 80);
  ctx.fillStyle = '#22334f';
  ctx.fillRect(57, 11, 66, 74);
  ctx.fillStyle = '#08111f';
  ctx.fillRect(60, 14, 60, 68);
  ctx.fillStyle = '#0d1b30';
  ctx.fillRect(62, 16, 56, 64);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(62, 16, 56, 2);
  ctx.globalAlpha = 1;
  // notch
  ctx.fillStyle = '#04080f';
  ctx.fillRect(82, 12, 16, 3);
  // app bars
  ctx.fillStyle = '#16263f';
  for (let i = 0; i < 3; i += 1) ctx.fillRect(66, 22 + i * 4, 28 - i * 5, 2);
  ctx.fillStyle = accent;
  ctx.fillRect(66, 50, 22, 2);
  // mascot on screen
  drawMascot(ctx, mascot, 74, 30, 2, accent, time, status);
  // buttons
  ctx.fillStyle = '#1d2e49';
  ctx.fillRect(68, 64, 44, 8);
  ctx.fillStyle = accent;
  ctx.fillRect(75, 67, 30, 2);
  // floating notifications
  ctx.fillStyle = blink(time, 0, 800) ? '#ffc857' : '#2a3a55';
  ctx.fillRect(30, 28, 9, 3);
  ctx.fillStyle = blink(time, 250, 900) ? accent : '#2a3a55';
  ctx.fillRect(142, 52, 12, 3);
  ctx.fillStyle = '#1d2e49';
  ctx.fillRect(26, 88, 128, 2);
}

function drawMeetingScene(ctx, { mascot, accent, time, status }) {
  ctx.fillStyle = '#0a1322';
  ctx.fillRect(0, 0, 180, 100);
  ctx.fillStyle = '#0e1b2e';
  ctx.fillRect(0, 0, 180, 72);
  grid(ctx, '#152741', 12, 0.4);
  // whiteboard
  ctx.fillStyle = '#dbe8f7';
  ctx.fillRect(20, 10, 116, 48);
  ctx.fillStyle = '#b8cde6';
  ctx.fillRect(20, 56, 116, 2);
  ctx.fillStyle = '#2a4a7a';
  ctx.fillRect(26, 16, 25, 2);
  ctx.fillRect(26, 21, 38, 2);
  ctx.fillRect(26, 26, 30, 2);
  ctx.fillStyle = accent;
  ctx.fillRect(70, 34, 28, 1);
  ctx.fillRect(98, 27, 22, 1);
  ctx.fillRect(98, 30, 16, 1);
  ctx.fillStyle = '#ff8fab';
  ctx.fillRect(30, 36, 14, 12);
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(48, 36, 14, 12);
  ctx.fillStyle = '#2a4a7a';
  ctx.fillRect(30, 44, 10, 1);
  ctx.fillRect(32, 47, 8, 1);
  // marker tray
  ctx.fillStyle = '#94b4d8';
  ctx.fillRect(24, 58, 108, 2);
  // table
  ctx.fillStyle = '#241a2a';
  ctx.fillRect(8, 72, 164, 8);
  ctx.fillStyle = '#3a2a3e';
  ctx.fillRect(8, 72, 164, 2);
  ctx.fillStyle = '#141021';
  ctx.fillRect(18, 80, 4, 16);
  ctx.fillRect(158, 80, 4, 16);
  // chairs
  ctx.fillStyle = '#1a2438';
  ctx.fillRect(16, 62, 3, 12);
  ctx.fillRect(160, 62, 3, 12);
  // laptop
  ctx.fillStyle = '#050a13';
  ctx.fillRect(112, 64, 24, 8);
  ctx.fillStyle = '#203652';
  ctx.fillRect(114, 65, 20, 6);
  ctx.fillStyle = accent;
  ctx.fillRect(116, 67, 10, 1);
  // coffee
  ctx.fillStyle = '#e9f2ff';
  ctx.fillRect(144, 67, 5, 5);
  ctx.fillStyle = accent;
  ctx.fillRect(144, 67, 5, 1);
  drawMascot(ctx, mascot, 62, 40, 3, accent, time, status);
  if (status === 'won') {
    ctx.fillStyle = '#ffc857';
    for (let i = 0; i < 4; i += 1) ctx.fillRect(146 + (i % 2) * 7, 14 + i * 8, 2, 2);
  }
}

function drawMascot(ctx, mascot, x, y, scale, accent, time, status) {
  ctx.fillStyle = `${accent}26`;
  const bob = status === 'active' ? Math.round(Math.sin(time / 420)) : 0;
  ctx.fillRect(x - 6, y + bob - 4, 16 * scale + 12, 16 * scale + 10);
  const rows = mascot?.rows || creatureRows({ seed: 'primer', kind: 'blob' });
  const palette = mascot?.palette || paletteFor(accent);
  drawRows(ctx, rows, x, y + bob, scale, palette);
  if (status === 'lost') {
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(x - 4, y - 8, 8, 2);
    ctx.fillRect(x - 1, y - 11, 2, 8);
  } else if (status === 'active' && blink(time, 0, 700)) {
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(x + 16 * scale + 2, y + 2, 2, 2);
  }
}

export function drawScene(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const { art = 'terminal', seed = 'case', color = colorForSeed(seed), accent = '#5ef2c0', time = 0, status = 'active' } = options;
  const width = 180;
  const height = 100;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const rows = creatureRows({ seed, kind: seed, acc: null });
  // If seed is actually a kind (bug, db...), use it as the shape.
  const knownKind = ['blob', 'box', 'cylinder', 'tall', 'doc', 'bug', 'cart', 'pr', 'globe', 'key', 'db', 'phone', 'queue', 'cache', 'id', 'flag', 'arch', 'pager', 'interview', 'robot', 'mentor', 'test'].includes(seed);
  const mascotRows = knownKind ? creatureRows({ seed, kind: seed }) : rows;
  const mascot = { rows: mascotRows, palette: paletteFor(color) };
  const scene = ['server', 'cloud'].includes(art)
    ? drawServerScene
    : ['mobile', 'phone'].includes(art)
      ? drawMobileScene
      : ['meeting', 'interview', 'arch'].includes(art)
        ? drawMeetingScene
        : drawDeskScene;
  scene(ctx, { mascot, accent, time, status });
  // pixel vignette
  ctx.fillStyle = 'rgba(3,6,12,0.18)';
  ctx.fillRect(0, 0, 180, 2);
  ctx.fillRect(0, 98, 180, 2);
  return { width, height };
}

export { paletteFor, shade };
