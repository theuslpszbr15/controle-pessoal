// Gera os PNGs dos ícones a partir de icons/icon.svg usando Chrome headless.
// Uso: CHROME_PATH="caminho/do/chrome" node tools/icons.mjs
// (opcional) PUPPETEER_CORE="caminho/para/node_modules/puppeteer-core"
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const pptrPath = process.env.PUPPETEER_CORE;
const puppeteer = pptrPath ? createRequire(join(pptrPath, '..', 'noop.js'))('puppeteer-core') : (await import('puppeteer-core')).default;

const svg = await readFile('icons/icon.svg', 'utf8');
const square = svg.replace('rx="112"', 'rx="0"');
const targets = [
  ['icons/icon-192.png', 192, svg],
  ['icons/icon-512.png', 512, svg],
  ['icons/icon-maskable-512.png', 512, square],
  ['icons/apple-touch-icon.png', 180, square],
];

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const page = await browser.newPage();
for (const [file, size, src] of targets) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await writeFile(file, buf);
  console.log('ok', file);
}
await browser.close();
