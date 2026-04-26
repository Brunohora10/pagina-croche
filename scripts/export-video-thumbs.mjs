import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';

const keyPath = process.env.DRIVE_SERVICE_ACCOUNT_FILE;
const videoFolderId = '1dd-uWkZ5nHT5Jy9kTwpG_9k_lIEdMRmv';
const outDir = path.resolve('video-thumbs');

function safeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

async function main() {
  if (!keyPath) {
    throw new Error('DRIVE_SERVICE_ACCOUNT_FILE nao definido no .env');
  }

  await fs.mkdir(outDir, { recursive: true });

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const client = await auth.getClient();

  const res = await drive.files.list({
    q: `'${videoFolderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,thumbnailLink,webViewLink)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = (res.data.files || []).filter(f => (f.mimeType || '').includes('video'));
  const lines = ['id;name;thumbnailSaved;webViewLink'];

  for (const f of files) {
    let saved = '';
    if (f.thumbnailLink) {
      try {
        const tRes = await client.request({ url: f.thumbnailLink, responseType: 'arraybuffer' });
        const filename = `${safeName(f.name || 'video')}-${f.id}.jpg`;
        const full = path.join(outDir, filename);
        await fs.writeFile(full, Buffer.from(tRes.data));
        saved = `video-thumbs/${filename}`;
      } catch (e) {
        saved = '';
      }
    }
    lines.push(`${f.id};${(f.name || '').replaceAll(';', ',')};${saved};${f.webViewLink || ''}`);
    console.log(saved ? `OK  ${f.name}` : `SEM THUMB  ${f.name}`);
  }

  await fs.writeFile(path.join(outDir, 'index.csv'), lines.join('\n'));
  console.log(`\nTotal videos: ${files.length}`);
  console.log('CSV: video-thumbs/index.csv');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
