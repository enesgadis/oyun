import { SKILLS, PHASES } from './meta.mjs';
import { CASES } from './content.mjs';

export const BLOCK_TYPES = [
  'ticker',
  'hero',
  'daily',
  'xp',
  'next',
  'radar',
  'quick',
  'leaderboard',
  'module',
  'note',
  'banner',
  'stats',
  'seasonPass',
  'divider',
  'oncall',
];

const clampStr = (v, max = 300) => typeof v === 'string' && v.length <= max;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function validateBlocks(blocks) {
  const errors = [];
  if (!Array.isArray(blocks)) return ['homeBlocks bir dizi olmalı.'];
  if (blocks.length > 16) errors.push('En fazla 16 blok kullanılabilir.');
  blocks.forEach((b, i) => {
    const at = `blok[${i}]`;
    if (!isObj(b)) {
      errors.push(`${at}: nesne değil.`);
      return;
    }
    if (!BLOCK_TYPES.includes(b.type)) {
      errors.push(`${at}: bilinmeyen tip "${b.type}".`);
      return;
    }
    if (b.type === 'ticker' && (!Array.isArray(b.items) || !b.items.length || b.items.some((x) => !clampStr(x, 140)))) {
      errors.push(`${at}: ticker için 1-8 kısa metin gerekli.`);
    }
    if (b.type === 'hero') {
      if (!clampStr(b.title, 160) || !clampStr(b.body, 260)) errors.push(`${at}: hero title/body gerekli.`);
      if (!b.cta || !clampStr(b.cta.label, 40)) errors.push(`${at}: hero cta.label gerekli.`);
    }
    if (['daily', 'xp', 'radar', 'leaderboard', 'next'].includes(b.type) && !clampStr(b.title || 'x', 80)) {
      errors.push(`${at}: ${b.type} başlığı gerekli.`);
    }
    if (b.type === 'quick' && b.items && (!Array.isArray(b.items) || b.items.length > 6)) {
      errors.push(`${at}: quick en fazla 6 öğe alır.`);
    }
    if (b.type === 'module' && (!clampStr(b.title, 80) || !clampStr(b.body, 220))) {
      errors.push(`${at}: module title/body gerekli.`);
    }
    if (b.type === 'note' && !clampStr(b.text, 260)) errors.push(`${at}: note text gerekli.`);
    if (b.type === 'banner' && (!clampStr(b.title, 100) || !clampStr(b.text, 260))) {
      errors.push(`${at}: banner title/text gerekli.`);
    }
    if (b.type === 'stats' && (!clampStr(b.title, 80) || !Array.isArray(b.items) || b.items.length > 6)) {
      errors.push(`${at}: stats title ve en fazla 6 öğe gerekli.`);
    }
    if (b.type === 'seasonPass' && (!clampStr(b.title, 80) || !Array.isArray(b.items))) {
      errors.push(`${at}: seasonPass title/items gerekli.`);
    }
    if (b.type === 'oncall' && (!clampStr(b.title, 80) || !clampStr(b.body, 220))) {
      errors.push(`${at}: oncall title/body gerekli.`);
    }
    if (b.minLevel !== undefined && (!Number.isInteger(b.minLevel) || b.minLevel < 1 || b.minLevel > 30)) {
      errors.push(`${at}: minLevel 1-30 arası tam sayı olmalı.`);
    }
  });
  return errors;
}

