import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { produce, setAutoFreeze } from 'immer';
import type { Store, Pet, Member } from './types';
import { emptyStore, sampleStore, STORE_VERSION, uid } from './seed';
import { loadRaw, saveRaw, clearLegacy } from './persist';
import { addDays, today } from './date';

// Screens sometimes keep references to store objects between renders; never freeze them.
setAutoFreeze(false);

const arr = (x: any) => (Array.isArray(x) ? x : []);

/** Fill in fields that newer app versions added, without throwing away the user's data. */
export function migrate(raw: any): Store {
  const base = emptyStore();
  if (!raw || typeof raw !== 'object') return base;
  const out: any = { ...base };
  for (const k of Object.keys(base)) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    const b = (base as any)[k];
    if (Array.isArray(b) && !Array.isArray(v)) continue;
    if (b && typeof b === 'object' && !Array.isArray(b) && (typeof v !== 'object' || Array.isArray(v))) continue;
    out[k] = v;
  }
  out.v = STORE_VERSION;
  if (!out.members.length) out.members = base.members;
  if (!out.members.some((m: Member) => m.id === out.me)) out.me = out.members[0].id;
  if (!out.members.some((m: Member) => m.id === out.ownerId)) out.ownerId = out.members[0].id;
  // Per-item fields added after version 1.
  out.meds = arr(out.meds).map((m: any) => ({ freq: 'daily', count: null, refillAt: 0, ...m }));
  out.docs = arr(out.docs).map((d: any) => ({ ...d, pages: arr(d.pages) }));
  out.groom = arr(out.groom).map((g: any) => ({ ...g, history: arr(g.history) }));
  out.reminders = arr(out.reminders).map((r: any) => ({ ...r, history: arr(r.history) }));
  out.journal = arr(out.journal).map((j: any) => ({ ...j, photos: arr(j.photos), acts: arr(j.acts) }));
  const str = (x: any) => (typeof x === 'string' ? x : x == null ? '' : String(x));
  const prevMonth = (() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  out.recurring = arr(out.recurring)
    .filter((r: any) => r && typeof r === 'object')
    .map((r: any) => ({
      ...r,
      amt: Number(r.amt) || 0,
      day: Math.min(28, Math.max(1, Math.round(Number(r.day) || 1))),
      lastPosted: /^\d{4}-\d{2}$/.test(r.lastPosted) ? r.lastPosted : prevMonth,
      note: str(r.note),
      cat: str(r.cat) || '其他',
      petId: str(r.petId) || 'all',
    }));
  const vets: any = {};
  for (const [k, v] of Object.entries(out.vets || {})) {
    if (!v || typeof v !== 'object') continue;
    const x = v as any;
    vets[k] = { name: str(x.name), doctor: str(x.doctor), phone: str(x.phone), addr: str(x.addr), hours: str(x.hours) };
  }
  out.vets = vets;
  if (out.erVet && typeof out.erVet === 'object') {
    const x = out.erVet;
    out.erVet = { name: str(x.name), doctor: str(x.doctor), phone: str(x.phone), addr: str(x.addr), hours: str(x.hours) };
  } else out.erVet = null;
  out.entries = arr(out.entries).filter((e: any) => e && typeof e === 'object').map((e: any) => ({ ...e, v: e.v && typeof e.v === 'object' ? e.v : {} }));
  out.pets = arr(out.pets)
    .filter((p: any) => p && typeof p === 'object' && p.id)
    .map((p: any) => ({ kind: 'other', breed: '', sex: 'male', birthday: '', adopted: '', neutered: false, chip: '', allergy: '', color: '#E8D9B5', ...p, name: str(p.name) || '寵物' }));
  out.ownerPhone = str(out.ownerPhone);
  const lost: any = {};
  for (const [k, v] of Object.entries(out.lost || {})) lost[k] = { ...(v as any), sightings: arr((v as any)?.sightings) };
  out.lost = lost;
  return out as Store;
}

/** Housekeeping that should happen once a day: trim old check-offs, add this month's fixed expenses. */
export function dailyMaintenance(d: Store, td = today()): void {
  const cutoff = addDays(td, -60);
  for (const k of Object.keys(d.taskDone)) if (k < cutoff) delete d.taskDone[k];
  const month = td.slice(0, 7);
  const dom = Number(td.slice(8, 10));
  for (const r of d.recurring) {
    // Post every month from the one after lastPosted up to this month (this month only once its day has come).
    let m = r.lastPosted;
    for (let guard = 0; guard < 24; guard++) {
      const [y, mo] = m.split('-').map(Number);
      const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
      if (next > month || (next === month && dom < r.day)) break;
      d.expenses.push({ id: uid('x'), date: `${next}-${String(r.day).padStart(2, '0')}`, cat: r.cat, amt: r.amt, petId: r.petId, note: r.note, recurringId: r.id });
      r.lastPosted = next;
      m = next;
    }
  }
}

type Updater = (draft: Store) => void;

interface Ctx {
  store: Store;
  ready: boolean;
  update: (fn: Updater) => void;
  replace: (s: Store) => void;
  petId: string | null;
  setPetId: (id: string) => void;
  toast: (msg: string) => void;
  /** Run `fn` once the next save has reached the disk (e.g. delete a replaced photo file). */
  afterSave: (fn: () => void) => void;
  /** Today's date; changes when the app is reopened on a new day, so screens re-render. */
  day: string;
}

