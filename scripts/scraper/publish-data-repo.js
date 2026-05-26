const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const API_BASE = 'https://api.github.com';

async function githubRequest(url, options = {}) {
  const token = process.env.SCRAPER_PUBLISH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Manca SCRAPER_PUBLISH_TOKEN o GITHUB_TOKEN');
  const res = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'fonti-finanziamento-scraper',
      ...(options.headers || {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function upsertFile(repo, branch, remotePath, localPath, message) {
  const fullApi = `${API_BASE}/repos/${repo}/contents/${remotePath}`;
  const current = await githubRequest(`${fullApi}?ref=${branch}`);
  const content = Buffer.from(fs.readFileSync(localPath)).toString('base64');
  const body = {
    message,
    branch,
    content,
  };
  if (current?.sha) body.sha = current.sha;
  await githubRequest(fullApi, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function main() {
  const repo = process.env.SCRAPER_PUBLISH_REPO || '';
  if (!repo.trim()) {
    console.log('Publish repo non configurato: salto mirror esterno.');
    return;
  }

  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY === repo) {
    console.log('Repo publish coincide con il repo corrente: mirror esterno non necessario.');
    return;
  }

  const branch = process.env.SCRAPER_PUBLISH_BRANCH || 'main';
  await upsertFile(repo, branch, 'bandi.json', path.join(ROOT, 'data', 'bandi.json'), 'chore: update bandi data');
  await upsertFile(repo, branch, 'novita.json', path.join(ROOT, 'data', 'novita.json'), 'chore: update novita data');
  console.log(`Mirror esterno aggiornato su ${repo}@${branch}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
