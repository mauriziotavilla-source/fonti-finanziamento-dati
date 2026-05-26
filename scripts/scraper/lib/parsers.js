const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const { compactText, makeAbsoluteUrl, parseDateLoose, unique } = require('./utils');

function keywordMatch(text, keywords = []) {
  if (!keywords.length) return true;
  const hay = compactText(text).toLowerCase();
  return keywords.some((word) => hay.includes(String(word).toLowerCase()));
}

function keywordExcluded(text, keywords = []) {
  const hay = compactText(text).toLowerCase();
  return keywords.some((word) => hay.includes(String(word).toLowerCase()));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'FontiFinanziamentoScraper/1.0 (+GitHub Actions)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function parseHtmlLinks(source) {
  const html = await fetchText(source.url);
  const $ = cheerio.load(html);
  const selectors = source.selectors?.length ? source.selectors : ['a'];
  const items = [];

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const title = compactText($(el).text());
      const href = makeAbsoluteUrl(source.url, $(el).attr('href'));
      const context = compactText($(el).closest('article, li, div, tr').text());
      const text = `${title} ${context}`;
      if (!title || !href) return;
      if (!keywordMatch(text, source.includeKeywords)) return;
      if (keywordExcluded(text, source.excludeKeywords)) return;
      items.push({
        title,
        url: href,
        summary: context.slice(0, 280),
        publishedAt: parseDateLoose(text),
        rawText: text,
      });
    });
  });

  return dedupeItems(items);
}

async function parseHtmlCards(source) {
  const html = await fetchText(source.url);
  const $ = cheerio.load(html);
  const selectors = source.cardSelectors?.length ? source.cardSelectors : ['a'];
  const items = [];

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const root = $(el).closest('article, li, div');
      const title = compactText($(el).text() || root.find('h1,h2,h3,h4').first().text());
      const href = makeAbsoluteUrl(source.url, $(el).attr('href'));
      const summary = compactText(root.text()).slice(0, 320);
      const text = `${title} ${summary}`;
      if (!title || !href) return;
      if (!keywordMatch(text, source.includeKeywords)) return;
      if (keywordExcluded(text, source.excludeKeywords)) return;
      items.push({
        title,
        url: href,
        summary,
        publishedAt: parseDateLoose(text),
        rawText: text,
      });
    });
  });

  return dedupeItems(items);
}

async function parseRss(source) {
  const xml = await fetchText(source.url);
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const channel = parsed.rss?.channel || parsed.feed || {};
  const entries = channel.item || channel.entry || [];
  const arr = Array.isArray(entries) ? entries : [entries];
  return dedupeItems(
    arr
      .map((entry) => ({
        title: compactText(entry.title?.['#text'] || entry.title),
        url: compactText(entry.link?.href || entry.link || entry.guid),
        summary: compactText(entry.description || entry.summary || entry.content || ''),
        publishedAt: parseDateLoose(entry.pubDate || entry.updated || entry.published || ''),
        rawText: compactText(
          `${entry.title?.['#text'] || entry.title || ''} ${entry.description || entry.summary || ''}`
        ),
      }))
      .filter((item) => item.title && item.url)
  );
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.url}::${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function collectFromSource(source) {
  if (source.parser === 'htmlCards') return parseHtmlCards(source);
  if (source.parser === 'rss') return parseRss(source);
  return parseHtmlLinks(source);
}

module.exports = {
  collectFromSource,
  dedupeItems,
  keywordExcluded,
  keywordMatch,
};
