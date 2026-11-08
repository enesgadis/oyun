// PRIMER.EXE — shared domain metadata.
// Used by the browser app, the Node server and the evaluation scripts.

export const META = {
  appName: 'PRIMER.EXE',
  subtitle: 'Genç Mühendisin Resimli Kılavuzu',
  version: '1.0.0',
  schema: 3,
  tagline: 'Seninle büyüyen yazılım mühendisliği simülatörü.',
  primerNote:
    '1995’te bir roman, kızıyla birlikte büyüyen bir kitap hayal etti. Bu, o kitabın 2026’da derlenmiş hâli.',
  routes: ['home', 'library', 'career', 'profile'],
};

export const SKILLS = [
  { id: 'debug', name: 'Hata Ayıklama', short: 'DEBUG', color: '#5ef2c0', icon: 'bug' },
  { id: 'algo', name: 'Algoritma', short: 'ALGO', color: '#59d7ff', icon: 'bolt' },
  { id: 'systems', name: 'Sistem Tasarımı', short: 'SYS', color: '#a78bfa', icon: 'cloud' },
  { id: 'frontend', name: 'Arayüz', short: 'UI', color: '#ffc857', icon: 'phone' },
  { id: 'backend', name: 'Sunucu', short: 'API', color: '#ff8fab', icon: 'db' },
  { id: 'testing', name: 'Test & Güvenlik', short: 'TEST', color: '#7dd3fc', icon: 'shield' },
  { id: 'comm', name: 'Ekip İletişimi', short: 'COMM', color: '#f0abfc', icon: 'users' },
];

export const TRACKS = [
  {
    id: 'backend',
    name: 'Backend',
    blurb: 'API, veritabanı, kuyruk, ölçek.',
    icon: 'db',
    skills: ['backend', 'systems', 'testing'],
    recommend: ['c08', 'c09', 'c06'],
  },
  {
    id: 'frontend',
    name: 'Frontend',
    blurb: 'Arayüz, performans, erişilebilirlik.',
    icon: 'phone',
    skills: ['frontend', 'debug', 'comm'],
    recommend: ['c07', 'c04', 'c05'],
  },
  {
    id: 'mobile',
    name: 'Mobil',
    blurb: 'Cihaz sınırları, pil, mağaza.',
    icon: 'phone',
    skills: ['frontend', 'systems', 'testing'],
    recommend: ['c07', 'c04', 'c11'],
  },
  {
    id: 'data',
    name: 'Veri / ML',
    blurb: 'Veri hattı, model, değerlendirme.',
    icon: 'chart',
    skills: ['algo', 'systems', 'testing'],
    recommend: ['c08', 'c16', 'c10'],
  },
  {
    id: 'security',
    name: 'Güvenlik',
    blurb: 'Tehdit modeli, sırlar, kimlik.',
    icon: 'lock',
    skills: ['testing', 'backend', 'systems'],
    recommend: ['c05', 'c11', 'c14'],
  },
  {
    id: 'undecided',
    name: 'Kararsızım',
    blurb: 'Önce temelleri karıştır.',
    icon: 'spark',
    skills: ['debug', 'algo', 'comm'],
    recommend: ['c01', 'c02', 'c03'],
  },
];

export const PHASES = [
  {
    id: 1,
    code: 'YIL 01',
    name: 'Sıfırıncı Gün',
    rank: 'Çırak',
    minXp: 0,
    accent: '#5ef2c0',
    blurb: 'Temeller. Kodu çalıştırmakla, doğru çalıştırmak arasındaki fark.',
    focus: ['debug', 'algo'],
    unlocks: [
      { level: 1, label: 'Vardiya defteri' },
      { level: 2, label: 'Mentor notları' },
      { level: 3, label: 'Hipotez masası' },
    ],
    scene: 'desk',
  },
  {
    id: 2,
    code: 'YIL 02',
    name: 'İlk Teslimat',
    rank: 'Junior',
    minXp: 300,
    accent: '#ffc857',
    blurb: 'Zanaat. Test, güvenlik ve ekip içinde çalışma.',
    focus: ['testing', 'backend', 'comm'],
    unlocks: [
      { level: 3, label: 'Ekip sıralaması' },
      { level: 4, label: 'Kanıt bağlantıları' },
      { level: 5, label: 'Nöbet paneli' },
    ],
    scene: 'server',
  },
  {
    id: 3,
    code: 'YIL 03',
    name: 'Ölçek',
    rank: 'Mid-level',
    minXp: 750,
    accent: '#59d7ff',
    blurb: 'Sistemler. Trafik, kuyruk, kimlik ve kesintisiz lansman.',
    focus: ['systems', 'backend', 'comm'],
    unlocks: [
      { level: 6, label: 'Olay masası' },
      { level: 7, label: 'Mimari tahtası' },
      { level: 8, label: 'Kriz yayını' },
    ],
    scene: 'pager',
  },
  {
    id: 4,
    code: 'YIL 04',
    name: 'Mimar',
    rank: 'Senior',
    minXp: 1300,
    accent: '#a78bfa',
    blurb: 'Liderlik. Teknik karar, iletişim ve başkalarını büyütmek.',
    focus: ['systems', 'comm', 'testing'],
    unlocks: [
      { level: 9, label: 'Mentorluk' },
      { level: 10, label: 'Mimari sunum' },
      { level: 12, label: 'Kendi vardiyan' },
    ],
    scene: 'meeting',
  },
];

