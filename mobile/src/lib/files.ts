// Photos, files, PDFs and sharing.
import { Alert, Linking, Platform, Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';
import { File, Directory, Paths } from 'expo-file-system';
import { uid } from './seed';

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
        Alert.alert('需要相機權限', '請到手機「設定」允許 Expo Go（或 PetPal）使用相機。');
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
    for (const a of res.assets.slice(0, max)) out.push(await persistFile(a.uri, extOf(a.uri, 'jpg')));
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
    const uri = await persistFile(a.uri, extOf(a.name || a.uri, 'pdf'));
    return { uri, name: a.name || '文件', mime: a.mimeType || '' };
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
export async function sharePdf(html: string, name: string) {
  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }
    const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
    let target = uri;
    try {
      const dest = new File(Paths.cache, `${name}.pdf`);
      if (dest.exists) dest.delete();
      await new File(uri).copy(dest);
      target = dest.uri;
    } catch {
      // keep the generated name
    }
    await shareFile(target, 'application/pdf', name);
  } catch {
    Alert.alert('無法產生 PDF', '請再試一次。');
  }
}

/** Read a local image as a data URI so it can be embedded in a PDF. */
export async function imageDataUri(uri?: string | null): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS === 'web') return uri;
  try {
    const b64 = await new File(uri).base64();
    const ext = extOf(uri, 'jpg');
    return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${b64}`;
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
  return openUrl('tel:' + phone.replace(/[^0-9+]/g, ''), '無法撥打電話');
}

export const esc = (x: unknown) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
