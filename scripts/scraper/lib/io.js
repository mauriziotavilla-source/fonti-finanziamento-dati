const fs = require('fs');
const path = require('path');

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  clone,
  readJson,
  writeJson,
};
