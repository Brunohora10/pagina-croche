import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';

const keyPath = process.env.DRIVE_SERVICE_ACCOUNT_FILE;
const rootId = process.env.DRIVE_ROOT_FOLDER_ID;

if (!keyPath || !rootId) {
  console.error('Faltam variaveis DRIVE_SERVICE_ACCOUNT_FILE e DRIVE_ROOT_FOLDER_ID no .env');
  process.exit(1);
}

if (!fs.existsSync(keyPath)) {
  console.error('Arquivo de credencial nao encontrado:', keyPath);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: keyPath,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

async function listChildren(folderId) {
  const files = [];
  let pageToken = undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType,webViewLink)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return files;
}

function isFolder(f) {
  return f.mimeType === 'application/vnd.google-apps.folder';
}

function isSousplatName(name = '') {
  const n = name.toLowerCase();
  return n.includes('sousplat') || n.includes('souplat') || n.includes('supla');
}

const rootChildren = await listChildren(rootId);
const subfolders = rootChildren.filter(isFolder);
const sousplatFolders = subfolders.filter(f => isSousplatName(f.name));

console.log('ROOT:', rootId);
console.log('PASTAS NA RAIZ:', subfolders.length);
console.log('PASTAS SOUSPLAT ENCONTRADAS:', sousplatFolders.length);

for (const folder of sousplatFolders) {
  console.log(`\n=== ${folder.name} | ${folder.id} ===`);
  const children = await listChildren(folder.id);
  for (const item of children) {
    const type = isFolder(item) ? 'PASTA' : item.mimeType.includes('video') ? 'VIDEO' : item.mimeType.includes('pdf') ? 'PDF' : 'ARQUIVO';
    console.log(`- [${type}] ${item.name} | ${item.id}`);
  }
}