export const AVATARS = [
  { id: 'ada', name: 'Ada', color: '#5ef2c0', kind: 'blob', acc: 'antenna' },
  { id: 'deniz', name: 'Deniz', color: '#59d7ff', kind: 'box', acc: 'glasses' },
  { id: 'ece', name: 'Ece', color: '#ffc857', kind: 'tall', acc: 'ring' },
  { id: 'kerem', name: 'Kerem', color: '#a78bfa', kind: 'blob', acc: 'cap' },
];

export const BADGES = [
  { id: 'first-blood', name: 'İlk Vardiya', desc: 'İlk vakayı çöz.', icon: 'flag', color: '#5ef2c0' },
  { id: 'bug-hunter', name: 'Böcek Avcısı', desc: '3 hata ayıklama vakasında A veya üstü al.', icon: 'bug', color: '#ffc857' },
  { id: 'zero-downtime', name: 'Sıfır Kesinti', desc: 'Bir olay vakasını S notuyla çöz.', icon: 'shield', color: '#59d7ff' },
  { id: 'scholar', name: 'Kanıt Koleksiyoncusu', desc: 'Bir vakada tüm kanıtları topla.', icon: 'search', color: '#a78bfa' },
  { id: 'streak-3', name: '3 Gün Üst Üste', desc: '3 günlük seri yap.', icon: 'bolt', color: '#ff8fab' },
  { id: 'streak-7', name: 'Haftalık Disiplin', desc: '7 günlük seri yap.', icon: 'fire', color: '#ff8fab' },
  { id: 'mentor', name: 'Mentor', desc: 'Mentorun İlk Günü vakasını çöz.', icon: 'users', color: '#f0abfc' },
  { id: 'senior', name: 'Mimar', desc: '4. yıla ulaş.', icon: 'arch', color: '#a78bfa' },
  { id: 'polyglot', name: 'Çok Dilli', desc: '4 farklı disiplinde vaka çöz.', icon: 'globe', color: '#7dd3fc' },
];

export const LEADERBOARD_BOTS = [
  { name: 'kernelpanic', xp: 2140, title: 'Senior', seed: 'kernel' },
  { name: 'sude.js', xp: 1610, title: 'Mid', seed: 'sude' },
  { name: 'ada_dev', xp: 1180, title: 'Junior', seed: 'ada' },
  { name: 'bugslayer', xp: 720, title: 'Junior', seed: 'bug' },
  { name: 'merve.io', xp: 360, title: 'Çırak', seed: 'merve' },
];

export const UNIVERSAL_ACTION_META = {
  logs: { label: 'Logları tara', icon: 'terminal', cat: 'investigate' },
  metrics: { label: 'Dashboard’ı aç', icon: 'chart', cat: 'investigate' },
  code: { label: 'Kodu incele', icon: 'code', cat: 'investigate' },
  git: { label: 'Git geçmişine bak', icon: 'git', cat: 'investigate' },
  teammate: { label: 'Takım arkadaşına sor', icon: 'users', cat: 'comm' },
  docs: { label: 'Dokümanlara bak', icon: 'book', cat: 'investigate' },
  coffee: { label: 'Kahve molası ver', icon: 'coffee', cat: 'flavor' },
  status: { label: 'Durum sayfasını güncelle', icon: 'megaphone', cat: 'comm' },
  rollback: { label: 'Son deploy’u geri al', icon: 'undo', cat: 'risky' },
};

export const EVIDENCE_LABELS = {
  logs: 'Loglar',
  metrics: 'Metrikler',
  code: 'Kod',
  git: 'Git geçmişi',
  teammate: 'Ekip',
  docs: 'Dokümanlar',
};

export const VITALS = [
  { id: 'build', name: 'Build', desc: 'Sistem sağlığı', color: '#5ef2c0', icon: 'wrench' },
  { id: 'perf', name: 'Latency', desc: 'Performans', color: '#59d7ff', icon: 'bolt' },
  { id: 'trust', name: 'Trust', desc: 'Kullanıcı güveni', color: '#ffc857', icon: 'heart' },
  { id: 'team', name: 'Team', desc: 'Ekip morali', color: '#f0abfc', icon: 'users' },
];

export const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D', 'F'];

export function phaseForXp(xp = 0) {
  let phase = PHASES[0];
  for (const p of PHASES) if (xp >= p.minXp) phase = p;
  return phase;
}

export function levelForXp(xp = 0) {
  return Math.min(30, 1 + Math.floor(Math.max(0, xp) / 100));
}

export function nextPhase(xp = 0) {
  return PHASES.find((p) => p.minXp > xp) || null;
}

export function xpForNextLevel(xp = 0) {
  const level = levelForXp(xp);
  return Math.min(30, level + 1) * 100;
}

export function rankForXp(xp = 0) {
  return phaseForXp(xp).rank;
}

export function skillById(id) {
  return SKILLS.find((s) => s.id === id);
}

export function phaseById(id) {
  return PHASES.find((p) => p.id === Number(id));
}

export function trackById(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[TRACKS.length - 1];
}

export function avatarById(id) {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function hashString(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed) {
  let a = typeof seed === 'number' ? seed : hashString(String(seed));
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