const StoreCtx = createContext<Ctx | null>(null);
/** Toast text lives in its own context so showing a toast doesn't re-render every screen. */
const ToastCtx = createContext<string | null>(null);
export const useToastMsg = () => useContext(ToastCtx);

const RETRY_MS = [2000, 5000, 15000, 30000, 60000];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>(emptyStore);
  const [ready, setReady] = useState(false);
  const [petId, setPetIdState] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [day, setDay] = useState(today());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(store);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const failures = useRef(0);
  const savedOnce = useRef(false);
  const afterSaveQueue = useRef<(() => void)[]>([]);

  const toast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const writeNow = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const jobs = afterSaveQueue.current.splice(0);
    // Serialize writes so two saves never interleave.
    saving.current = saving.current.then(async () => {
      try {
        await saveRaw(JSON.stringify({ ...latest.current, _savedAt: Date.now() }));
        failures.current = 0;
        jobs.forEach((fn) => {
          try {
            fn();
          } catch {
            // ignore
          }
        });
        if (!savedOnce.current) {
          savedOnce.current = true;
          clearLegacy();
        }
      } catch {
        afterSaveQueue.current.unshift(...jobs); // keep them for the next successful save
        const n = failures.current++;
        if (n === 0) toast('資料沒有存成功，請確認手機空間；App 會自動再試');
        if (n < RETRY_MS.length) saveTimer.current = setTimeout(writeNow, RETRY_MS[n]);
      }
    });
  }, [toast]);

  const persist = useCallback(
    (delay = 300) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(writeNow, delay);
    },
    [writeNow],
  );

  const afterSave = useCallback(
    (fn: () => void) => {
      afterSaveQueue.current.push(fn);
      persist();
    },
    [persist],
  );

  const apply = useCallback(
    (s: Store) => {
      latest.current = s;
      setStore(s);
      persist();
    },
    [persist],
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await loadRaw();
        if (r.data) {
          let s = migrate(r.data);
          try {
            s = produce(s, (d) => dailyMaintenance(d));
          } catch {
            // housekeeping must never block opening the app
          }
          latest.current = s;
          setStore(s);
          if (r.source === 'tmp' || r.source === 'bak') toast('上次儲存沒有完成，已從最近的完整資料還原');
          persist(50); // writes the migrated file (and moves data out of the old AsyncStorage key)
        } else if (r.mainUnreadable) {
          toast('資料檔無法讀取，已另外保留原檔；目前從空白開始');
        }
      } catch {
        toast('讀取資料時發生問題，請到「設定」用備份檔還原');
      }
      setReady(true);
    })();
  }, [persist, toast]);

  // Save right away when the app goes to the background: the OS may close it without warning.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if ((st === 'background' || st === 'inactive') && saveTimer.current) writeNow();
    });
    return () => sub.remove();
  }, [writeNow]);

  // New day while the app was in the background: refresh screens and run housekeeping.
  const dayRef = useRef(day);
  useEffect(() => {
    const check = () => {
      const td = today();
      if (td === dayRef.current) return;
      dayRef.current = td;
      setDay(td);
      apply(produce(latest.current, (d) => dailyMaintenance(d, td)));
    };
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') check();
    });
    const iv = setInterval(check, 60000);
    return () => {
      sub.remove();
      clearInterval(iv);
    };
  }, [apply]);

  const update = useCallback((fn: Updater) => apply(produce(latest.current, fn)), [apply]);
  const replace = useCallback((s: Store) => apply(s), [apply]);

  // Keep the selected pet valid as pets are added/removed.
  const currentPet = store.pets.find((p) => p.id === petId) ? petId : store.pets[0]?.id ?? null;

  const value = useMemo<Ctx>(
    () => ({ store, ready, update, replace, petId: currentPet, setPetId: setPetIdState, toast, afterSave, day }),
    [store, ready, update, replace, currentPet, toast, afterSave, day],
  );
  return (
    <StoreCtx.Provider value={value}>
      <ToastCtx.Provider value={toastMsg}>{children}</ToastCtx.Provider>
    </StoreCtx.Provider>
  );
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}

/** The currently selected pet (null when the user has no pets yet). */
export function usePet(): Pet | null {
  const { store, petId } = useStore();
  return store.pets.find((p) => p.id === petId) ?? null;
}

/**
 * Text that is saved to the store while typing, without writing on every keystroke:
 * commits 600 ms after the last change and when the screen closes.
 */
export function useDraft(value: string, commit: (v: string) => void): [string, (v: string) => void] {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    if (pending.current === null) setDraft(value);
  }, [value]);
  useEffect(() => {
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) commitRef.current(pending.current);
      pending.current = null;
    };
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, []);
  const set = (v: string) => {
    setDraft(v);
    pending.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pending.current !== null) commitRef.current(pending.current);
      pending.current = null;
    }, 600);
  };
  return [draft, set];
}

export function memberName(store: Store, id: string): string {
  return store.members.find((m) => m.id === id)?.name ?? '已移除的成員';
}

export function memberColor(store: Store, id: string): string {
  return store.members.find((m) => m.id === id)?.color ?? '#7A685B';
}

export function petName(store: Store, id: string): string {
  if (id === 'all') return '全部寵物';
  return store.pets.find((p) => p.id === id)?.name ?? '已移除的寵物';
}

export function initialOf(name: string): string {
  const n = name.trim();
  if (/^[小阿]/.test(n) && n.length > 1) return n[1];
  return n[0] ?? '?';
}

export function isOwner(store: Store): boolean {
  return store.me === store.ownerId;
}

export { sampleStore, emptyStore };
