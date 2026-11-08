import { SKILLS, VITALS, PHASES, phaseForXp, levelForXp, avatarById, BADGES } from '../shared/meta.mjs';
import { icon } from './icons.mjs';
import { creatureDataURL, colorForSeed } from './sprites.mjs';

export function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function attr(value = '') {
  return esc(value).replaceAll('`', '&#96;');
}

export function logo({ compact = false } = {}) {
  return `<span class="logo ${compact ? 'logo-compact' : ''}">
    <span class="logo-mark" aria-hidden="true">${icon('terminal', compact ? 22 : 28)}</span>
    <span class="logo-text">PRIMER<span class="logo-dot">.</span>EXE</span>
  </span>`;
}

export function brandSubtitle() {
  return 'Genç Mühendisin Resimli Kılavuzu';
}

export function stars(n = 1) {
  return `<span class="stars" aria-label="Zorluk ${n} / 5">${Array.from({ length: 5 }, (_, i) => `<span class="star ${i < n ? 'on' : ''}">◆</span>`).join('')}</span>`;
}

export function chip(text, tone = 'default', extra = '') {
  return `<span class="chip chip-${tone} ${extra}">${esc(text)}</span>`;
}

export function skillChips(ids = []) {
  return `<span class="chips">${ids
    .map((id) => {
      const s = SKILLS.find((x) => x.id === id);
      return s ? `<span class="chip skill-chip" style="--chip:${s.color}">${esc(s.short)}</span>` : '';
    })
    .join('')}</span>`;
}

export function gradeBadge(grade = 'F', big = false) {
  const g = ['S', 'A', 'B', 'C', 'D', 'F'].includes(grade) ? grade : 'F';
  return `<span class="grade grade-${g} ${big ? 'grade-big' : ''}" aria-label="Not ${g}">${g}</span>`;
}

export function avatarImage(profile, size = 64) {
  const a = avatarById(profile?.avatar);
  const url = creatureDataURL({ seed: a.id, kind: a.kind, color: a.color, acc: a.acc, scale: 6 });
  return `<img class="pixel-avatar" src="${url}" width="${size}" height="${size}" alt="${esc(a.name)} avatarı" style="--avatar:${a.color}">`;
}

export function mascotImage(seed, size = 40) {
  const color = colorForSeed(seed);
  const url = creatureDataURL({ seed, kind: seed, color, scale: 5 });
  return `<img class="mascot-img" src="${url}" width="${size}" height="${size}" alt="" aria-hidden="true">`;
}

export function sceneCanvas({ art = 'terminal', seed = 'bug', color = null, accent = '#5ef2c0', status = 'active', live = false, className = '' } = {}) {
  return `<canvas class="scene-canvas ${className}" width="180" height="100" data-art="${attr(art)}" data-seed="${attr(seed)}" data-color="${attr(color || colorForSeed(seed))}" data-accent="${attr(accent)}" data-status="${attr(status)}" data-live="${live ? '1' : '0'}" role="img" aria-label="Pixel vaka sahnesi"></canvas>`;
}

export function xpBar(value = 0, color = '#5ef2c0', segments = 10) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments);
  return `<div class="xp-bar" style="--xp-color:${color}" role="progressbar" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="100">
    ${Array.from({ length: segments }, (_, i) => `<span class="xp-seg ${i < filled ? 'on' : ''}"></span>`).join('')}
  </div>`;
}

export function statBar(value, color = '#5ef2c0', label = '') {
  return `<div class="stat-bar" style="--bar-color:${color}">
    <span class="stat-fill" style="width:${Math.max(0, Math.min(100, value))}%"></span>
    ${label ? `<span class="stat-label">${esc(label)}</span>` : ''}
  </div>`;
}

export function vitalBar(id, value) {
  const v = VITALS.find((x) => x.id === id) || VITALS[0];
  return `<div class="vital vital-${v.id}" style="--vital:${v.color}">
    <div class="vital-head">
      <span class="vital-name">${icon(v.icon, 14)} ${esc(v.name)}</span>
      <span class="vital-value">${Math.round(value)}</span>
    </div>
    <div class="vital-track"><span class="vital-fill" style="width:${Math.max(0, Math.min(100, value))}%"></span></div>
  </div>`;
}

export function radarSvg(profile, { size = 210 } = {}) {
  const cx = 110;
  const cy = 102;
  const radius = 64;
  const values = SKILLS.map((s) => Math.max(6, profile.skills?.[s.id] || 0));
  const angle = (i) => (-Math.PI / 2) + (i * Math.PI * 2) / SKILLS.length;
  const point = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  const poly = (r) => SKILLS.map((_, i) => point(i, r).map((n) => n.toFixed(1)).join(',')).join(' ');
  const data = SKILLS.map((_, i) => point(i, (values[i] / 100) * radius).map((n) => n.toFixed(1)).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1]
    .map((f) => `<polygon points="${poly(radius * f)}" class="radar-ring" />`)
    .join('');
  const axes = SKILLS.map((_, i) => {
    const [x, y] = point(i, radius);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="radar-axis" />`;
  }).join('');
  const dots = values
    .map((v, i) => {
      const [x, y] = point(i, (v / 100) * radius);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" class="radar-dot" />`;
    })
    .join('');
  const labels = SKILLS.map((s, i) => {
    const [x, y] = point(i, radius + 20);
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${(y + 2).toFixed(1)}" text-anchor="${anchor}" class="radar-label" fill="${s.color}">${esc(s.short)}</text>`;
  }).join('');
  return `<svg class="radar" viewBox="0 0 220 204" width="${size}" height="${Math.round(size * 0.93)}" role="img" aria-label="Yetenek radarı: ${SKILLS.map((s) => `${s.name} ${values[SKILLS.indexOf(s)]}`).join(', ')}">
    ${rings}${axes}
    <polygon points="${data}" class="radar-data" />
    ${dots}${labels}
  </svg>`;
}

