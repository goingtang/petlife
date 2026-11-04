// Full backup: one .zip with the data (data.json) and every photo/document the data refers to (files/…).
// Restoring puts the files back into the app folder and points the data at them, so a new phone gets
// pet photos, diary photos, receipts and documents back. Old .json backups (data only) still restore.
// The pure parts (prepare/restore/pack/unpack) are unit-tested in __tests__/backup.test.ts.
import JSZip from 'jszip';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import type { Store } from './types';
import { mapFileUris } from './life';

/** Data references to files inside a backup look like this; they are rewritten to real paths on restore. */
export const FILE_REF = 'petpal-file:';
/** Above this total, ask before building a zip in memory (phones with little RAM). */
export const LARGE_BACKUP_BYTES = 150 * 1024 * 1024;

const baseName = (uri: string) => decodeURIComponent(uri.split('?')[0].split('/').pop() || '');
const safeName = (n: string) => n.replace(/[^\w.\-]/g, '_').slice(0, 80) || 'file';

/**
 * Copy of the data where each file that exists (per `exists`) is replaced by `petpal-file:<name>`,
 * plus the list of files to put in the zip. Missing files keep their old path (they were already blank).
 */
export function prepareBackupData(store: Store, exists: (uri: string) => boolean): { data: any; files: { uri: string; name: string }[] } {
  const data = JSON.parse(JSON.stringify(store));
  const byUri = new Map<string, string>();
  const used = new Set<string>();
  mapFileUris(data, (u) => {
    if (byUri.has(u)) return FILE_REF + byUri.get(u);
    if (!exists(u)) return u;
    let name = safeName(baseName(u));
    for (let i = 2; used.has(name); i++) name = `${i}_${safeName(baseName(u))}`;
    used.add(name);
    byUri.set(u, name);
    return FILE_REF + name;
  });
  data._backup = { format: 2, files: byUri.size, at: new Date().toISOString() };
  return { data, files: [...byUri].map(([uri, name]) => ({ uri, name })) };
}

/** Point `petpal-file:<name>` references at restored files; names that weren't restored become empty. */
export function restoreFileRefs(data: any, uriOf: (name: string) => string | null): any {
  mapFileUris(data, (u) => (u.startsWith(FILE_REF) ? uriOf(u.slice(FILE_REF.length)) ?? '' : u));
  // Lists of photos shouldn't keep empty holes.
  for (const j of data.journal || []) j.photos = (j.photos || []).filter(Boolean);
  for (const d of data.docs || []) d.pages = (d.pages || []).filter(Boolean);
  for (const e of data.entries || []) if (e.v && Array.isArray(e.v.docs)) e.v.docs = e.v.docs.filter(Boolean);
  for (const p of data.pets || []) if (!p.photo) delete p.photo;
  for (const x of data.expenses || []) if (!x.receipt) delete x.receipt;
  for (const x of data.milestones || []) if (!x.photo) delete x.photo;
  for (const k of Object.keys(data.lost || {})) if (data.lost[k] && !data.lost[k].photo) delete data.lost[k].photo;
  for (const d of data.docs || []) if (d.fileUri === '') d.fileUri = null;
  delete data._backup;
  return data;
}

export async function packZip(data: any, files: { name: string; bytes: Uint8Array }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(data));
  const dir = zip.folder('files')!;
  // Photos are already JPEG-compressed; storing them avoids slow, useless deflate on the phone.
  for (const f of files) dir.file(f.name, f.bytes, { binary: true, compression: 'STORE' });
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function unpackZip(bytes: Uint8Array): Promise<{ data: any; files: { name: string; read: () => Promise<Uint8Array> }[] }> {
  const zip = await JSZip.loadAsync(bytes);
  const json = zip.file('data.json');
  if (!json) throw new Error('no data.json');
  const data = JSON.parse(await json.async('string'));
  const files: { name: string; read: () => Promise<Uint8Array> }[] = [];
  zip.folder('files')?.forEach((path, entry) => {
    if (!entry.dir && !path.includes('/')) files.push({ name: path, read: () => entry.async('uint8array') });
  });
  return { data, files };
}

const isZip = (b: Uint8Array) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b; // "PK"

// ---------- Device side (not unit-tested) ----------

const fileExists = (uri: string) => {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
};

/** Total size of the files a full backup would include. */
export function backupFilesBytes(store: Store): number {
  if (Platform.OS === 'web') return 0;
  const { files } = prepareBackupData(store, fileExists);
  let n = 0;
  for (const f of files) {
    try {
      n += new File(f.uri).size ?? 0;
    } catch {
      // skip
    }
  }
  return n;
}

/**
 * Build the backup file in the cache folder and return its URI. `withFiles: false` makes a data-only zip.
 * On web there are no app files, so this returns null and the caller exports JSON instead.
 */
export async function writeBackupZip(store: Store, name: string, withFiles = true): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const { data, files } = withFiles ? prepareBackupData(store, fileExists) : { data: JSON.parse(JSON.stringify(store)), files: [] };
  const parts: { name: string; bytes: Uint8Array }[] = [];
  for (const f of files) {
    try {
      parts.push({ name: f.name, bytes: await new File(f.uri).bytes() });
    } catch {
      // A file that can't be read is left out; its reference stays empty on restore.
    }
  }
  const zipBytes = await packZip(data, parts);
  const out = new File(Paths.cache, name);
  if (out.exists) out.delete();
  out.create();
  await out.write(zipBytes);
  return out.uri;
}

/**
 * Open a picked backup (.zip with photos, or an older .json) without changing anything yet.
 * `data` is for the confirm dialog (pet count, date). `restore()` writes the zip's files into the app
 * folder (new names, so nothing on the phone is overwritten) and returns the data pointed at them.
 */
export async function openBackup(uri: string): Promise<{ data: any; fileCount: number; restore: () => Promise<{ data: any; restoredFiles: number }> }> {
  const web = Platform.OS === 'web';
  const bytes = web ? new Uint8Array(await (await fetch(uri)).arrayBuffer()) : await new File(uri).bytes();
  if (!isZip(bytes)) {
    // Older backups are plain JSON. (Read as text by the platform: Hermes has no TextDecoder.)
    const text = web ? await (await fetch(uri)).text() : await new File(uri).text();
    const data = JSON.parse(text);
    return { data, fileCount: 0, restore: async () => ({ data, restoredFiles: 0 }) };
  }
  const { data, files } = await unpackZip(bytes);
  const restore = async () => {
    if (web) return { data: restoreFileRefs(data, () => null), restoredFiles: 0 };
    const dir = new Directory(Paths.document, 'petpal');
    if (!dir.exists) dir.create({ intermediates: true });
    const written = new Map<string, string>();
    const stamp = Date.now().toString(36);
    for (const f of files) {
      try {
        const dest = new File(dir, `r${stamp}_${safeName(f.name)}`);
        if (dest.exists) dest.delete();
        dest.create();
        await dest.write(await f.read());
        written.set(f.name, dest.uri);
      } catch {
        // skip a file that can't be written; its reference becomes empty
      }
    }
    return { data: restoreFileRefs(data, (n) => written.get(n) ?? null), restoredFiles: written.size };
  };
  return { data, fileCount: files.length, restore };
}