export function validateCase(c) {
  const errors = [];
  if (!isObj(c)) return ['Vaka nesnesi değil.'];
  if (!/^c[a-z0-9-]{1,12}$/.test(c.id || '')) errors.push('id "c" ile başlamalı ve 2-13 karakter olmalı.');
  if (!clampStr(c.title, 80)) errors.push('title gerekli.');
  if (!clampStr(c.subtitle, 160)) errors.push('subtitle gerekli.');
  if (![1, 2, 3, 4].includes(c.phase)) errors.push('phase 1-4 olmalı.');
  if (!Number.isInteger(c.difficulty) || c.difficulty < 1 || c.difficulty > 5) errors.push('difficulty 1-5 olmalı.');
  if (!Number.isInteger(c.turns) || c.turns < 8 || c.turns > 20) errors.push('turns 8-20 olmalı.');
  if (!isObj(c.vitals) || ['build', 'perf', 'trust', 'team'].some((k) => !Number.isInteger(c.vitals[k]) || c.vitals[k] < 1 || c.vitals[k] > 100)) errors.push('vitals 1-100 arası dört değer olmalı.');
  if (!Array.isArray(c.skills) || !c.skills.length || c.skills.some((s) => !SKILLS.some((x) => x.id === s))) errors.push('skills geçerli beceri id’leri olmalı.');
  if (!Array.isArray(c.actions) || c.actions.length < 4) errors.push('En az 4 vaka eylemi gerekli.');
  if (!Array.isArray(c.fixChain) || !c.fixChain.length) errors.push('fixChain gerekli.');
  if (!Array.isArray(c.hypotheses) || c.hypotheses.length !== 3 || c.hypotheses.filter((h) => h.correct).length !== 1) errors.push('Tam 3 hipotez ve 1 doğru cevap gerekli.');
  if (!isObj(c.clues) || !Object.values(c.clues).some(Boolean)) errors.push('clues gerekli.');
  if (!c.debrief || !clampStr(c.debrief.rootCause, 1000) || !Array.isArray(c.debrief.takeaways) || !c.debrief.takeaways.length) errors.push('debrief rootCause/takeaways gerekli.');
  if (c.phase && !PHASES.some((p) => p.id === c.phase)) errors.push('phase bilinmiyor.');
  const ids = new Set();
  for (const a of c.actions || []) {
    if (!a.id || ids.has(a.id)) errors.push(`Eylem id eksik/tekrarlı: ${a.id || '?'}`);
    ids.add(a.id);
    if (!clampStr(a.label, 80)) errors.push(`${a.id}: label gerekli.`);
    if (!['investigate', 'fix', 'comm', 'risky', 'flavor'].includes(a.cat)) errors.push(`${a.id}: cat geçersiz.`);
    if (a.needs && (!Array.isArray(a.needs) || a.needs.some((k) => !c.clues?.[k]))) errors.push(`${a.id}: needs var olmayan kanıt istiyor.`);
  }
  for (const id of c.fixChain || []) {
    if (!ids.has(id)) errors.push(`fixChain "${id}" eylemi yok.`);
  }
  if (c.universal !== false) {
    const universal = ['logs', 'metrics', 'code', 'git', 'teammate', 'docs'];
    for (const key of universal) {
      if (!c.clues?.[key]) errors.push(`universal vaka "${key}" ipucu eksik.`);
    }
  } else {
    for (const key of Object.keys(c.clues || {})) {
      const revealable = (c.actions || []).some((a) => a.reveal?.includes(key));
      if (!revealable) errors.push(`universal=false ama "${key}" kanıtı açığa çıkmıyor.`);
    }
  }
  if (c.hypotheses && c.hypotheses.filter((h) => h.correct).length === 1) {
    // fine
  }
  return errors;
}

export function validateCaseCollection(list = CASES) {
  const errors = [];
  const ids = new Set();
  for (const c of list) {
    const ce = validateCase(c);
    for (const e of ce) errors.push(`${c.id || '?'}: ${e}`);
    if (ids.has(c.id)) errors.push(`Tekrarlı vaka id: ${c.id}`);
    ids.add(c.id);
  }
  return errors;
}

export function validateRuntimePatch(patch) {
  const errors = [];
  if (!isObj(patch)) return ['Patch bir nesne olmalı.'];
  if (patch.season !== undefined) {
    if (!isObj(patch.season)) errors.push('season nesne olmalı.');
    else {
      if (patch.season.name && !clampStr(patch.season.name, 40)) errors.push('season.name çok uzun.');
      if (patch.season.tag && !clampStr(patch.season.tag, 40)) errors.push('season.tag çok uzun.');
      if (patch.season.accent && !/^#[0-9a-fA-F]{6}$/.test(patch.season.accent)) errors.push('season.accent #RRGGBB olmalı.');
    }
  }
  if (patch.theme !== undefined) {
    if (!isObj(patch.theme)) errors.push('theme nesne olmalı.');
    for (const key of ['accent', 'accent2', 'bg']) {
      if (patch.theme?.[key] && !/^#[0-9a-fA-F]{6}$/.test(patch.theme[key])) errors.push(`theme.${key} #RRGGBB olmalı.`);
    }
  }
  if (patch.announcement !== undefined && patch.announcement !== null) {
    if (!isObj(patch.announcement) || !clampStr(patch.announcement.text, 220) || !patch.announcement.text.trim()) errors.push('announcement.text gerekli.');
    if (patch.announcement.tone && !['info', 'warn', 'success'].includes(patch.announcement.tone)) errors.push('announcement.tone geçersiz.');
  }
  if (patch.homeBlocks !== undefined) errors.push(...validateBlocks(patch.homeBlocks));
  if (patch.appendBlocks !== undefined) errors.push(...validateBlocks(patch.appendBlocks).map((e) => `append: ${e}`));
  if (patch.featuredCase !== undefined && patch.featuredCase !== null && !/^c[a-z0-9-]{1,12}$/.test(patch.featuredCase)) errors.push('featuredCase id geçersiz.');
  if (patch.extraCase !== undefined) {
    const ce = validateCase(patch.extraCase);
    if (ce.length) errors.push(...ce.map((e) => `extraCase: ${e}`));
  }
  return errors;
}
