import { mdToPdf } from 'md-to-pdf';
import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const receitasDir = path.join(__dirname, '..', 'receitas');
const outputDir = path.join(__dirname, '..', 'receitas', 'pdfs');

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap');
  body {
    font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    line-height: 1.7;
    color: #2d2d2d;
    max-width: 700px;
    margin: 0 auto;
    padding: 20px 30px;
  }
  h1 {
    font-size: 22px;
    color: #7c3d5e;
    border-bottom: 3px solid #e8a0bf;
    padding-bottom: 8px;
    margin-bottom: 4px;
  }
  h2 {
    font-size: 15px;
    color: #5a2a42;
    margin-top: 22px;
    margin-bottom: 6px;
    border-left: 4px solid #e8a0bf;
    padding-left: 10px;
  }
  h3 {
    font-size: 13px;
    color: #7c3d5e;
    margin-top: 14px;
    margin-bottom: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 12px;
  }
  th {
    background: #f5d5e8;
    color: #5a2a42;
    padding: 6px 10px;
    text-align: left;
    font-weight: 700;
  }
  td {
    padding: 5px 10px;
    border-bottom: 1px solid #f0e0ea;
  }
  tr:nth-child(even) td {
    background: #fdf5f9;
  }
  blockquote {
    background: #fff8fb;
    border-left: 4px solid #c97ba8;
    margin: 12px 0;
    padding: 8px 14px;
    color: #5a2a42;
    font-style: italic;
  }
  hr {
    border: none;
    border-top: 1px solid #f0d0e4;
    margin: 12px 0;
  }
  code {
    background: #f5d5e8;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
  }
  strong {
    color: #5a2a42;
  }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0; padding-left: 20px; }
  li { margin: 3px 0; }
`;

const pdfoptions = {
  stylesheet_encoding: 'utf-8',
  css,
  pdf_options: {
    format: 'A4',
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    printBackground: true,
  },
  launch_options: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
};

const files = (await readdir(receitasDir)).filter(f => f.endsWith('.md'));

if (files.length === 0) {
  console.log('Nenhum arquivo .md encontrado em receitas/');
  process.exit(1);
}

import { mkdir } from 'fs/promises';
await mkdir(outputDir, { recursive: true });

for (const file of files) {
  const inputPath = path.join(receitasDir, file);
  const outputPath = path.join(outputDir, file.replace('.md', '.pdf'));
  process.stdout.write(`Gerando ${file.replace('.md', '.pdf')}...`);
  try {
    await mdToPdf({ path: inputPath }, { ...pdfoptions, dest: outputPath });
    console.log(' ✓');
  } catch (err) {
    console.log(` ERRO: ${err.message}`);
  }
}

console.log(`\nPDFs gerados em: receitas/pdfs/`);