export function sectionHead(kicker, title, right = '') {
  return `<div class="section-head">
    <div><span class="kicker">${esc(kicker)}</span><h2>${title}</h2></div>
    ${right}
  </div>`;
}

export function formatDuration(ms = 0) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}dk ${String(s).padStart(2, '0')}sn`;
}

export function formatDate(iso, short = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', short ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

export function phaseName(profile) {
  return phaseForXp(profile.xp || 0);
}

export function levelOf(profile) {
  return levelForXp(profile.xp || 0);
}

export function nextThreshold(profile) {
  const p = phaseForXp(profile.xp || 0);
  const next = PHASES.find((x) => x.minXp > (profile.xp || 0));
  return { phase: p, next };
}

export function badgeCard(badge, earned = false) {
  return `<div class="badge-card ${earned ? 'earned' : 'locked'}" style="--badge:${badge.color}">
    <span class="badge-icon">${icon(badge.icon, 22)}</span>
    <span class="badge-name">${esc(badge.name)}</span>
    <span class="badge-desc">${earned ? esc(badge.desc) : 'Kilitli'}</span>
  </div>`;
}

export function docsList(docs = []) {
  if (!docs?.length) return '';
  return `<ul class="docs-list">${docs
    .map((d) => `<li><a href="${attr(d.url)}" target="_blank" rel="noopener noreferrer">${icon('book', 12)} ${esc(d.label)}</a></li>`)
    .join('')}</ul>`;
}

export function emptyState(title, text, cta = '') {
  return `<div class="empty-state"><div class="empty-mark">${icon('alert', 30)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${cta}</div>`;
}

export function toastIcon(tone = 'info') {
  return icon(tone === 'good' ? 'check' : tone === 'warn' ? 'alert' : tone === 'bad' ? 'x' : 'info', 14);
}

export function reportCardCanvas(report, profile) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 860;
  const ctx = canvas.getContext('2d');
  const accent = phaseForXp(profile.xp || 0).accent;
  const gradeColors = { S: '#ffc857', A: '#5ef2c0', B: '#59d7ff', C: '#ffc857', D: '#ff8fab', F: '#ff6b6b' };
  ctx.fillStyle = '#080d16';
  ctx.fillRect(0, 0, 640, 860);
  ctx.fillStyle = '#0d1626';
  for (let x = 0; x < 640; x += 24) ctx.fillRect(x, 0, 1, 860);
  for (let y = 0; y < 860; y += 24) ctx.fillRect(0, y, 640, 1);
  ctx.fillStyle = accent;
  ctx.fillRect(32, 32, 576, 4);
  ctx.fillStyle = '#e8f1ff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('PRIMER.EXE // VARDİYA RAPORU', 48, 78);
  ctx.fillStyle = '#7f94b3';
  ctx.font = '16px monospace';
  ctx.fillText(`${report.caseCode} • ${report.caseTitle}`, 48, 108);
  ctx.fillStyle = gradeColors[report.grade] || accent;
  ctx.font = 'bold 172px monospace';
  ctx.fillText(report.grade, 48, 280);
  ctx.fillStyle = '#e8f1ff';
  ctx.font = 'bold 52px monospace';
  ctx.fillText(`${report.score}`, 270, 230);
  ctx.fillStyle = '#7f94b3';
  ctx.font = '16px monospace';
  ctx.fillText('/ 100 PUAN', 272, 258);
  ctx.fillStyle = '#0d1626';
  // separator
  ctx.fillStyle = '#1b2b45';
  ctx.fillRect(48, 320, 544, 2);
  ctx.fillStyle = '#e8f1ff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(profile.name.toUpperCase(), 48, 366);
  ctx.fillStyle = '#7f94b3';
  ctx.font = '16px monospace';
  ctx.fillText(`${phaseForXp(profile.xp || 0).rank} • ${report.xp} XP • ${report.actions} hamle`, 48, 394);
  ctx.fillStyle = '#e8f1ff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('KÖK NEDEN', 48, 448);
  ctx.fillStyle = '#b9cbe4';
  ctx.font = '16px monospace';
  wrapText(ctx, report.rootCause, 48, 478, 544, 24, 4);
  ctx.fillStyle = '#e8f1ff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('ÖĞRENİLEN', 48, 630);
  ctx.fillStyle = '#b9cbe4';
  ctx.font = '15px monospace';
  report.takeaways.slice(0, 2).forEach((t, i) => {
    wrapText(ctx, `> ${t}`, 48, 660 + i * 50, 544, 21, 2);
  });
  ctx.fillStyle = accent;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('PRIMER.EXE // 1995 → 2026', 48, 808);
  ctx.fillStyle = '#7f94b3';
  ctx.font = '14px monospace';
  ctx.fillText('4 yılda seninle büyüyen mühendislik simülatörü', 48, 832);
  return canvas.toDataURL('image/png');
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text || '').split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (lines < maxLines && line) ctx.fillText(line, x, y + lines * lineHeight);
}

export { icon, BADGES };
