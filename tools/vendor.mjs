// Copia as bibliotecas de node_modules para vendor/ (o app roda offline e sem bundler).
import { cpSync, mkdirSync } from 'node:fs';

const files = [
  ['node_modules/three/build/three.module.min.js', 'vendor/three.module.min.js'],
  ['node_modules/three/build/three.core.min.js', 'vendor/three.core.min.js'],
  ['node_modules/matter-js/build/matter.min.js', 'vendor/matter.min.js'],
  ['node_modules/gsap/dist/gsap.min.js', 'vendor/gsap.min.js'],
];

mkdirSync('vendor', { recursive: true });
for (const [from, to] of files) {
  cpSync(from, to);
  console.log(`${from} -> ${to}`);
}
