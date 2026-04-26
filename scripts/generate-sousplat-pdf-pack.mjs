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

function inferFocus(title) {
  const value = String(title || '').toLowerCase();

  if (value.includes('coracao')) {
    return {
      foco: 'Aplicacao de motivos de coracao e distribuicao simetrica',
      cuidado: 'conte os espacos entre motivos para manter alinhamento visual',
    };
  }

  if (value.includes('rendado')) {
    return {
      foco: 'Sequencia de aberturas e pontos altos para efeito rendado',
      cuidado: 'controle a tensao para evitar borda ondulada',
    };
  }

  if (value.includes('floral') || value.includes('margarida')) {
    return {
      foco: 'Montagem de motivos florais e acabamento entre petalas',
      cuidado: 'mantenha repeticao de pontos identica em cada petala',
    };
  }

  if (value.includes('tradicional') || value.includes('base')) {
    return {
      foco: 'Base circular classica com aumentos regulares por carreira',
      cuidado: 'confira o total de pontos ao final de cada volta',
    };
  }

  if (value.includes('porta-copo')) {
    return {
      foco: 'Peca compacta com contorno firme para manter estabilidade',
      cuidado: 'evite excesso de aumentos para nao perder formato',
    };
  }

  return {
    foco: 'Construcao circular com acabamento decorativo final',
    cuidado: 'acompanhe a contagem de pontos para manter a peca plana',
  };
}

function buildMarkdown(title) {
  const { foco, cuidado } = inferFocus(title);

  return `# ${title}
**Nivel:** Iniciante a Intermediario
**Formato:** Apostila tecnica para acompanhamento da videoaula

---

## Objetivo desta apostila

Esta receita foi organizada para ajudar voce a executar a peca com seguranca, sem se perder nas carreiras. O foco tecnico principal desta aula e: **${foco}**.

---

## Materiais e configuracao recomendada

- Fio 100% algodao (principal): 1 cone de 300 a 400 m para sousplat completo
- Fio de detalhe (opcional): 50 a 150 m
- Agulha de croche entre 2,5 mm e 3,5 mm
- Tesoura, agulha de tapecaria e marcador de carreira
- Fita metrica para validar diametro final

### Controle de tensao (gauge)

Antes de iniciar, faca uma amostra curta de 10 x 10 cm no ponto dominante da aula. Se a amostra ficar muito fechada, aumente 0,5 mm na agulha. Se ficar muito aberta, reduza 0,5 mm.

---

## Abreviacoes e leitura de receita

| Abreviacao | Significado |
|------------|-------------|
| corr       | corrente |
| pb         | ponto baixo |
| mpa        | meio ponto alto |
| pa         | ponto alto |
| pp         | ponto baixissimo |
| aum        | aumento |
| dim        | diminuicao |
| carr       | carreira |

Observacao tecnica: em fontes internacionais pode haver diferenca entre termos US e UK. Nesta apostila, mantemos termos em portugues para evitar ambiguidade.

---

## Planejamento da execucao

1. Leia a aula inteira uma vez antes de crochetar.
2. Separe materiais e confirme a combinacao de cores.
3. Defina a meta de diametro final (ex.: 35 a 38 cm para sousplat adulto).
4. Trabalhe com marcador no inicio de toda carreira.
5. Ao final de cada bloco, confira planicidade da peca sobre mesa reta.

---

## Passo a passo detalhado (carreira por carreira)

1. Inicie com anel magico e ajuste o centro para fechamento completo.
2. Execute a carreira inicial da base conforme a aula e marque o inicio.
3. Na carreira seguinte, distribua aumentos de forma regular para manter circulo plano.
4. Continue a expansao da base repetindo a logica de distribuicao apresentada na aula.
5. Sempre que terminar uma carreira, conte os pontos e registre no quadro abaixo.
6. Se a peca encanoar, adicione pontos de alivio na proxima volta.
7. Se a peca ondular, reduza a frequencia de aumentos na volta seguinte.
8. Ao atingir cerca de 70% do diametro final, prepare transicao para parte decorativa.
9. Inicie a sequencia de textura/renda exatamente no ponto de referencia mostrado na aula.
10. Mantenha altura de pontos uniforme para evitar diferenca visual entre setores.
11. Repita o modulo decorativo em toda a circunferencia, sem alterar intervalo.
12. Revise simetria geral antes de iniciar acabamento externo.
13. Trabalhe a borda interna (quando houver) mantendo a mesma tensao da base.
14. Trabalhe a borda externa com cuidado para nao repuxar nem abrir excesso.
15. Aplique detalhes finais (bicos, leques, flores ou coracoes) seguindo ritmo constante.
16. Na troca de cor, puxe a nova cor no ultimo fechamento do ponto anterior.
17. Esconda todos os fios no avesso em percurso de pelo menos 6 a 8 cm.
18. Faca bloqueio leve para assentar pontos e padronizar o diametro.

### Registro rapido por carreira

| Carreira | Contagem esperada | Contagem obtida | Ajuste necessario |
|----------|--------------------|-----------------|-------------------|
| 1 | conforme aula | | |
| 2 | conforme aula | | |
| 3 | conforme aula | | |
| 4 | conforme aula | | |
| 5+ | conforme aula | | |

---

## Erros comuns e correcao imediata

- Centro levantando: excesso de pontos nas primeiras carreiras.
- Borda ondulada: aumento acima do necessario nas voltas finais.
- Borda fechando em cuia: aumentos insuficientes para o diametro atual.
- Motivos desalinhados: falta de marcacao de inicio de carreira.
- Acabamento rigido: tensao excessiva no ponto baixissimo final.

Ponto de atencao desta peca: **${cuidado}**.

---

## Acabamento profissional

1. Lave a peca delicadamente e retire excesso de agua sem torcer.
2. Modele em superficie plana no diametro final.
3. Deixe secar totalmente antes de guardar.
4. Guarde sem dobra acentuada para preservar a borda.

---

## Checklist final de qualidade

- Centro plano e bem fechado
- Contagem de carreiras validada
- Diametro final dentro da meta
- Borda uniforme em 360 graus
- Arremates invisiveis no avesso

---

## Fontes de referencia usadas nesta revisao

- Craft Yarn Council: padronizacao de abreviacoes e boas praticas de leitura de receita.
- Referencias tecnicas gerais de croche sobre gauge/tensao e controle de medidas em trabalho circular.

Esta apostila acompanha a videoaula **${title}** e foi ampliada para oferecer mais clareza tecnica no processo.`;
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
    generatedFolderName: 'Apostilas em PDF das Videoaulas',
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
