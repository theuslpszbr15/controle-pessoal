// Copia as bibliotecas de node_modules para vendor/ (o app roda offline e sem bundler).
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = [
  ['node_modules/three/build/three.module.min.js', 'vendor/three.module.min.js'],
  ['node_modules/three/build/three.core.min.js', 'vendor/three.core.min.js'],
  ['node_modules/matter-js/build/matter.min.js', 'vendor/matter.min.js'],
  ['node_modules/gsap/dist/gsap.min.js', 'vendor/gsap.min.js'],
];

mkdirSync('vendor/firebase', { recursive: true });
for (const [from, to] of files) {
  cpSync(from, to);
  console.log(`${from} -> ${to}`);
}

// Builds ESM do Firebase importam o app pelo CDN; apontamos para a cópia local.
for (const name of ['app', 'auth', 'firestore']) {
  const src = readFileSync(`node_modules/firebase/firebase-${name}.js`, 'utf8')
    .replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-app\.js/g, './firebase-app.js')
    .replace(/\/\/# sourceMappingURL=.*$/m, '');
  writeFileSync(`vendor/firebase/firebase-${name}.js`, src);
  console.log(`firebase-${name}.js -> vendor/firebase/`);
}
