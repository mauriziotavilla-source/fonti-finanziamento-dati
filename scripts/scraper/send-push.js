const path = require('path');
const admin = require('firebase-admin');
const { readJson } = require('./lib/io');

const ROOT = path.join(__dirname, '..', '..');
const NOVITA_FILE = path.join(ROOT, 'data', 'novita.json');

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function groupByTopic(items) {
  const grouped = new Map();
  items.forEach((item) => {
    (item.notifica_topics || []).forEach((topic) => {
      if (!grouped.has(topic)) grouped.set(topic, []);
      grouped.get(topic).push(item);
    });
  });
  return grouped;
}

function titleForTopic(topic, count) {
  const label =
    topic === 'bandi_europei' ? 'europei' : topic === 'bandi_nazionali' ? 'nazionali' : 'regionali';
  return count === 1 ? `Nuovo bando ${label}` : `${count} nuovi bandi ${label}`;
}

function bodyForItems(items) {
  if (items.length === 1) return items[0].nome;
  return items
    .slice(0, 2)
    .map((item) => item.nome)
    .join(' • ');
}

async function main() {
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    console.log('Push saltate: manca FIREBASE_SERVICE_ACCOUNT_JSON');
    return;
  }

  const novita = readJson(NOVITA_FILE, null);
  if (!novita?.nuovi?.length) {
    console.log('Nessun nuovo bando da notificare.');
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const grouped = groupByTopic(novita.nuovi);
  for (const [topic, items] of grouped.entries()) {
    const payload = {
      notification: {
        title: titleForTopic(topic, items.length),
        body: bodyForItems(items),
      },
      data: {
        kind: 'nuovi_bandi',
        topic,
        count: String(items.length),
        generatedAt: novita.generated_at || '',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'bandi_nuovi',
          defaultSound: true,
        },
      },
      topic,
    };

    const messageId = await admin.messaging().send(payload);
    console.log(`Push inviata a ${topic}: ${messageId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
