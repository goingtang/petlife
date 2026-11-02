// Photos, files, PDFs and sharing.
import { Alert, Linking, Platform, Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';
import { File, Directory, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useEffect, useRef } from 'react';
import { uid, isSamplePhone } from './seed';
import { safeFileName } from './domain';
import type { Store } from './types';

const MAX_SIDE = 1280;

/** Shrink a photo so its longest side is at most 1280 px (JPEG 0.75). Returns the original uri if that fails. */
async function shrink(uri: string, w?: number, h?: number): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const ctx = ImageManipulator.manipulate(uri);
    if (w && h && Math.max(w, h) > MAX_SIDE) ctx.resize(w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE });
    else if (!w || !h) ctx.resize({ width: MAX_SIDE });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri;
  }
}

/** Copy a picked file into the app's own folder so it survives cache clean-ups. */
export async function persistFile(srcUri: string, ext: string): Promise<string> {
  if (Platform.OS === 'web') return srcUri;
  try {
    const dir = new Directory(Paths.document, 'petpal');
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, `${uid('f')}.${ext.replace(/^\./, '') || 'bin'}`);
    await new File(srcUri).copy(dest);
    return dest.uri;
  } catch {
    return srcUri;
  }
}

export function deleteFile(uri?: string | null) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const f = new File(uri);
    if (f.exists && uri.includes('/petpal/')) f.delete();
  } catch {
    // ignore
  }
}

function extOf(uri: string, fallback: string) {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(uri);
  return m ? m[1].toLowerCase() : fallback;
}

/** Let the user take a photo or choose from the library. Returns saved uris (or [] if cancelled). */
export async function pickPhotos(opts: { camera?: boolean; max?: number } = {}): Promise<string[]> {
  const max = opts.max ?? 1;
  try {
    let res: ImagePicker.ImagePickerResult;
    if (opts.camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('需要相機權限', '請到手機「設定」→ 應用程式，允許 PetPal 使用相機。');
        return [];
      }
      res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    } else {
      res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: max > 1,
        selectionLimit: max,
      });
    }
    if (res.canceled) return [];
    const out: string[] = [];
    for (const a of res.assets.slice(0, max)) {
      const small = await shrink(a.uri, a.width, a.height);
      out.push(await persistFile(small, small === a.uri ? extOf(a.uri, 'jpg') : 'jpg'));
    }
    return out;
  } catch {
    Alert.alert('無法開啟照片', '請確認已允許存取照片後再試一次。');
    return [];
  }
}

/** Ask "拍照 / 從相簿選擇" then pick. */
export function choosePhotos(max: number, onDone: (uris: string[]) => void) {
  if (Platform.OS === 'web') {
    pickPhotos({ max }).then(onDone);
    return;
  }
  Alert.alert('加入照片', undefined, [
    { text: '拍照', onPress: () => pickPhotos({ camera: true, max: 1 }).then(onDone) },
    { text: '從相簿選擇', onPress: () => pickPhotos({ max }).then(onDone) },
    { text: '取消', style: 'cancel' },
  ]);
}

export async function pickDocument(): Promise<{ uri: string; name: string; mime: string } | null> {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return null;
    const a = res.assets[0];
    const isImg = (a.mimeType || '').startsWith('image/');
    const src = isImg ? await shrink(a.uri) : a.uri;
    const uri = await persistFile(src, isImg ? 'jpg' : extOf(a.name || a.uri, 'pdf'));
    removeCacheFile(a.uri);
    return { uri, name: a.name || '文件', mime: isImg ? 'image/jpeg' : a.mimeType || 'application/pdf' };
  } catch {
    Alert.alert('無法選取檔案', '請再試一次。');
    return null;
  }
}

export async function shareText(message: string, title?: string) {
  try {
    await Share.share({ message, title });
  } catch {
    await copyText(message);
  }
}

/** Delete a temporary file in the cache folder (never anything in the app's documents). */
export function removeCacheFile(uri?: string | null) {
  if (!uri || Platform.OS === 'web' || uri.includes('/petpal/')) return;
  try {
    const f = new File(uri);
    if (f.exists && /cache/i.test(uri)) f.delete();
  } catch {
    // ignore
  }
}

