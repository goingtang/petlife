import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Store, Pet, Member } from './types';
import { emptyStore, sampleStore, STORE_VERSION } from './seed';

const KEY = 'petpal.store.v1';

/** Fill in any fields a newer app version added, without throwing away the user's data. */
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
  return out as Store;
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
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>(emptyStore);
  const [ready, setReady] = useState(false);
  const [petId, setPetIdState] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(store);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const s = migrate(JSON.parse(raw));
          latest.current = s;
          setStore(s);
        }
      } catch {
        // Corrupt data: start fresh rather than crash. The old value stays in storage untouched.
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback((s: Store) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
    }, 250);
  }, []);

  const update = useCallback(
    (fn: Updater) => {
      const draft: Store = JSON.parse(JSON.stringify(latest.current));
      fn(draft);
      latest.current = draft;
      setStore(draft);
      persist(draft);
    },
    [persist],
  );

  const replace = useCallback(
    (s: Store) => {
      latest.current = s;
      setStore(s);
      persist(s);
    },
    [persist],
  );

  const toast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2400);
  }, []);

  // Keep the selected pet valid as pets are added/removed.
  const currentPet = store.pets.find((p) => p.id === petId) ? petId : store.pets[0]?.id ?? null;

  const value = useMemo<Ctx>(
    () => ({ store, ready, update, replace, petId: currentPet, setPetId: setPetIdState, toast, toastMsg }),
    [store, ready, update, replace, currentPet, toast, toastMsg],
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

export function memberName(store: Store, id: string): string {
  return store.members.find((m) => m.id === id)?.name ?? '已移除的成員';
}

export function memberColor(store: Store, id: string): string {
  return store.members.find((m) => m.id === id)?.color ?? '#9C8B7E';
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

export { sampleStore, emptyStore };
