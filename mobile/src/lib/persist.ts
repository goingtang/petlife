// Where the app's data lives on the device.
// Native: a JSON file in the app's documents folder (no size limit like AsyncStorage's ~2 MB row cap on Android).
// Writes go to a temp file first and then replace the real one, and the previous version is kept as a backup.
// Web preview: AsyncStorage (localStorage).
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

const LEGACY_KEY = 'petpal.store.v1';
const NAME = 'petpal-store.json';

const native = Platform.OS !== 'web';

function files() {
  return {
    main: new File(Paths.document, NAME),
    tmp: new File(Paths.document, NAME + '.tmp'),
    bak: new File(Paths.document, NAME + '.bak'),
  };
}

/** Read saved data. Falls back to the backup file, then to the v1 AsyncStorage key (first app version). */
export async function loadRaw(): Promise<any | null> {
  if (native) {
    const f = files();
    for (const file of [f.main, f.bak]) {
      try {
        if (file.exists) return JSON.parse(await file.text());
      } catch {
        // corrupt: try the next one
      }
    }
  }
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Save data. Throws if the write failed so the caller can tell the user. */
export async function saveRaw(json: string): Promise<void> {
  if (!native) {
    await AsyncStorage.setItem(LEGACY_KEY, json);
    return;
  }
  const f = files();
  if (f.tmp.exists) f.tmp.delete();
  f.tmp.create();
  await f.tmp.write(json);
  // Keep the last good version as a backup, then move the new file into place.
  if (f.main.exists) {
    if (f.bak.exists) f.bak.delete();
    await f.main.move(f.bak);
  }
  await f.tmp.move(new File(Paths.document, NAME));
}

/** After the first successful file save, drop the old AsyncStorage copy so it can't shadow newer data. */
export async function clearLegacy(): Promise<void> {
  if (!native) return;
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}
