import fs from 'fs';

const bunnyRaw = fs.readFileSync('video-bunny.js', 'utf8')
  .replace('window.VIDEO_BUNNY =', 'const VB =')
  .replace(/;\s*$/, '');

const VB = eval(`(${bunnyRaw.replace('const VB =', '')})`);
const mapped = new Set(Object.keys(VB));

const appRaw = fs.readFileSync('app-data.js', 'utf8');
const itemsMatch = appRaw.match(/const ITEMS = (\{.+\});/);
const ITEMS = JSON.parse(itemsMatch[1]);

const failed = Object.values(ITEMS).filter(it => it.m === 'v' && !mapped.has(it.i));
console.log(`Videos sem mapeamento (falharam): ${failed.length}\n`);
failed.forEach(v => {
  console.log(`${v.n}`);
  console.log(`  https://drive.google.com/file/d/${v.i}/view`);
});
