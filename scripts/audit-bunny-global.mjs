import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '644201';
const API_KEY = process.env.BUNNY_API_KEY;
const cwd = process.cwd();
const MAP_FILE = path.join(cwd, 'video-bunny.js');

if (!API_KEY) {
  console.error('BUNNY_API_KEY não definida no .env');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function listAllBunnyVideos() {
  let page = 1;
  const all = [];
  while (true) {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos?page=${page}&itemsPerPage=100&orderBy=date`,
      { headers: { AccessKey: API_KEY } }
    );
    if (!res.ok) throw new Error(`Bunny list HTTP ${res.status}`);
    const json = await res.json();
    const items = json.items || [];
    all.push(...items);
    if (items.length < 100) break;
    page += 1;
    await sleep(250);
  }
  return all;
}

async function loadMap(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(raw, sandbox, { timeout: 30000 });
  return sandbox.window.VIDEO_BUNNY || {};
}

async function main() {
  const map = await loadMap(MAP_FILE);
  const mappedEntries = Object.entries(map);
  const mappedGuids = new Set(
    mappedEntries
      .map(([, value]) => (typeof value === 'object' ? value.vid : String(value)))
      .filter(Boolean)
  );

  const bunnyVideos = await listAllBunnyVideos();
  const total = bunnyVideos.length;
  const mappedPresent = bunnyVideos.filter((video) => mappedGuids.has(video.guid)).length;
  const unmapped = bunnyVideos.filter((video) => !mappedGuids.has(video.guid));
  const problematic = bunnyVideos.filter((video) => Number(video.storageSize || 0) === 0 || Number(video.status) !== 4);

  const titleGroups = new Map();
  for (const video of bunnyVideos) {
    const key = normalizeTitle(video.title);
    if (!key) continue;
    const list = titleGroups.get(key) || [];
    list.push(video);
    titleGroups.set(key, list);
  }
  const duplicates = [...titleGroups.entries()]
    .filter(([, list]) => list.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('=== Auditoria Bunny (Global) ===');
  console.log(`Total no Bunny: ${total}`);
  console.log(`Total mapeado no video-bunny.js: ${mappedGuids.size}`);
  console.log(`Mapeados e presentes no Bunny: ${mappedPresent}`);
  console.log(`Sobras no Bunny (sem uso no site): ${unmapped.length}`);
  console.log(`Com problema (status != 4 ou 0 bytes): ${problematic.length}`);
  console.log(`Títulos duplicados: ${duplicates.length}`);

  if (duplicates.length) {
    console.log('\nTop 20 títulos duplicados:');
    for (const [key, list] of duplicates.slice(0, 20)) {
      const ready = list.filter((x) => Number(x.status) === 4).length;
      console.log(`- ${list[0].title} | ocorrências=${list.length} | prontos=${ready}`);
    }
  }

  if (problematic.length) {
    console.log('\nTop 20 com problema:');
    for (const item of problematic.slice(0, 20)) {
      console.log(`- ${item.title} | guid=${item.guid} | status=${item.status} | size=${item.storageSize || 0}`);
    }
  }
}

main().catch((error) => {
  console.error('Falha:', error);
  process.exit(1);
});
