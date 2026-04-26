import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const ROOT_SOUSPLAT_FOLDER_ID = '1OvjIyd9dd_6IhvUjW-v-wRsQ2u_u2-CS';
const SOUSPLAT_VIDEO_FOLDER_ID = '1dd-uWkZ5nHT5Jy9kTwpG_9k_lIEdMRmv';
const GENERATED_FOLDER_ID = 'pdfgen_sousplat_folder';

const cwd = process.cwd();
const appDataPath = path.join(cwd, 'app-data.js');
const receitasDir = path.join(cwd, 'receitas');
const overridesPath = path.join(cwd, 'app-data-pdf-overrides.js');

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildMarkdown(title) {
  return `# ${title}\n**Nível:** Iniciante a Intermediário\n**Formato:** Receita guiada da videoaula\n\n---\n\n## Materiais sugeridos\n\n- Fio de algodão para sousplat (cor principal)\n- Fio de algodão para detalhes (opcional)\n- Agulha de crochê 2,5 mm a 3,5 mm\n- Tesoura\n- Agulha de tapeçaria para arremates\n- Marcador de ponto\n\n---\n\n## Abreviações\n\n| Abreviação | Significado |\n|------------|-------------|\n| corr       | corrente    |\n| pb         | ponto baixo |\n| pa         | ponto alto  |\n| pp         | ponto baixíssimo |\n| aum        | aumento     |\n\n---\n\n## Passo a passo completo\n\n1. Separe todos os materiais e defina a paleta de cores da peça.\n2. Inicie com anel mágico e faça a base circular inicial conforme demonstrado na aula.\n3. Trabalhe as primeiras carreiras com aumentos distribuídos para manter o círculo plano.\n4. Marque o início de cada carreira para não perder a contagem.\n5. Continue a expansão da base alternando carreiras de aumento e de estabilização.\n6. Ao atingir o diâmetro principal, inicie a parte decorativa do sousplat.\n7. Execute a sequência de pontos de textura/renda da aula mantendo tensão uniforme.\n8. Faça os detalhes de borda (bicos, leques ou acabamento rendado) no ritmo da videoaula.\n9. Revise toda a circunferência para garantir simetria e bom caimento da peça.\n10. Arremate os fios pelo avesso com agulha de tapeçaria para acabamento limpo.\n11. Se necessário, faça bloqueio da peça para abrir os pontos e acertar o formato final.\n12. Finalize com inspeção visual: centro plano, borda regular e tamanho uniforme.\n\n---\n\n## Checklist de qualidade\n\n- Centro sem embabadar\n- Aumentos equilibrados\n- Borda regular em toda a volta\n- Arremates invisíveis\n- Peça plana e pronta para uso\n\n---\n\n## Observação\n\nEste PDF foi estruturado para acompanhamento direto da videoaula **${title}**, facilitando a execução passo a passo durante o aprendizado.`;
}

async function loadAppData() {
  const raw = await fs.readFile(appDataPath, 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${raw};this.TREE=TREE;this.ITEMS=ITEMS;this.ROOT=ROOT;`, sandbox, {
    timeout: 60000,
  });
  return { TREE: sandbox.TREE || {}, ITEMS: sandbox.ITEMS || {} };
}

async function main() {
  const { TREE } = await loadAppData();
  const videos = (TREE[SOUSPLAT_VIDEO_FOLDER_ID] || []).filter((item) => item && item.m === 'v');

  if (!videos.length) {
    throw new Error('Nenhum video encontrado na pasta de sousplat para gerar PDFs.');
  }

  await fs.mkdir(receitasDir, { recursive: true });

  const generated = [];
  for (const video of videos) {
    const baseSlug = slugify(video.n) || `sousplat-${video.i}`;
    const mdFile = `sousplat-${baseSlug}-${video.i}.md`;
    const pdfFile = `sousplat-${baseSlug}-${video.i}.pdf`;
    const mdPath = path.join(receitasDir, mdFile);
    await fs.writeFile(mdPath, buildMarkdown(video.n), 'utf8');

    generated.push({
      videoId: video.i,
      title: video.n,
      pdfItemId: `pdfgen_${video.i}`,
      pdfUrl: `receitas/pdfs/${pdfFile}`,
    });
  }

  const payload = {
    rootFolderId: ROOT_SOUSPLAT_FOLDER_ID,
    generatedFolderId: GENERATED_FOLDER_ID,
    generatedFolderName: 'PDFs Gerados das Videoaulas',
    items: generated,
  };

  const payloadJson = JSON.stringify(payload, null, 2);
  const overridesSource = [
    '// Arquivo gerado automaticamente por scripts/generate-sousplat-pdf-pack.mjs',
    '(function () {',
    "  if (typeof TREE === 'undefined' || typeof ITEMS === 'undefined') return;",
    '',
    `  const payload = ${payloadJson};`,
    '',
    '  const rootId = payload.rootFolderId;',
    '  const folderId = payload.generatedFolderId;',
    '  const folderName = payload.generatedFolderName;',
    '',
    '  if (!Array.isArray(TREE[rootId])) TREE[rootId] = [];',
    '  if (!Array.isArray(TREE[folderId])) TREE[folderId] = [];',
    '',
    '  const folderExists = TREE[rootId].some((item) => item && item.i === folderId);',
    '  if (!folderExists) {',
    "    const folderItem = { i: folderId, p: rootId, n: folderName, m: 'f', u: '', s: null };",
    '    TREE[rootId].push(folderItem);',
    '    ITEMS[folderId] = folderItem;',
    '  }',
    '',
    '  const existingById = new Set((TREE[folderId] || []).map((item) => item && item.i));',
    '',
    '  payload.items.forEach((entry) => {',
    '    if (existingById.has(entry.pdfItemId)) return;',
    '',
    '    const item = {',
    '      i: entry.pdfItemId,',
    '      p: folderId,',
    "      n: entry.title + ' (PDF)',",
    "      m: 'pdf',",
    '      u: entry.pdfUrl,',
    '      s: null',
    '    };',
    '',
    '    TREE[folderId].push(item);',
    '    ITEMS[item.i] = item;',
    '  });',
    '})();',
    '',
  ].join('\n');

  await fs.writeFile(overridesPath, overridesSource, 'utf8');

  console.log(`Videos de sousplat detectados: ${videos.length}`);
  console.log(`Markdowns gerados em receitas/: ${videos.length}`);
  console.log(`Arquivo de integracao atualizado: app-data-pdf-overrides.js`);
}

main().catch((error) => {
  console.error('Falha ao gerar pacote de PDFs:', error.message || error);
  process.exit(1);
});
