/**
 * Post-acceptance security audit for Telegram bot credentials.
 * Does NOT print matched secrets — only PASS/FAIL summaries.
 *
 * Usage: node scripts/acceptance/telegram-security-audit.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const appData = process.env.APPDATA;
if (!appData) {
  console.error('SECURITY AUDIT: FAIL — APPDATA is not set');
  process.exit(1);
}

const appDir = path.join(appData, 'com.reizoko.app');
const dbPath = path.join(appDir, 'reizoko.db');
const tokenPattern = /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g;
const sensitiveKeyPattern = /(bot[_-]?token|access[_-]?token|secret[_-]?ref\s*=\s*['"][^'"]*:[^'"]+)/i;

function scanText(label, text) {
  const tokenHits = text.match(tokenPattern) ?? [];
  const keyHits = sensitiveKeyPattern.test(text);
  return { label, tokenHits: tokenHits.length, keyHits };
}

function readIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath);
}

const results = [];

const db = readIfExists(dbPath);
if (db) {
  results.push(scanText('sqlite:reizoko.db', db.toString('utf8')));
} else {
  console.log('sqlite:reizoko.db — not found (skip if acceptance not started yet)');
}

for (const file of readdirSync(appDir).filter((name) => name.endsWith('.reizoko-backup') || name.endsWith('.json'))) {
  const fullPath = path.join(appDir, file);
  const content = readIfExists(fullPath);
  if (content) {
    results.push(scanText(file, content.toString('utf8')));
  }
}

let failed = false;
for (const result of results) {
  if (result.tokenHits > 0 || result.keyHits) {
    failed = true;
    console.error(`SECURITY AUDIT: FAIL — potential secret material in ${result.label}`);
  } else {
    console.log(`SECURITY AUDIT: PASS — ${result.label}`);
  }
}

if (failed) {
  console.error('SECURITY AUDIT: FAIL — remove secrets from persisted artifacts');
  process.exit(1);
}

console.log('SECURITY AUDIT: PASS — no Telegram bot token patterns detected in SQLite/backup/export');
