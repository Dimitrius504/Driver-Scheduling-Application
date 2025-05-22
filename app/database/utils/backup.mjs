import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.resolve(__dirname, '../../temp/backups');

export async function backupCollection(model, name) {
  const docs = await model.find().lean();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(backupDir, `${name}-${timestamp}.json`);

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(docs, null, 2), 'utf-8');

  console.log(`🗂️ Backup saved: ${filename}`);
}
