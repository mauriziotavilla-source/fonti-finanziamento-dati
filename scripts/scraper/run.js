const path = require('path');
const sources = require('./sources');
const { readJson, writeJson } = require('./lib/io');
const { collectFromSource } = require('./lib/parsers');
const { normalizeSourceItems } = require('./lib/normalize');
const { buildDiff, nextTopLevelData } = require('./lib/diff');

const ROOT = path.join(__dirname, '..', '..');

function resolvePath(...candidates) {
  for (const candidate of candidates) {
    if (candidate && require('fs').existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const BANDI_FILE = resolvePath(path.join(ROOT, 'data', 'bandi.json'), path.join(ROOT, 'bandi.json'));
const NOVITA_FILE =
  path.dirname(BANDI_FILE) === ROOT
    ? path.join(ROOT, 'novita.json')
    : resolvePath(path.join(ROOT, 'data', 'novita.json'), path.join(ROOT, 'novita.json'));
const ONLINE_BANDI_FILE = path.join(ROOT, 'online-update', 'data', 'bandi.json');
const ONLINE_NOVITA_FILE = path.join(ROOT, 'online-update', 'data', 'novita.json');

function isWriteMode() {
  return process.argv.includes('--write');
}

function canonicalUrl(url) {
  return String(url || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '');
}

function dedupeBandi(list) {
  const byKey = new Map();
  list.forEach((bando) => {
    const key =
      canonicalUrl(bando.link_ufficiale) ||
      canonicalUrl(bando.url_origine) ||
      `${bando.id}::${String(bando.nome || '').toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, bando);
      return;
    }
    const existingScore = Number(Boolean(existing.hash_contenuto)) + Number(Boolean(existing.scadenze?.length));
    const nextScore = Number(Boolean(bando.hash_contenuto)) + Number(Boolean(bando.scadenze?.length));
    if (nextScore >= existingScore) {
      byKey.set(key, { ...existing, ...bando });
    }
  });
  return [...byKey.values()];
}

function splitSeedAndScraped(previousData) {
  const seed = [];
  const scraped = [];
  (previousData.bandi || []).forEach((bando) => {
    if (!bando.fonte_scraper || bando.fonte_scraper === 'manual_seed') {
      seed.push({ ...bando, fonte_scraper: 'manual_seed', url_origine: bando.url_origine || bando.link_ufficiale || '' });
    } else {
      scraped.push(bando);
    }
  });
  return { seed, scraped };
}

async function collectAllSources() {
  const collected = [];
  const errors = [];

  for (const source of sources.filter((item) => item.enabled !== false)) {
    try {
      const rawItems = await collectFromSource(source);
      const normalized = normalizeSourceItems(source, rawItems);
      console.log(`Fonte ${source.id}: ${normalized.length} elementi`);
      collected.push(...normalized);
    } catch (err) {
      const detail = { source: source.id, message: err.message || String(err) };
      console.warn(`Fonte ${source.id} fallita: ${detail.message}`);
      errors.push(detail);
    }
  }

  return { collected, errors };
}

function sortBandi(list) {
  return [...list].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));
}

async function main() {
  const previousData = readJson(BANDI_FILE, { bandi: [], versione: 1 });
  const { seed } = splitSeedAndScraped(previousData);
  const { collected, errors } = await collectAllSources();

  const mergedBandi = sortBandi(dedupeBandi([...seed, ...collected]));
  const nextData = nextTopLevelData(previousData, mergedBandi, { sourceErrors: errors });
  const novita = buildDiff(previousData, nextData, errors);

  if (!isWriteMode()) {
    console.log(`Anteprima scraper: ${mergedBandi.length} bandi totali`);
    console.log(`Nuovi: ${novita.counts.nuovi} | Aggiornati: ${novita.counts.aggiornati}`);
    if (errors.length) console.log(`Fonti con errore: ${errors.length}`);
    return;
  }

  writeJson(BANDI_FILE, nextData);
  writeJson(NOVITA_FILE, novita);
  if (require('fs').existsSync(path.dirname(ONLINE_BANDI_FILE))) {
    writeJson(ONLINE_BANDI_FILE, nextData);
    writeJson(ONLINE_NOVITA_FILE, novita);
    console.log(`Mirror aggiornato in online-update/data`);
  }

  console.log(`Salvato ${BANDI_FILE}`);
  console.log(`Salvato ${NOVITA_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
