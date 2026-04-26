import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '644201';
const API_KEY = process.env.BUNNY_API_KEY;
const cwd = process.cwd();
const MAP_FILE = path.join(cwd, 'video-bunny.js');
const APPLY = process.argv.includes('--apply');

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
    if (!res.ok) {
      throw new Error(`Bunny list HTTP ${res.status}`);
    }
    const json = await res.json();
    const items = json.items || [];
    all.push(...items);
    if (items.length < 100) break;
    page += 1;
    await sleep(250);
  }

  return all;
}

async function deleteBunnyVideo(guid) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${guid}`,
    { method: 'DELETE', headers: { AccessKey: API_KEY } }
  );
  return res.ok;
}

async function loadMap(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(raw, sandbox, { timeout: 30000 });
  return sandbox.window.VIDEO_BUNNY || {};
}

function buildKeepGuidSet(map) {
  const guids = new Set();
  for (const value of Object.values(map)) {
    if (!value) continue;
    if (typeof value === 'string') {
      guids.add(value);
      continue;
    }
    const vid = value.vid || value.videoId || value.id;
    if (vid) guids.add(vid);
  }
  return guids;
}

function pickDeletionCandidates(videos, keepGuids) {
  const byTitle = new Map();
  for (const video of videos) {
    const key = normalizeTitle(video.title);
    if (!key) continue;
    const list = byTitle.get(key) || [];
    list.push(video);
    byTitle.set(key, list);
  }

  const toDelete = new Map();

  // Regra 1 (segura): qualquer vídeo NÃO mapeado e claramente inválido.
  for (const video of videos) {
    const isMapped = keepGuids.has(video.guid);
    const size = Number(video.storageSize || 0);
    const status = Number(video.status);
    const broken = size === 0 || status !== 4;

    if (!isMapped && broken) {
      toDelete.set(video.guid, {
        reason: 'unmapped-broken',
        title: video.title || '(sem título)',
        status,
        size,
      });
    }
  }

  // Regra 2 (segura): duplicado NÃO mapeado quando há versão mapeada saudável no mesmo título.
  for (const [titleKey, group] of byTitle.entries()) {
    if (!titleKey || group.length <= 1) continue;

    const mappedHealthy = group.filter((video) => {
      const isMapped = keepGuids.has(video.guid);
      const size = Number(video.storageSize || 0);
      const status = Number(video.status);
      return isMapped && status === 4 && size > 0;
    });

    if (!mappedHealthy.length) continue;

    for (const video of group) {
      const isMapped = keepGuids.has(video.guid);
      if (isMapped) continue;

      toDelete.set(video.guid, {
        reason: 'unmapped-duplicate-of-mapped',
        title: video.title || '(sem título)',
        status: Number(video.status),
        size: Number(video.storageSize || 0),
      });
    }
  }

  return [...toDelete.entries()].map(([guid, data]) => ({ guid, ...data }));
}

async function main() {
  const map = await loadMap(MAP_FILE);
  const keepGuids = buildKeepGuidSet(map);
  const videos = await listAllBunnyVideos();
  const beforeTotal = videos.length;

  const candidates = pickDeletionCandidates(videos, keepGuids);
  const brokenUnmapped = candidates.filter((c) => c.reason === 'unmapped-broken').length;
  const dupUnmapped = candidates.filter((c) => c.reason === 'unmapped-duplicate-of-mapped').length;

  console.log('=== Limpeza Segura Bunny ===');
  console.log(`Modo: ${APPLY ? 'APPLY (apaga)' : 'DRY-RUN (simulação)'}`);
  console.log(`Total no Bunny: ${beforeTotal}`);
  console.log(`GUIDs mapeados (protegidos): ${keepGuids.size}`);
  console.log(`Candidatos para apagar: ${candidates.length}`);
  console.log(`- unmapped-broken: ${brokenUnmapped}`);
  console.log(`- unmapped-duplicate-of-mapped: ${dupUnmapped}`);

  if (!candidates.length) {
    console.log('\nNada para limpar.');
    return;
  }

  console.log('\nPrévia (primeiros 30):');
  for (const item of candidates.slice(0, 30)) {
    console.log(`- ${item.title} | ${item.guid} | ${item.reason} | status=${item.status} size=${item.size}`);
  }

  if (!APPLY) {
    console.log('\nSimulação concluída. Para aplicar de verdade:');
    console.log('node scripts/clean-bunny-safe.mjs --apply');
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const item of candidates) {
    process.stdout.write(`Apagando ${item.guid}... `);
    const ok = await deleteBunnyVideo(item.guid);
    console.log(ok ? 'ok' : 'falhou');
    if (ok) deleted += 1;
    else failed += 1;
    await sleep(250);
  }

  const afterVideos = await listAllBunnyVideos();
  console.log('\n=== Resultado ===');
  console.log(`Apagados: ${deleted}`);
  console.log(`Falhas: ${failed}`);
  console.log(`Total antes: ${beforeTotal}`);
  console.log(`Total depois: ${afterVideos.length}`);
}

main().catch((error) => {
  console.error('Falha:', error);
  process.exit(1);
});
