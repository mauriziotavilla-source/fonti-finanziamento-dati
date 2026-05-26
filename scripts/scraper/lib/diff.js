const { levelTopic, sha1, todayIso } = require('./utils');

function catalogHash(bandi) {
  const joined = (bandi || [])
    .map((b) => `${b.id}:${b.hash_contenuto || ''}`)
    .sort()
    .join('|');
  return sha1(joined);
}

function summarizeBando(bando) {
  return {
    id: bando.id,
    nome: bando.nome,
    livello: bando.livello,
    programma: bando.programma,
    link_ufficiale: bando.link_ufficiale,
    data_pubblicazione: bando.data_pubblicazione || '',
    fonte_scraper: bando.fonte_scraper || '',
    hash_contenuto: bando.hash_contenuto || '',
    notifica_topics: bando.notifica_topics?.length ? bando.notifica_topics : [levelTopic(bando.livello)],
  };
}

function buildDiff(previousData, nextData, sourceErrors = []) {
  const previousById = new Map((previousData.bandi || []).map((b) => [b.id, b]));
  const nuovi = [];
  const aggiornati = [];

  (nextData.bandi || []).forEach((bando) => {
    const before = previousById.get(bando.id);
    if (!before) {
      nuovi.push(summarizeBando(bando));
      return;
    }
    const prevHash = before.hash_contenuto || sha1(JSON.stringify(before));
    const nextHash = bando.hash_contenuto || sha1(JSON.stringify(bando));
    if (prevHash !== nextHash) {
      aggiornati.push(summarizeBando(bando));
    }
  });

  return {
    generated_at: new Date().toISOString(),
    source_run: 'github-actions-scraper',
    catalog_hash: nextData.catalog_hash || catalogHash(nextData.bandi || []),
    counts: {
      nuovi: nuovi.length,
      aggiornati: aggiornati.length,
    },
    nuovi,
    aggiornati,
    errori_fonti: sourceErrors,
  };
}

function nextVersion(previousData, hasChanges) {
  const prev = Number(previousData.versione || 1);
  return hasChanges ? prev + 1 : prev;
}

function nextTopLevelData(previousData, bandi, opts = {}) {
  const hash = catalogHash(bandi);
  const changed = hash !== (previousData.catalog_hash || catalogHash(previousData.bandi || []));
  return {
    ultimo_aggiornamento: changed ? todayIso() : previousData.ultimo_aggiornamento || todayIso(),
    versione: nextVersion(previousData, changed),
    regione_focus: previousData.regione_focus || 'sicilia',
    nota:
      previousData.nota ||
      'Le scadenze possono cambiare. Verifica sempre i siti ufficiali prima di presentare domanda.',
    catalog_hash: hash,
    generated_at: new Date().toISOString(),
    generated_by: 'scripts/scraper/run.js',
    bandi,
    changed,
    source_errors: opts.sourceErrors || [],
  };
}

module.exports = {
  buildDiff,
  catalogHash,
  nextTopLevelData,
};
