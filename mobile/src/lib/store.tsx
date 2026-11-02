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
  toastMsg: string | null;
  /** Today's date; changes when the app is reopened on a new day, so screens re-render. */
  day: string;
}

const StoreCtx = createContext<Ctx | null>(null);

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
  const failedOnce = useRef(false);
  const savedOnce = useRef(false);

  const toast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const persist = useCallback(
    (delay = 300) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        // Serialize writes so two saves never interleave.
        saving.current = saving.current.then(async () => {
          try {
            await saveRaw(JSON.stringify(latest.current));
            failedOnce.current = false;
            if (!savedOnce.current) {
              savedOnce.current = true;
              clearLegacy();
            }
          } catch {
            if (!failedOnce.current) toast('資料沒有存成功，請確認手機空間後再試');
            failedOnce.current = true;
            persist(5000); // retry later; the data is still in memory
          }
        });
      }, delay);
    },
    [toast],
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
      const raw = await loadRaw();
      if (raw) {
        const s = produce(migrate(raw), (d) => dailyMaintenance(d));
        latest.current = s;
        setStore(s);
        persist(50); // writes the migrated file (moves data out of the old AsyncStorage key)
      }
      setReady(true);
    })();
  }, [persist]);

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
    () => ({ store, ready, update, replace, petId: currentPet, setPetId: setPetIdState, toast, toastMsg, day }),
    [store, ready, update, replace, currentPet, toast, toastMsg, day],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
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
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) commitRef.current(pending.current);
    },
    [],
  );
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
