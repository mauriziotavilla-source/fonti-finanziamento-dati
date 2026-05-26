const { compactText, levelTopic, sha1, slugify, todayIso, unique } = require('./utils');

const KEYWORD_TO_SECTOR = [
  { terms: ['ai', 'digit', 'cyber', 'software', 'cloud', 'innovation'], settore: 'tecnologia' },
  { terms: ['export', 'internaz'], settore: 'export' },
  { terms: ['green', 'energia', 'sostenib', 'clima'], settore: 'green' },
  { terms: ['agric', 'food', 'bioeconom'], settore: 'agricoltura' },
  { terms: ['artigian', 'craft'], settore: 'artigianato' },
  { terms: ['commerc', 'retail'], settore: 'commercio' },
  { terms: ['startup', 'venture'], settore: 'startup' },
  { terms: ['turismo', 'cultura'], settore: 'turismo' },
  { terms: ['formaz', 'competenze'], settore: 'formazione' },
  { terms: ['industr', 'manifatt'], settore: 'industria' },
];

function inferSettori(text, source) {
  const hay = compactText(text).toLowerCase();
  const matched = KEYWORD_TO_SECTOR.filter((item) => item.terms.some((term) => hay.includes(term))).map(
    (item) => item.settore
  );
  return unique([...(source.defaultSettori || []), ...matched]).slice(0, 4);
}

function inferStato(item) {
  const hay = compactText(`${item.title} ${item.summary}`).toLowerCase();
  if (hay.includes('chius') || hay.includes('scadut')) return 'chiuso';
  if (hay.includes('apert') || hay.includes('attivo')) return 'aperto';
  return 'in_arrivo';
}

function defaultChecklist(livello) {
  return [
    'Aprire il link ufficiale e verificare l\'avviso completo',
    `Controllare requisiti e ammissibilita per il livello ${livello}`,
    'Preparare documentazione e scadenze principali',
  ];
}

function makeFingerprint(payload) {
  return sha1(
    JSON.stringify({
      nome: payload.nome,
      programma: payload.programma,
      livello: payload.livello,
      territorio: payload.territorio,
      link_ufficiale: payload.link_ufficiale,
      data_pubblicazione: payload.data_pubblicazione,
      scadenze: payload.scadenze,
      descrizione_breve: payload.descrizione_breve,
    })
  );
}

function normalizeItem(source, item) {
  const nome = compactText(item.title);
  const descrizione = compactText(item.summary || item.rawText || nome).slice(0, 260);
  const dataPubblicazione = item.publishedAt || '';
  const livello = source.livello || 'nazionale';
  const payload = {
    id: `${source.id}-${slugify(nome)}`,
    nome,
    programma: source.programma || source.id,
    livello,
    settori: inferSettori(`${nome} ${descrizione}`, source),
    stato: inferStato(item),
    descrizione_breve: descrizione,
    partecipazione:
      source.partecipazione ||
      `Verificare sul sito ufficiale chi puo partecipare al bando ${nome}. Territorio: ${source.territorio || 'da definire'}.`,
    cofinanziamento: '',
    budget_totale: '',
    beneficiari: source.beneficiari || ['PMI', 'Imprese'],
    territorio: source.territorio || 'Da definire',
    scadenze: [],
    requisiti: ['Verificare requisiti e soggetti ammissibili sul portale ufficiale'],
    documenti: ['Avviso ufficiale', 'Domanda di partecipazione', 'Documenti richiesti dal portale'],
    topic_esempio: [],
    link_ufficiale: item.url,
    checklist: defaultChecklist(livello),
    data_pubblicazione: dataPubblicazione,
    data_uscita: dataPubblicazione,
    fonte_scraper: source.id,
    url_origine: source.url,
    rilevato_il: todayIso(),
    notifica_topics: [levelTopic(livello)],
  };

  payload.hash_contenuto = makeFingerprint(payload);
  return payload;
}

function normalizeSourceItems(source, items) {
  return items.map((item) => normalizeItem(source, item));
}

module.exports = {
  makeFingerprint,
  normalizeItem,
  normalizeSourceItems,
};
