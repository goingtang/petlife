// Minimal navigation: five bottom tabs plus a stack of pushed screens on top.
// Kept dependency-free so it behaves the same in Expo Go, Snack and the web preview.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

export type TabName = 'today' | 'diary' | 'health' | 'act' | 'more';

export interface Route {
  key: string;
  name: string;
  params: any;
}

/** Return true when the back press was handled (e.g. a sub-view closed), false to leave the screen. */
export type BackFn = () => boolean;

interface NavCtx {
  tab: TabName;
  setTab: (t: TabName) => void;
  stack: Route[];
  push: (name: string, params?: any) => void;
  /** Go to a screen; if it is already open further down the stack, return to it instead of stacking another copy. */
  pushUnique: (name: string, params?: any) => void;
  replace: (name: string, params?: any) => void;
  /** Leave the top screen immediately (after saving). */
  pop: () => void;
  /** What the back button / Android back key do: ask the screen first, then pop. */
  back: () => void;
  popToRoot: () => void;
  registerBack: (routeKey: string, id: number, fn: BackFn | null) => void;
  /**
   * True while an open screen has an edit form or sub-view that wants to be closed first (it registered
   * a back handler). Used before jumping elsewhere (e.g. after tapping a notification) so typed input isn't lost.
   */
  hasOpenForm: () => boolean;
}

const Ctx = createContext<NavCtx | null>(null);
/** The key of the route a component is rendered in. Tab screens use `tab:<name>`. */
export const RouteKeyCtx = createContext<string | undefined>(undefined);
let k = 0;
let handlerSeq = 0;

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTabState] = useState<TabName>('today');
  const [stack, setStack] = useState<Route[]>([]);
  // Per screen, a stack of handlers (several sub-views on one screen may each register one);
  // the most recently mounted runs first.
  const handlers = useRef(new Map<string, { id: number; fn: BackFn }[]>());
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const runHandlers = useCallback((key: string) => {
    const list = handlers.current.get(key) ?? [];
    for (let i = list.length - 1; i >= 0; i--) if (list[i].fn()) return true;
    return false;
  }, []);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const push = useCallback((name: string, params?: any) => setStack((s) => [...s, { key: `r${++k}`, name, params: params ?? {} }]), []);
  const pushUnique = useCallback(
    (name: string, params?: any) =>
      setStack((s) => {
        const i = s.findIndex((r) => r.name === name);
        if (i < 0) return [...s, { key: `r${++k}`, name, params: params ?? {} }];
        return [...s.slice(0, i), { ...s[i], params: params ?? s[i].params }];
      }),
    [],
  );
  const replace = useCallback((name: string, params?: any) => setStack((s) => [...s.slice(0, -1), { key: `r${++k}`, name, params: params ?? {} }]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const popToRoot = useCallback(() => setStack([]), []);
  const back = useCallback(() => {
    const top = stackRef.current[stackRef.current.length - 1];
    if (!top) {
      // Same as the Android back key on a tab: close a sub-view, otherwise go to 今天.
      if (!runHandlers(`tab:${tabRef.current}`) && tabRef.current !== 'today') setTabState('today');
      return;
    }
    if (runHandlers(top.key)) return;
    setStack((s) => s.slice(0, -1));
  }, [runHandlers]);
  const setTab = useCallback((t: TabName) => {
    setStack([]);
    setTabState(t);
  }, []);
  const registerBack = useCallback((routeKey: string, id: number, fn: BackFn | null) => {
    const list = (handlers.current.get(routeKey) ?? []).filter((h) => h.id !== id);
    if (fn) {
      list.push({ id, fn });
      // Keep handlers in the order their components first mounted (ids grow with mount order), so a
      // handler that switches off and on again doesn't jump ahead of a sub-view opened after it.
      list.sort((a, b) => a.id - b.id);
    }
    if (list.length) handlers.current.set(routeKey, list);
    else handlers.current.delete(routeKey);
  }, []);

  const hasOpenForm = useCallback(() => {
    const keys = [`tab:${tabRef.current}`, ...stackRef.current.map((r) => r.key)];
    return keys.some((key) => (handlers.current.get(key)?.length ?? 0) > 0);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stackRef.current.length) {
        back();
        return true;
      }
      if (runHandlers(`tab:${tab}`)) return true;
      if (tab !== 'today') {
        setTabState('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab, back, runHandlers]);

  const value = useMemo(
    () => ({ tab, setTab, stack, push, pushUnique, replace, pop, back, popToRoot, registerBack, hasOpenForm }),
    [tab, setTab, stack, push, pushUnique, replace, pop, back, popToRoot, registerBack, hasOpenForm],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): NavCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNav outside NavProvider');
  return c;
}

/**
 * Let a screen intercept back (header button, Android back key, iOS swipe).
 * Pass `null` when there is nothing to intercept. Example: close an open edit form instead of leaving the tool.
 */
export function useBackHandler(fn: BackFn | null) {
  const key = useContext(RouteKeyCtx);
  const { registerBack } = useNav();
  const ref = useRef(fn);
  ref.current = fn;
  const id = useRef(0);
  if (!id.current) id.current = ++handlerSeq;
  const active = !!fn;
  useEffect(() => {
    if (!key) return;
    registerBack(key, id.current, active ? () => (ref.current ? ref.current() : false) : null);
    return () => registerBack(key, id.current, null);
  }, [key, active, registerBack]);
}
