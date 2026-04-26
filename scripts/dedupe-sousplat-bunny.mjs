import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '644201';
const API_KEY = process.env.BUNNY_API_KEY;
const SA_FILE = process.env.DRIVE_SERVICE_ACCOUNT_FILE;
const cwd = process.cwd();
const OUT_MAP = path.join(cwd, 'video-bunny.js');
const SOUSPLAT_FOLDER_ID = '1dd-uWkZ5nHT5Jy9kTwpG_9k_lIEdMRmv';

if (!API_KEY) throw new Error('BUNNY_API_KEY não definida no .env');
if (!SA_FILE) throw new Error('DRIVE_SERVICE_ACCOUNT_FILE não definida no .env');

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getDriveAuth() {
  const keys = JSON.parse(await fs.readFile(SA_FILE, 'utf8'));
  return new google.auth.GoogleAuth({
    credentials: keys,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
}

async function listDriveFiles(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  let files = [];
  let pageToken = null;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, size, mimeType)',
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function loadExistingMap(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(raw, sandbox, { timeout: 30000 });
  return sandbox.window.VIDEO_BUNNY || {};
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
    page++;
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

function scoreVideo(video, preferredGuid) {
  const isPreferred = video.guid === preferredGuid ? 1000000 : 0;
  const isReady = Number(video.status) === 4 ? 100000 : 0;
  const hasBytes = Number(video.storageSize || 0) > 0 ? 10000 : 0;
  const size = Number(video.storageSize || 0);
  return isPreferred + isReady + hasBytes + size;
}

async function main() {
  console.log('=== Limpeza de duplicados de sousplat no Bunny ===\n');

  const auth = await getDriveAuth();
  const driveFiles = await listDriveFiles(auth, SOUSPLAT_FOLDER_ID);
  const driveVideos = driveFiles.filter((file) => file.mimeType?.startsWith('video/') || file.name?.endsWith('.mp4'));
  const driveIds = new Set(driveVideos.map((file) => file.id));

  const map = await loadExistingMap(OUT_MAP);
  const desiredEntries = Object.entries(map).filter(([driveId]) => driveIds.has(driveId));
  const desiredGuidByDriveId = new Map(desiredEntries.map(([driveId, value]) => [driveId, value.vid]));
  const desiredGuidSet = new Set([...desiredGuidByDriveId.values()]);

  console.log(`Drive sousplat: ${driveVideos.length} vídeos`);
  console.log(`Mapeados em video-bunny.js: ${desiredGuidSet.size} vídeos\n`);

  const bunnyVideos = await listAllBunnyVideos();
  const bunnyByGuid = new Map(bunnyVideos.map((video) => [video.guid, video]));

  const desiredTitleGroups = new Map();
  for (const file of driveVideos) {
    const guid = desiredGuidByDriveId.get(file.id);
    if (!guid) continue;
    const desiredVideo = bunnyByGuid.get(guid);
    const titleKey = normalizeTitle(desiredVideo?.title || file.name);
    const list = desiredTitleGroups.get(titleKey) || [];
    list.push({ file, guid, desiredVideo });
    desiredTitleGroups.set(titleKey, list);
  }

  const toDelete = [];

  for (const [titleKey, entries] of desiredTitleGroups.entries()) {
    const title = entries[0].desiredVideo?.title || entries[0].file.name;
    const candidates = bunnyVideos.filter((video) => normalizeTitle(video.title) === titleKey);
    if (candidates.length <= 1) continue;

    const preferredGuid = entries[entries.length - 1].guid;
    const sorted = [...candidates].sort((left, right) => scoreVideo(right, preferredGuid) - scoreVideo(left, preferredGuid));
    const keep = sorted[0];
    const extras = sorted.slice(1);

    console.log(`Duplicado: ${title}`);
    console.log(`  manter: ${keep.guid} status=${keep.status} size=${keep.storageSize || 0}`);

    for (const extra of extras) {
      console.log(`  apagar: ${extra.guid} status=${extra.status} size=${extra.storageSize || 0}`);
      toDelete.push(extra.guid);
    }
  }

  const staleProblems = bunnyVideos.filter((video) => {
    if (desiredGuidSet.has(video.guid)) return false;
    if (!/sousplat|souplat|premium|coracoes|fruta|melancia/i.test(video.title || '')) return false;
    return Number(video.storageSize || 0) === 0 || Number(video.status) !== 4;
  });

  for (const video of staleProblems) {
    if (toDelete.includes(video.guid)) continue;
    console.log(`Problema antigo: apagar ${video.title} | ${video.guid} | status=${video.status} size=${video.storageSize || 0}`);
    toDelete.push(video.guid);
  }

  if (toDelete.length === 0) {
    console.log('\nNada para apagar.');
    return;
  }

  console.log(`\nApagando ${toDelete.length} entradas extras/problemáticas...\n`);
  let deleted = 0;
  for (const guid of toDelete) {
    process.stdout.write(`- ${guid}... `);
    const ok = await deleteBunnyVideo(guid);
    console.log(ok ? 'ok' : 'falhou');
    if (ok) deleted++;
    await sleep(250);
  }

  const finalVideos = await listAllBunnyVideos();
  const finalDesired = finalVideos.filter((video) => desiredGuidSet.has(video.guid));
  const finalProblems = finalDesired.filter((video) => Number(video.storageSize || 0) === 0 || Number(video.status) !== 4);

  console.log('\n=== Resultado final ===');
  console.log(`Apagados: ${deleted}/${toDelete.length}`);
  console.log(`Sousplats canônicos no Bunny: ${finalDesired.length}`);
  console.log(`Canônicos ainda processando/com problema: ${finalProblems.length}`);
  for (const video of finalProblems) {
    console.log(`- ${video.title} | ${video.guid} | status=${video.status} size=${video.storageSize || 0}`);
  }
}

main().catch((error) => {
  console.error('Falha:', error);
  process.exit(1);
});