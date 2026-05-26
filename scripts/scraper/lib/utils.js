const crypto = require('crypto');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set((values || []).map((x) => String(x || '').trim()).filter(Boolean))];
}

function makeAbsoluteUrl(baseUrl, maybeRelative) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return String(maybeRelative || '').trim();
  }
}

function parseDateLoose(value) {
  const raw = compactText(value);
  if (!raw) return '';

  const iso = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = raw.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);
  if (slash) {
    const dd = slash[1].padStart(2, '0');
    const mm = slash[2].padStart(2, '0');
    return `${slash[3]}-${mm}-${dd}`;
  }

  return '';
}

function sanitizeTopicName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function levelTopic(livello) {
  if (livello === 'europeo') return 'bandi_europei';
  if (livello === 'nazionale') return 'bandi_nazionali';
  return 'bandi_regionali';
}

module.exports = {
  compactText,
  levelTopic,
  makeAbsoluteUrl,
  parseDateLoose,
  sanitizeTopicName,
  sha1,
  slugify,
  todayIso,
  unique,
};
