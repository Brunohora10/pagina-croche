/**
 * fix-failed-videos.mjs
 * 1. Lista todos os vídeos no Bunny e encontra os com erro (status 5 ou 6)
 * 2. Deleta esses vídeos do Bunny e remove do mapeamento
 * 3. Para todos os vídeos sem mapeamento válido: transmite direto do Drive → Bunny SEM salvar em disco
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '644201';
const API_KEY    = process.env.BUNNY_API_KEY;
const cwd        = process.cwd();
const SOURCE_DATA = process.env.SOURCE_DATA || path.join(cwd, 'app-data.js');
const OUT_MAP     = process.env.OUT_MAP     || path.join(cwd, 'video-bunny.js');

if (!API_KEY) {
  console.error('❌ BUNNY_API_KEY não definida no .env');
  process.exit(1);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function getResourceKey(item) {
  if (!item?.u) return '';
  try { return new URL(item.u).searchParams.get('resourcekey') || ''; } catch { return ''; }
}

// ─── Bunny API ────────────────────────────────────────────────────────────────

async function listAllBunnyVideos() {
  let page = 1, all = [];
  while (true) {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos?page=${page}&itemsPerPage=100&orderBy=date`,
      { headers: { AccessKey: API_KEY } }
    );
    if (!res.ok) throw new Error(`Bunny list HTTP ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const items = json.items || [];
    all.push(...items);
    if (items.length < 100) break;
    page++;
    await sleep(300);
  }
  return all;
}

async function deleteBunnyVideo(videoId) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`,
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
  if (!json.guid) throw new Error(`Sem GUID na resposta: ${JSON.stringify(json)}`);
  return json.guid;
}

async function uploadFileToBunny(videoId, driveItem) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const rk      = getResourceKey(driveItem);
  const id      = encodeURIComponent(driveItem.i);
  const rkParam = rk ? `&resourcekey=${encodeURIComponent(rk)}` : '';

  // Tenta obter stream do Drive com confirmação (suporte ao novo formato de aviso de vírus)
  async function getDriveStream() {
    const baseUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0${rkParam}`;

    // Tentativa 1: download direto com confirm=t
    const res1 = await fetch(`${baseUrl}&confirm=t`, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const ct1  = res1.headers.get('content-type') || '';
    if (!ct1.includes('text/html') && res1.ok) return res1;

    // Tentativa 2: pegar a página de aviso e extrair UUID/confirm token
    const rawCookies = res1.headers.get('set-cookie') || '';
    const html = await res1.text();
    const cookieHdr = rawCookies.split(/,(?=[^;]+=[^;]+;)/).map((c) => c.split(';')[0].trim()).join('; ');

    // Novo formato do Drive: extrai uuid da URL completa embutida no HTML
    const uuidMatch = html.match(/[?&]uuid=([a-zA-Z0-9_-]+)/);
    if (uuidMatch) {
      const url2 = `${baseUrl}&confirm=t&uuid=${uuidMatch[1]}`;
      const res2 = await fetch(url2, { headers: { 'User-Agent': UA, Cookie: cookieHdr }, redirect: 'follow' });
      const ct2 = res2.headers.get('content-type') || '';
      if (!ct2.includes('text/html') && res2.ok) return res2;
    }

    // Formato antigo: extrai confirm token
    const confirmMatch = html.match(/[?&]confirm=([a-zA-Z0-9_-]+)/);
    const confirm = confirmMatch ? confirmMatch[1] : 't';
    const url3 = `https://drive.google.com/uc?export=download&id=${id}${rkParam}&confirm=${confirm}`;
    const res3 = await fetch(url3, { headers: { 'User-Agent': UA, Cookie: cookieHdr }, redirect: 'follow' });
    const ct3 = res3.headers.get('content-type') || '';
    if (!ct3.includes('text/html') && res3.ok) return res3;

    throw new Error('Drive retornou HTML — arquivo privado ou link expirado');
  }

  const driveRes = await getDriveStream();
  const contentLength = driveRes.headers.get('content-length');
  const sizeMB = contentLength ? `${Math.round(Number(contentLength) / 1024 / 1024)}MB` : '?MB';
  process.stdout.write(`[${sizeMB}] `);

  // Transmite direto do Drive → Bunny sem salvar em disco
  const bunnyRes = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`,
    {
      method: 'PUT',
      headers: {
        AccessKey: API_KEY,
        'Content-Type': 'application/octet-stream',
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
      },
      body: driveRes.body,
      duplex: 'half',
    }
  );
  return bunnyRes.ok;
}

// ─── App Data / Mapeamento ────────────────────────────────────────────────────

async function loadAppData(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const sandbox = { globalThis: {} };
  vm.createContext(sandbox);
  vm.runInContext(`${raw}\nglobalThis.__APPDATA__ = { ROOT, TREE, ITEMS };`, sandbox, { timeout: 120000 });
  return sandbox.globalThis.__APPDATA__;
}

async function loadExistingMap(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(raw, sandbox, { timeout: 120000 });
    return sandbox.window.VIDEO_BUNNY || {};
  } catch { return {}; }
}

async function saveMap(filePath, map) {
  const header = `// Gerado automaticamente por scripts/fix-failed-videos.mjs\n// Chave: Drive file id | Valor: { lib, vid }\n`;
  await fs.writeFile(filePath, `${header}\nwindow.VIDEO_BUNNY = ${JSON.stringify(map, null, 2)};\n`, 'utf8');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Correção e reenvio de vídeos para o Bunny ===\n');

  // Catálogo
  const appData   = await loadAppData(SOURCE_DATA);
  const allVideos = Object.values(appData.ITEMS || {}).filter((x) => x?.m === 'v');
  console.log(`Catálogo: ${allVideos.length} vídeos`);

  // Mapeamento atual
  const map = await loadExistingMap(OUT_MAP);
  console.log(`Mapeados: ${Object.keys(map).length}`);

  // Lista Bunny
  console.log('Consultando biblioteca Bunny...');
  const bunnyVideos = await listAllBunnyVideos();
  const bunnyByGuid = new Map(bunnyVideos.map((v) => [v.guid, v]));
  console.log(`Bunny: ${bunnyVideos.length} vídeos\n`);

  // Mapa reverso: guid → driveId
  const reverseMap = new Map();
  for (const [driveId, val] of Object.entries(map)) {
    const vid = typeof val === 'object' ? val.vid : String(val);
    if (vid) reverseMap.set(vid, driveId);
  }

  // 1. Deletar vídeos com erro (status 5 ou 6) do Bunny + remover do mapa
  let removedCount = 0;
  for (const bv of bunnyVideos) {
    const isFailed = bv.status === 5 || bv.status === 6;
    if (!isFailed) continue;

    const driveId = reverseMap.get(bv.guid);
    process.stdout.write(`❌ Removendo falho: "${bv.title || bv.guid}" (status=${bv.status}) ... `);
    const ok = await deleteBunnyVideo(bv.guid);
    console.log(ok ? 'deletado' : 'falhou ao deletar');
    if (driveId) delete map[driveId];
    removedCount++;
    await sleep(400);
  }

  // 2. Remover do mapa entradas que apontam para GUIDs inexistentes no Bunny
  for (const [driveId, val] of Object.entries({ ...map })) {
    const vid = typeof val === 'object' ? val.vid : String(val);
    if (!bunnyByGuid.has(vid)) {
      console.log(`⚠️  Mapeamento inválido removido: ${driveId} → ${vid}`);
      delete map[driveId];
      removedCount++;
    }
  }

  if (removedCount > 0) {
    await saveMap(OUT_MAP, map);
    console.log(`\n${removedCount} entradas corrigidas no mapeamento.\n`);
  }

  // 3. Processar vídeos sem mapeamento válido
  const toProcess = allVideos.filter((v) => !map[v.i]);
  console.log(`Vídeos para reenviar (upload direto): ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('✅ Todos os vídeos estão ok no Bunny!');
    return;
  }

  let ok = 0, fail = 0;
  const failures = [];

  for (let i = 0; i < toProcess.length; i++) {
    const item  = toProcess[i];
    const title = item.n || `video-${item.i}`;
    console.log(`\n[${i + 1}/${toProcess.length}] ${title}`);

    try {
      process.stdout.write('  📦 Criando no Bunny... ');
      const videoId = await createBunnyVideo(title);
      console.log(videoId);

      process.stdout.write('  📡 Transmitindo Drive → Bunny (sem disco)... ');
      const uploaded = await uploadFileToBunny(videoId, item);
      if (!uploaded) throw new Error('PUT retornou não-ok');
      console.log('✅ OK');

      map[item.i] = { lib: LIBRARY_ID, vid: videoId };
      await saveMap(OUT_MAP, map);
      ok++;

    } catch (err) {
      console.log(`\n  ❌ ERRO: ${err.message}`);
      failures.push({ title, id: item.i, err: err.message });
      fail++;
    }

    await sleep(800);
  }

  await saveMap(OUT_MAP, map);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Concluído: ${ok} enviados com sucesso | ❌ ${fail} erros`);

  if (failures.length > 0) {
    console.log('\nVídeos que falharam (podem precisar de atenção manual):');
    failures.forEach((f) => console.log(`  - ${f.title}: ${f.err}`));
  }

  console.log('\nMapa salvo em:', OUT_MAP);
}

main().catch((err) => {
  console.error('Falha geral:', err);
  process.exit(1);
});
