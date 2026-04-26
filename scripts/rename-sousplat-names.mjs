import fs from 'node:fs/promises';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'app-data.js');
let raw = await fs.readFile(filePath, 'utf8');

const renameMap = {
  '1beeFJSno-Qoah4DGqJguN-kWJ_5H4JHn': 'Sousplat Floral Branco com Borda de Corações Rosa',
  '1UP9Nl6xLlxFxakNkRoJw8diZrCF43ga2': 'Sousplat Fruta Melancia',
  '1QS5_lGYjmbroNcbUF-nZ-Pu88BWzVNWz': 'Sousplat Tradicional Branco e Dourado - Parte 1 (Início)',
  '1GCOLTLjCVfbudvaUZl9csD8u2RdPYC9k': 'Sousplat Tradicional Branco e Dourado - Parte 2 (Base)',
  '1y_HSpvzyI6sPSlqUunUe4FZpi91_r4OE': 'Sousplat Tradicional Branco e Dourado - Parte 3 (Borda Interna)',
  '1awtnl43aWVTK-dMh7OCKu8bi2MwZeyc1': 'Sousplat Tradicional Branco e Dourado - Parte 4 (Borda Externa)',
  '180Cd76n0HE8adYnzwbg2AVY93T5lzIji': 'Sousplat Rosa e Verde - Materiais',
  '1Ymjk7gaBMuYWuVL0BP1Byl6UYfnCoCO3': 'Sousplat Rosa e Verde - Introdução',
  '1o1I88yB4gupDiRimMKrII0B0oDBDRk-y': 'Sousplat Terracota Rendado',
  '1uwy7C-tSFtylQKYNhlbBRVGhOCfOFPe9': 'Sousplat Laranja Coral Rendado',
  '1VaHa-pmAVjVKtycsefj7SL8-TKgvi5Xn': 'Sousplat Rosé Rendado',
  '1zoRgt-lg-tFsrL9bBYeGEjQTnniljUhE': 'Sousplat Tradicional Branco e Dourado',
  '1yV1zuo1aa2UFpHTsuRk_G0pZe-0LYx2p': 'Sousplat Azul com Margaridas',
  '1ERvxM2QCj2v8TOf9ph8YdywVEcToBGmR': 'Sousplat Branco com Borda Dourada',
  '1X3G7KhiRQNb8PKcp8FVYQW15aCsaB1hH': 'Sousplat Pink Rendado',
  '1_sVXAoTJI7HzROi6DNo8q1KxsT2TefRq': 'Jogo Americano Rosa Rendado',
  '19CIyU5Ew5xC9kO-GtO0ee88XbytuEGQ8': 'Sousplat Floral Vermelho e Dourado',
  '1kqxltWFEOhGuIpHhkoFkE4c2U8cjAzCQ': 'Sousplat Rosa Clássico',
  '1GQHP18CAxszpA1IMXGZkOZ1sUZa1ev-n': 'Sousplat Terracota Trabalhado',
  '1CpI6NgLtuZCkfzYuR6y0nMUiWa5J3-cY': 'Sousplat Branco e Mostarda Espiral',
  '1q7EQU5QZmr0AwN1gjHlSjcWJ102oPbaP': 'Sousplat Delicado Rosa - Parte 1',
  '1V_NBXFPMTndtgeJxYJATnY_rA7Zt5Oz5': 'Sousplat Delicado Rosa - Parte 2',
  '10WHS5FpEP292GkzyTOfwKM1feFn4oy-x': 'Sousplat Delicado Rosa - Parte 3',
  '1KiqtPdmzm6DT3Imy_rp3N1G-bN7f_moK': 'Sousplat Rosa Rendado - Detalhes',
  '1V4aiW6da1uakJJnC0DYOl92htmt7BAZF': 'Porta-copo Coração Vermelho',
  '1FN5iEwj0GLuH3u2YrxVPTeOD3gqDVsZn': 'Sousplat Branco Tradicional - Base',
  '1RP_0ZtYIqmR7w2L9EOAvBBfz449wFq1t': 'Sousplat Azul Rendado com Borda Dourada',
  '1zNUwqqBvKyOCQ4bK922mGqjMPGDwBAZ5': 'Sousplat Rosa com Borda Dourada (Mini)',
  '1rp51mXICOl40bpTFtYadr00ayq1j4oZs': 'Jogo Americano Cinza',
  '1b0caPvYNIoRfBr0OkCjM4eFYjwM2y3GJ': 'Sousplat Branco Tradicional - Continuação',
  '175q4K8Wi7_-_X2nASNYJhgJymGl9m1Mm': 'Aplicações de Coração para Sousplat',
  '1DK2zokbFdbxGCpaIgCVR2zCAtXgjg5OH': 'Sousplat Mostarda Raiado',
  '1l0WpTLikCq1SyvdkQ-BPNUdJG50nJY-8': 'Sousplat Mostarda Floral',
  '1d9lcnsawNsgbEKfZ06ur7TIAAN3Q0pT6': 'Sousplat Mostarda Floral - Continuação',
  '1MVM1keryyMIslf4sRE6YDXIPT074HRVO': 'Sousplat Branco com Corações Coloridos',
  '1UGlsbjtVNe0TxI58p-05OFe7m0IEFo7g': 'Porta-copo Coração Mostarda',
  '153PvfOjqKZjhlc_vAxy3DzSDcO4DqyNJ': 'Sousplat Azul Rendado - Acabamento',
  '1VPcxKWmRYS87533fCL8TUotka1EifS53': 'Sousplat Delicado Rosa - Parte 2 (Detalhes)',
  '11R54fnI-JyCFyVz_CJIG4gJX468NSV96': 'Sousplat Branco com Corações Rosa',
  '1y1fGthCZoSFbErETkUSpe9axgij5PJnj': 'Sousplat Rosa Simples',
  '1V0z6LhZ7jKYFUk1lhvqixcCqkQ93bqTs': 'Sousplat Branco com Aplicação Rosa'
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let changed = 0;
for (const [id, newName] of Object.entries(renameMap)) {
  const regex = new RegExp(`("i":"${escapeRegex(id)}"[\\s\\S]*?"n":")([^"]*)(")`, 'g');
  raw = raw.replace(regex, (match, before, oldName, after) => {
    if (oldName === newName) return match;
    changed += 1;
    return `${before}${newName}${after}`;
  });
}

await fs.writeFile(filePath, raw, 'utf8');
console.log(`Renomeações aplicadas: ${changed}`);
