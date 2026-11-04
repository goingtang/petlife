// Where the app's data lives on the device.
// Native: a JSON file in the app's documents folder (no ~2 MB row cap like AsyncStorage on Android).
//
// Save:  write petpal-store.json.tmp → copy the current main file to .bak → move .tmp over the main file.
//        At every moment at least one complete copy exists on disk.
// Load:  a readable main file wins, unless a readable .tmp was saved after it (the save stopped
//        between writing .tmp and moving it). .bak is only used when main can't be read. Comparing
//        `_savedAt` only between main and .tmp keeps a phone clock that jumped backwards from
//        bringing back an older copy. The old AsyncStorage key (first app version) is used whenever
//        no file could be read.
//        A main file that exists but can't be read is set aside (renamed .corrupt-…) before the next save,
//        so it is never silently overwritten.
// Web preview: AsyncStorage (localStorage).
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const LEGACY_KEY = 'petpal.store.v1';
const NAME = 'petpal-store.json';
const native = Platform.OS !== 'web';

export interface Candidate {
  name: 'main' | 'tmp' | 'bak';
  exists: boolean;
  data: any | null; // parsed JSON, or null if missing/unreadable
}

export interface LoadResult {
  data: any | null;
  source: 'main' | 'tmp' | 'bak' | 'legacy' | 'none';
  /** The main file exists but could not be read. */
  mainUnreadable: boolean;
}

/** Pick which saved copy to load. Pure, so it can be unit-tested. */
export function chooseCopy(c: Candidate[]): { data: any | null; source: LoadResult['source']; mainUnreadable: boolean; anyFile: boolean } {
  const get = (n: Candidate['name']) => {
    const x = c.find((y) => y.name === n);
    return x && x.data && typeof x.data === 'object' ? x : null;
  };
  const main = get('main');
  const tmp = get('tmp');
  const bak = get('bak');
  const at = (x: Candidate) => Number(x.data._savedAt) || 0;
  let best: Candidate | null = null;
  if (main) best = tmp && at(tmp) > at(main) ? tmp : main;
  else if (tmp && bak) best = at(tmp) >= at(bak) ? tmp : bak;
  else best = tmp ?? bak;
  const mainCand = c.find((x) => x.name === 'main');
  return {
    data: best ? best.data : null,
    source: best ? best.name : 'none',
    mainUnreadable: !!mainCand?.exists && !main,
    anyFile: c.some((x) => x.exists),
  };
}

function files() {
  return {
    main: new File(Paths.document, NAME),
    tmp: new File(Paths.document, NAME + '.tmp'),
    bak: new File(Paths.document, NAME + '.bak'),
  };
}

async function readJson(f: File): Promise<Candidate['data']> {
  try {
    if (!f.exists) return null;
    return JSON.parse(await f.text());
  } catch {
    return null;
  }
}

let mainNeedsSetAside = false;

async function readLegacy(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export async function loadRaw(): Promise<LoadResult> {
  if (native) {
    const f = files();
    // Parse only what is needed: .tmp only when it exists (an interrupted save), .bak only when main
    // can't be read. A normal launch parses the main file once.
    const mainData = await readJson(f.main);
    const tmpExists = f.tmp.exists;
    const cands: Candidate[] = [
      { name: 'main', exists: f.main.exists, data: mainData },
      { name: 'tmp', exists: tmpExists, data: tmpExists ? await readJson(f.tmp) : null },
    ];
    if (!mainData || typeof mainData !== 'object') cands.push({ name: 'bak', exists: f.bak.exists, data: await readJson(f.bak) });
    const r = chooseCopy(cands);
    mainNeedsSetAside = r.mainUnreadable;
    if (r.data) return { data: r.data, source: r.source, mainUnreadable: r.mainUnreadable };
    // No file could be read (e.g. an empty .tmp left by a failed first save): fall back to the old copy.
    const legacy = await readLegacy();
    if (legacy) return { data: legacy, source: 'legacy', mainUnreadable: r.mainUnreadable };
    return { data: null, source: 'none', mainUnreadable: r.mainUnreadable };
  }
  const legacy = await readLegacy();
  if (legacy) return { data: legacy, source: 'legacy', mainUnreadable: false };
  return { data: null, source: 'none', mainUnreadable: false };
}

/** Save data. Throws if the write failed so the caller can retry and tell the user. */
export async function saveRaw(json: string): Promise<void> {
  if (!native) {
    await AsyncStorage.setItem(LEGACY_KEY, json);
    return;
  }
  const f = files();
  if (mainNeedsSetAside && f.main.exists) {
    await f.main.move(new File(Paths.document, `${NAME}.corrupt-${Date.now()}`));
    mainNeedsSetAside = false;
  }
  if (f.tmp.exists) f.tmp.delete();
  f.tmp.create();
  await f.tmp.write(json);
  if (f.main.exists) await f.main.copy(f.bak, { overwrite: true });
  await f.tmp.move(new File(Paths.document, NAME), { overwrite: true });
}

/**
 * After data loaded from the old AsyncStorage copy (or from a file) has been saved to a file,
 * drop the old copy so it can never come back. Never call this when nothing was loaded.
 */
export async function clearLegacy(): Promise<void> {
  if (!native) return;
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

/**
 * Erase everything this app stored on the device: the data file and its .tmp/.bak/.corrupt copies,
 * the photos/documents folder, exported files in the cache, and the old AsyncStorage key.
 * (Scheduled notifications are cancelled by the caller.)
 */
export async function wipeAll(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
  if (!native) return;
  mainNeedsSetAside = false;
  // Each item is deleted on its own, so one file that can't be removed doesn't stop the rest.
  const del = (item: File | Directory) => {
    try {
      item.delete();
    } catch {
      // ignore
    }
  };
  let docs: (File | Directory)[] = [];
  try {
    docs = Paths.document.list();
  } catch {
    // ignore
  }
  for (const item of docs) {
    const name = item.uri.replace(/\/$/, '').split('/').pop() || '';
    if (item instanceof File && name.startsWith(NAME)) del(item);
    else if (item instanceof Directory && name === 'petpal') del(item);
  }
  let cache: (File | Directory)[] = [];
  try {
    cache = Paths.cache.list();
  } catch {
    // ignore
  }
  cache.forEach(del);
}

/** The app's documents folder as a file:// URI (null on web), used to re-point saved photo paths. */
export function documentRoot(): string | null {
  if (!native) return null;
  try {
    return Paths.document.uri;
  } catch {
    return null;
  }
}