export function mimeOf(uri: string): string {
  const e = extOf(uri, '');
  if (e === 'pdf') return 'application/pdf';
  if (e === 'png') return 'image/png';
  if (e === 'heic') return 'image/heic';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export async function shareFile(uri: string, mimeType?: string, dialogTitle?: string) {
  try {
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle });
      return true;
    }
  } catch {
    // fall through
  }
  Alert.alert('無法分享', '這台裝置目前無法分享檔案。');
  return false;
}

/** Write text to a temporary file (CSV, backup JSON) and open the share sheet. */
export async function shareTextFile(name: string, content: string, mimeType: string) {
  if (Platform.OS === 'web') {
    await shareText(content);
    return;
  }
  try {
    const f = new File(Paths.cache, name);
    if (f.exists) f.delete();
    f.create();
    await f.write(content);
    await shareFile(f.uri, mimeType, name);
  } catch {
    Alert.alert('匯出失敗', '請再試一次。');
  }
}

/** Render HTML to a PDF and open the share sheet (LINE, 存到檔案, 列印…). */
/** Render HTML to a PDF and open the share sheet. Returns false if the PDF could not be made or shared. */
export async function sharePdf(html: string, name: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return true;
    }
    const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
    let target = uri;
    const clean = safeFileName(name);
    try {
      const dest = new File(Paths.cache, `${clean}.pdf`);
      if (dest.exists) dest.delete();
      await new File(uri).move(dest);
      target = dest.uri;
    } catch {
      // keep the generated name
    }
    // The PDF holds health and personal data. It is removed by cleanupCachePdfs() on the next app start,
    // not right away: on Android the share call returns before the receiving app has read the file.
    return await shareFile(target, 'application/pdf', clean);
  } catch {
    Alert.alert('無法產生 PDF', '請再試一次。');
    return false;
  }
}

/** Delete PDFs and CSV/JSON exports left in the cache by earlier shares. Call once at startup. */
export function cleanupCacheExports() {
  if (Platform.OS === 'web') return;
  try {
    // Exports we wrote, plus PDFs that expo-print leaves in its own cache sub-folder.
    const sweep = (dir: Directory, depth: number) => {
      for (const item of dir.list()) {
        if (item instanceof File && /\.(pdf|csv|json)$/i.test(item.uri)) item.delete();
        else if (item instanceof Directory && depth < 2) sweep(item, depth + 1);
      }
    };
    sweep(Paths.cache, 0);
  } catch {
    // ignore
  }
}

/**
 * Read a local image as a JPEG data URI for embedding in a PDF, shrunk so the longest side is at most
 * `maxSide` px (PDFs with many full-size photos are slow or fail on low-memory phones). HEIC/WebP become JPEG.
 */
