// Where the app's data lives on the device.
// Native: a JSON file in the app's documents folder (no ~2 MB row cap like AsyncStorage on Android).
//
// Save:  write petpal-store.json.tmp → copy the current main file to .bak → move .tmp over the main file.
//        At every moment at least one complete copy exists on disk.
// Load:  read main, .tmp and .bak; use the one saved most recently (each copy carries `_savedAt`).
//        The old AsyncStorage key (first app version) is only used when none of the files exist.
//        A main file that exists but can't be read is set aside (renamed .corrupt-…) before the next save,
//        so it is never silently overwritten.
// Web preview: AsyncStorage (localStorage).
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

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

/** Pick the newest readable copy. Pure, so it can be unit-tested. */
export function chooseCopy(c: Candidate[]): { data: any | null; source: LoadResult['source']; mainUnreadable: boolean; anyFile: boolean } {
  const main = c.find((x) => x.name === 'main');
  const readable = c.filter((x) => x.data && typeof x.data === 'object');
  const order = { main: 0, tmp: 1, bak: 2 } as const;
  readable.sort((a, b) => (Number(b.data._savedAt) || 0) - (Number(a.data._savedAt) || 0) || order[a.name] - order[b.name]);
  const best = readable[0];
  return {
    data: best ? best.data : null,
    source: best ? best.name : 'none',
    mainUnreadable: !!main?.exists && !main.data,
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

export async function loadRaw(): Promise<LoadResult> {
  if (native) {
    const f = files();
    const cands: Candidate[] = [
      { name: 'main', exists: f.main.exists, data: await readJson(f.main) },
      { name: 'tmp', exists: f.tmp.exists, data: await readJson(f.tmp) },
      { name: 'bak', exists: f.bak.exists, data: await readJson(f.bak) },
    ];
    const r = chooseCopy(cands);
    mainNeedsSetAside = r.mainUnreadable;
    if (r.data) return { data: r.data, source: r.source, mainUnreadable: r.mainUnreadable };
    if (r.anyFile) return { data: null, source: 'none', mainUnreadable: r.mainUnreadable };
  }
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (raw) return { data: JSON.parse(raw), source: 'legacy', mainUnreadable: false };
  } catch {
    // ignore
  }
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

/** After the first successful file save, drop the old AsyncStorage copy so it can never come back. */
export async function clearLegacy(): Promise<void> {
  if (!native) return;
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}
