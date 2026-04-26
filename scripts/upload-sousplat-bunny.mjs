/**
 * upload-sousplat-bunny.mjs
 * Sobe os vídeos de sousplat para o Bunny usando a API do Drive (service account)
 * — evita o limite de banda pública do Google
 */

import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { Transform } from 'node:stream';

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '644201';
const API_KEY    = process.env.BUNNY_API_KEY;
const SA_FILE    = process.env.DRIVE_SERVICE_ACCOUNT_FILE;
const cwd        = process.cwd();
const OUT_MAP    = path.join(cwd, 'video-bunny.js');
const SOURCE_DATA = path.join(cwd, 'app-data.js');

// IDs das pastas de sousplat (videos)
const SOUSPLAT_FOLDER_ID = '1dd-uWkZ5nHT5Jy9kTwpG_9k_lIEdMRmv';

if (!API_KEY) { console.error('❌ BUNNY_API_KEY não definida no .env'); process.exit(1); }
if (!SA_FILE) { console.error('❌ DRIVE_SERVICE_ACCOUNT_FILE não definida no .env'); process.exit(1); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Drive API (service account) ─────────────────────────────────────────────

async function getDriveAuth() {
  const keys = JSON.parse(await fs.readFile(SA_FILE, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keys,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return auth;
}

async function getDriveFileStream(auth, fileId) {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return res;
}

async function getDriveFilesMeta(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  let files = [], pageToken = null;
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

// ─── Bunny API ────────────────────────────────────────────────────────────────

async function listAllBunnyVideos() {
  let page = 1, all = [];
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
    await sleep(300);
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

async function createBunnyVideo(title) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`,
    {
      method: 'POST',
      headers: { AccessKey: API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }
  );
  if (!res.ok) throw new Error(`Criar vídeo HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.guid;
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function reportSousplatAudit(bunnyVideos) {
  const sousplats = bunnyVideos.filter((bv) =>
    /sousplat|souplat|cora[cç][aã]o|coracoes|fruta|melancia|premium/i.test(bv.title || '')
  );

  const duplicateMap = new Map();
  for (const video of sousplats) {
    const key = normalizeTitle(video.title);
    if (!key) continue;
    const list = duplicateMap.get(key) || [];
    list.push(video);
    duplicateMap.set(key, list);
  }

  const duplicates = [...duplicateMap.values()].filter((items) => items.length > 1);
  const stuck = sousplats.filter((video) => Number(video.storageSize || 0) === 0 || video.status !== 4);

  console.log('\n📊 Auditoria final Bunny (sousplats)');
  console.log(`   Total no Bunny: ${sousplats.length}`);
  console.log(`   Duplicados por título: ${duplicates.length}`);
  console.log(`   Travados/0 bytes: ${stuck.length}`);

  if (duplicates.length > 0) {
    console.log('\nDuplicados encontrados:');
    for (const items of duplicates) {
      console.log(`  - ${items[0].title}`);
      for (const item of items) {
        console.log(`    guid=${item.guid} status=${item.status} size=${item.storageSize || 0}`);
      }
    }
  }

  if (stuck.length > 0) {
    console.log('\nSousplats com problema:');
    for (const item of stuck) {
      console.log(`  - ${item.title} | guid=${item.guid} | status=${item.status} | size=${item.storageSize || 0}`);
    }
  }
}

async function uploadStreamToBunny(videoId, stream, sizeBytes) {
  const { Readable } = await import('node:stream');
  const nodeStream = stream.data || stream;
  const startedAt = Date.now();
  let uploadedBytes = 0;
  let lastPrintedAt = 0;

  const progressStream = new Transform({
    transform(chunk, encoding, callback) {
      uploadedBytes += chunk.length;
      const now = Date.now();
      if (now - lastPrintedAt >= 2000) {
        const elapsedSec = Math.max((now - startedAt) / 1000, 1);
        const uploadedMB = (uploadedBytes / 1024 / 1024).toFixed(1);
        const speedMBs = (uploadedBytes / 1024 / 1024 / elapsedSec).toFixed(2);
        if (sizeBytes) {
          const totalMB = (sizeBytes / 1024 / 1024).toFixed(1);
          const percent = ((uploadedBytes / sizeBytes) * 100).toFixed(1);
          process.stdout.write(`\r  📡 Drive API → Bunny... ${percent}% (${uploadedMB}/${totalMB} MB @ ${speedMBs} MB/s)`);
        } else {
          process.stdout.write(`\r  📡 Drive API → Bunny... ${uploadedMB} MB enviados @ ${speedMBs} MB/s`);
        }
        lastPrintedAt = now;
      }
      callback(null, chunk);
    },
    flush(callback) {
      const elapsedSec = Math.max((Date.now() - startedAt) / 1000, 1);
      const uploadedMB = (uploadedBytes / 1024 / 1024).toFixed(1);
      const speedMBs = (uploadedBytes / 1024 / 1024 / elapsedSec).toFixed(2);
      if (sizeBytes) {
        const totalMB = (sizeBytes / 1024 / 1024).toFixed(1);
        process.stdout.write(`\r  📡 Drive API → Bunny... 100.0% (${uploadedMB}/${totalMB} MB @ ${speedMBs} MB/s)`);
      } else {
        process.stdout.write(`\r  📡 Drive API → Bunny... ${uploadedMB} MB enviados @ ${speedMBs} MB/s`);
      }
      callback();
    },
  });

  const trackedStream = nodeStream.pipe(progressStream);
  const webStream = Readable.toWeb(trackedStream);

  const res = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`,
    {
      method: 'PUT',
      headers: {
        AccessKey: API_KEY,
        'Content-Type': 'application/octet-stream',
        ...(sizeBytes ? { 'Content-Length': String(sizeBytes) } : {}),
      },
      body: webStream,
      duplex: 'half',
    }
  );
  process.stdout.write('\n');
  return res.ok;
}

// ─── App data / mapeamento ────────────────────────────────────────────────────

async function loadExistingMap() {
  try {
    const raw = await fs.readFile(OUT_MAP, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(raw, sandbox, { timeout: 30000 });
    return sandbox.window.VIDEO_BUNNY || {};
  } catch { return {}; }
}

async function loadAppData() {
  const raw = await fs.readFile(SOURCE_DATA, 'utf8');
  const sandbox = { globalThis: {} };
  vm.createContext(sandbox);
  vm.runInContext(`${raw}\nglobalThis.__D__ = { ROOT, TREE, ITEMS };`, sandbox, { timeout: 120000 });
  return sandbox.globalThis.__D__;
}

async function saveMap(map) {
  const header = `// Gerado automaticamente\n// Chave: Drive file id | Valor: { lib, vid }\n`;
  await fs.writeFile(OUT_MAP, `${header}\nwindow.VIDEO_BUNNY = ${JSON.stringify(map, null, 2)};\n`, 'utf8');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Upload Sousplat → Bunny (via API Drive) ===\n');

  const auth = await getDriveAuth();
  console.log('✅ Autenticado no Drive via service account');

  // Lista arquivos na pasta de vídeos sousplat
  console.log('📂 Listando vídeos na pasta sousplat do Drive...');
  const driveFiles = await getDriveFilesMeta(auth, SOUSPLAT_FOLDER_ID);
  const videos = driveFiles.filter(f => f.mimeType?.startsWith('video/') || f.name?.endsWith('.mp4'));
  console.log(`   ${videos.length} vídeos encontrados\n`);

  // Lista vídeos no Bunny
  console.log('🐰 Consultando Bunny...');
  const bunnyVideos = await listAllBunnyVideos();
  console.log(`   ${bunnyVideos.length} vídeos no Bunny\n`);

  // Detecta e remove vídeos travados em 0 bytes com nome de sousplat
  console.log('🔍 Verificando vídeos travados (0 bytes) de sousplat...');
  const stuckSousplats = bunnyVideos.filter(bv =>
    bv.storageSize === 0 &&
    bv.status !== 4 &&  // não é "Finished"
    /sousplat|souplat|coração|coracoes|fruta|melancia|premium/i.test(bv.title || '')
  );

  if (stuckSousplats.length > 0) {
    console.log(`   ${stuckSousplats.length} vídeos travados para limpar:`);
    for (const bv of stuckSousplats) {
      process.stdout.write(`   ❌ Deletando "${bv.title}" (status=${bv.status}, 0 bytes)... `);
      const ok = await deleteBunnyVideo(bv.guid);
      console.log(ok ? '✓' : 'FALHOU');
      await sleep(300);
    }
    console.log('');
  } else {
    console.log('   Nenhum travado encontrado.\n');
  }

  // Mapeamento atual
  const map = await loadExistingMap();
  const appData = await loadAppData();
  const allDriveVideoItems = Object.values(appData.ITEMS || {}).filter(x => x?.m === 'v');
  const itemById = new Map(allDriveVideoItems.map((item) => [item.i, item]));

  // Usa todos os vídeos encontrados na pasta do Drive.
  // Se o arquivo já existir no catálogo, preserva o nome de lá; caso contrário, usa o nome do Drive.
  const sousplatItems = videos.map((file) => {
    const catalogItem = itemById.get(file.id);
    return catalogItem || {
      i: file.id,
      n: file.name,
      m: 'v',
      p: SOUSPLAT_FOLDER_ID,
    };
  });
  const toUpload = sousplatItems.filter((item) => !map[item.i]);

  console.log(`📋 Vídeos na pasta sousplat do Drive: ${sousplatItems.length}`);
  console.log(`📤 Para fazer upload: ${toUpload.length}\n`);

  if (toUpload.length === 0) {
    console.log('✅ Todos os vídeos da pasta de sousplat do Drive já estão mapeados no Bunny!');
    return;
  }

  let ok = 0, fail = 0;

  for (let i = 0; i < toUpload.length; i++) {
    const item = toUpload[i];
    const title = item.n || `sousplat-${item.i}`;
    const driveMeta = videos.find(f => f.id === item.i);
    const sizeBytes = driveMeta?.size ? Number(driveMeta.size) : null;
    const sizeMB = sizeBytes ? `${Math.round(sizeBytes / 1024 / 1024)}MB` : '?MB';

    console.log(`\n[${i + 1}/${toUpload.length}] ${title} (${sizeMB})`);

    try {
      process.stdout.write('  📦 Criando no Bunny... ');
      const videoId = await createBunnyVideo(title);
      console.log(videoId);

      process.stdout.write('  📡 Drive API → Bunny... ');
      const driveStream = await getDriveFileStream(auth, item.i);
      const uploaded = await uploadStreamToBunny(videoId, driveStream, sizeBytes);

      if (!uploaded) throw new Error('PUT retornou não-ok');
      console.log('✅ OK');

      map[item.i] = { lib: LIBRARY_ID, vid: videoId };
      await saveMap(map);
      ok++;
    } catch (err) {
      console.log(`\n  ❌ ERRO: ${err.message}`);
      fail++;
    }

    await sleep(500);
  }

  await saveMap(map);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ ${ok} enviados | ❌ ${fail} erros`);
  console.log('Mapa salvo em:', OUT_MAP);

  const finalBunnyVideos = await listAllBunnyVideos();
  reportSousplatAudit(finalBunnyVideos);
}

main().catch(err => { console.error('Falha:', err); process.exit(1); });
