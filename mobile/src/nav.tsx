// Minimal navigation: five bottom tabs plus a stack of pushed screens on top.
// Kept dependency-free so it behaves the same in Expo Go, Snack and the web preview.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';

export type TabName = 'today' | 'diary' | 'health' | 'act' | 'more';

export interface Route {
  key: string;
  name: string;
  params: any;
}

interface NavCtx {
  tab: TabName;
  setTab: (t: TabName) => void;
  stack: Route[];
  push: (name: string, params?: any) => void;
  replace: (name: string, params?: any) => void;
  pop: () => void;
  popToRoot: () => void;
}

const Ctx = createContext<NavCtx | null>(null);
let k = 0;

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTabState] = useState<TabName>('today');
  const [stack, setStack] = useState<Route[]>([]);

  const push = useCallback((name: string, params?: any) => setStack((s) => [...s, { key: `r${++k}`, name, params: params ?? {} }]), []);
  const replace = useCallback((name: string, params?: any) => setStack((s) => [...s.slice(0, -1), { key: `r${++k}`, name, params: params ?? {} }]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const popToRoot = useCallback(() => setStack([]), []);
  const setTab = useCallback((t: TabName) => {
    setStack([]);
    setTabState(t);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) {
        pop();
        return true;
      }
      if (tab !== 'today') {
        setTabState('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, tab, pop]);

  const value = useMemo(() => ({ tab, setTab, stack, push, replace, pop, popToRoot }), [tab, setTab, stack, push, replace, pop, popToRoot]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): NavCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNav outside NavProvider');
  return c;
}