export async function imageDataUri(uri?: string | null, maxSide = 1000): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS === 'web') return uri;
  try {
    const orig = await ImageManipulator.manipulate(uri).renderAsync();
    let ref = orig;
    if (Math.max(orig.width, orig.height) > maxSide) {
      const c = ImageManipulator.manipulate(uri);
      c.resize(orig.width >= orig.height ? { width: maxSide } : { height: maxSide });
      ref = await c.renderAsync();
    }
    const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
    if (out.base64) return `data:image/jpeg;base64,${out.base64}`;
  } catch {
    // fall back to the raw file
  }
  try {
    const b64 = await new File(uri).base64();
    return `data:${mimeOf(uri)};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function copyText(t: string) {
  try {
    await Clipboard.setStringAsync(t);
  } catch {
    // ignore
  }
}

export async function openUrl(url: string, failMsg = '無法開啟連結') {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(failMsg, url.startsWith('tel:') ? `電話：${url.slice(4)}` : url);
  }
}

export function callPhone(phone: string) {
  if (isSamplePhone(phone)) {
    Alert.alert('這是範例資料', '範例裡的電話號碼不是真的。請到設定清除範例資料，再填入你自己的醫院電話。');
    return Promise.resolve();
  }
  return openUrl('tel:' + phone.replace(/[^0-9+]/g, ''), '無法撥打電話');
}

export const esc = (x: unknown) =>
  String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Track photos/files picked while a form is open.
 * - `added(uri)`: a new file was copied into the app for this form.
 * - `removed(uri)`: the user took a file out of the form.
 * - `commit()`: call when the form is saved — deletes the files that were removed.
 * - unsaved forms: when the screen closes without commit, files added during this visit are deleted.
 */
export function usePendingFiles() {
  const add = useRef<string[]>([]);
  const rem = useRef<string[]>([]);
  // Leaving without saving: files picked during this visit were never stored, so remove them.
  useEffect(
    () => () => {
      add.current.forEach((u) => deleteFile(u));
    },
    [],
  );
  const added = useCallback((uris: string | string[]) => {
    add.current.push(...(Array.isArray(uris) ? uris : [uris]));
  }, []);
  const removed = useCallback((uri?: string | null) => {
    if (!uri) return;
    if (add.current.includes(uri)) {
      add.current = add.current.filter((x) => x !== uri);
      deleteFile(uri); // never saved, safe to delete now
    } else rem.current.push(uri);
  }, []);
  /** Call on save. Pass `afterSave` from useStore so files are only deleted once the data is on disk. */
  const commit = useCallback((defer?: (fn: () => void) => void) => {
    const gone = rem.current.splice(0);
    add.current = [];
    const del = () => gone.forEach((u) => deleteFile(u));
    if (defer) defer(del);
    else del();
  }, []);
  const discard = useCallback(() => {
    add.current.forEach((u) => deleteFile(u));
    add.current = [];
    rem.current = [];
  }, []);
  return { added, removed, commit, discard };
}

/** Every file uri the data still points at. */
export function referencedFiles(s: Store): Set<string> {
  const out = new Set<string>();
  const add = (u?: string | null) => u && out.add(u);
  s.pets.forEach((p) => add(p.photo));
  s.journal.forEach((j) => j.photos.forEach(add));
  s.entries.forEach((e) => (e.v?.docs || []).forEach(add));
  s.docs.forEach((d) => {
    add(d.fileUri);
    (d.pages || []).forEach(add);
  });
  s.milestones.forEach((m) => add(m.photo));
  Object.values(s.lost).forEach((l) => add(l?.photo));
  s.expenses.forEach((x) => add(x.receipt));
  return out;
}

/** Delete a replaced file only if the data no longer points at it (e.g. a pet photo still used by the lost-pet poster). */
export function deleteIfUnused(uri: string | null | undefined, s: Store) {
  if (uri && !referencedFiles(s).has(uri)) deleteFile(uri);
}

/** Delete files in the app folder that nothing refers to any more. Returns how many were removed. */
export function cleanupOrphans(s: Store): { count: number; bytes: number } {
  if (Platform.OS === 'web') return { count: 0, bytes: 0 };
  try {
    const dir = new Directory(Paths.document, 'petpal');
    if (!dir.exists) return { count: 0, bytes: 0 };
    const keep = referencedFiles(s);
    const keepNames = new Set([...keep].map((u) => u.split('/').pop()));
    let count = 0;
    let bytes = 0;
    for (const item of dir.list()) {
      if (!(item instanceof File)) continue;
      if (keepNames.has(item.uri.split('/').pop())) continue;
      bytes += item.size ?? 0;
      item.delete();
      count++;
    }
    return { count, bytes };
  } catch {
    return { count: 0, bytes: 0 };
  }
}

/** Shared PDF page shell in PetPal colours. */
export function pdfShell(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  body{font-family:-apple-system,'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif;color:#3B2F28;margin:32px;font-size:13px}
  h1{font-size:22px;border-bottom:2px solid #3B2F28;padding-bottom:8px;margin:0 0 12px}
  h2{font-size:14px;color:#C4602F;margin:20px 0 6px}
  table{width:100%;border-collapse:collapse}td{padding:5px 6px;border-bottom:1px solid #EADDCB;vertical-align:top}
  td.k{color:#7A685B;width:34%}.foot{margin-top:24px;color:#9C8B7E;font-size:11px}
  </style></head><body>${body}<p class="foot">由 PetPal 產生</p></body></html>`;
}
