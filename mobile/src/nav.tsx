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
  registerBack: (routeKey: string, fn: BackFn | null) => void;
}

const Ctx = createContext<NavCtx | null>(null);
/** The key of the route a component is rendered in (undefined on tab screens). */
export const RouteKeyCtx = createContext<string | undefined>(undefined);
let k = 0;

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTabState] = useState<TabName>('today');
  const [stack, setStack] = useState<Route[]>([]);
  const handlers = useRef(new Map<string, BackFn>());
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
    if (!top) return;
    const fn = handlers.current.get(top.key);
    if (fn && fn()) return;
    setStack((s) => s.slice(0, -1));
  }, []);
  const setTab = useCallback((t: TabName) => {
    setStack([]);
    setTabState(t);
  }, []);
  const registerBack = useCallback((routeKey: string, fn: BackFn | null) => {
    if (fn) handlers.current.set(routeKey, fn);
    else handlers.current.delete(routeKey);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stackRef.current.length) {
        back();
        return true;
      }
      if (tab !== 'today') {
        setTabState('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab, back]);

  const value = useMemo(
    () => ({ tab, setTab, stack, push, pushUnique, replace, pop, back, popToRoot, registerBack }),
    [tab, setTab, stack, push, pushUnique, replace, pop, back, popToRoot, registerBack],
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
  const active = !!fn;
  useEffect(() => {
    if (!key) return;
    registerBack(key, active ? () => (ref.current ? ref.current() : false) : null);
    return () => registerBack(key, null);
  }, [key, active, registerBack]);
}
