import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, InteractionManager, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StoreProvider, useStore, useToastMsg } from './src/lib/store';
import { cleanupCacheExports } from './src/lib/files';
import { NavProvider, useNav, TabName, RouteKeyCtx, Route } from './src/nav';
import { SCREENS } from './src/screens/registry';
import TodayScreen from './src/screens/TodayScreen';
import DiaryScreen from './src/screens/DiaryScreen';
import HealthScreen from './src/screens/HealthScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import MoreScreen from './src/screens/MoreScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { initNotifications, syncNotifications } from './src/lib/notify';
import { C } from './src/ui/theme';

// Keep the launch screen up until the saved data has loaded, so the app never flashes an empty screen.
// Never longer than 8 seconds, even if loading hangs or the first screen fails to draw.
SplashScreen.preventAutoHideAsync().catch(() => {});
const hideSplash = () => SplashScreen.hideAsync().catch(() => {});
setTimeout(hideSplash, 8000);

/** Last line of defence: a screen that throws shows a way out instead of a blank (or frozen splash) app. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch() {
    hideSplash();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 28, gap: 14 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: C.ink }}>發生了一點問題</Text>
        <Text style={{ fontSize: 15, lineHeight: 23, color: C.body, textAlign: 'center' }}>
          你的資料仍保存在手機裡。請按下面的按鈕再試一次；如果一直出現，請完全關閉 App 後重新開啟，並來信 mypetlifedaily@gmail.com。
        </Text>
        <Pressable
          onPress={() => this.setState({ error: null })}
          accessibilityRole="button"
          style={{ minHeight: 48, paddingHorizontal: 28, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>再試一次</Text>
        </Pressable>
      </View>
    );
  }
}

const TABS: { k: TabName; name: string; d: string; d2?: string }[] = [
  { k: 'today', name: '今天', d: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z' },
  { k: 'diary', name: '日記', d: 'M6 3h10l3 3v15H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', d2: 'M9 10h6M9 14h6M9 18h3' },
  { k: 'health', name: '健康', d: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
  { k: 'act', name: '活動', d: 'M3 12h4l2-5 4 10 2-5h6' },
  { k: 'more', name: '更多', d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z', d2: 'M14 14h6v6h-6z' },
];

const TAB_SCREENS: Record<TabName, React.ComponentType> = {
  today: TodayScreen,
  diary: DiaryScreen,
  health: HealthScreen,
  act: ActivityScreen,
  more: MoreScreen,
};

function TabBar() {
  const { tab, setTab } = useNav();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.bar, { bottom: insets.bottom + 10 }]}>
      {TABS.map((t) => {
        const on = t.k === tab;
        return (
          <Pressable
            key={t.k}
            onPress={() => setTab(t.k)}
            style={[st.tab, on && { backgroundColor: C.bg }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.name}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={on ? C.ink : '#EFE4D6'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d={t.d} />
              {t.d2 ? <Path d={t.d2} /> : null}
            </Svg>
            <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ fontSize: 12, color: on ? C.ink : '#EFE4D6', fontWeight: '500' }}>{t.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toast() {
  const { toast, dismiss } = useToastMsg();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    // Android reads the live region below; iOS VoiceOver needs an explicit announcement.
    if (toast && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(toast.action ? `${toast.msg}，可${toast.action.label}` : toast.msg);
  }, [toast]);
  if (!toast) return null;
  const action = toast.action;
  return (
    <View pointerEvents="box-none" style={[st.toastWrap, { top: insets.top + 12 }]}>
      <View pointerEvents={action ? 'auto' : 'none'} style={[st.toast, action && st.toastRow]} accessibilityLiveRegion="polite">
        <Text maxFontSizeMultiplier={1.5} style={{ color: C.bg, fontSize: 14, fontWeight: '500', textAlign: action ? 'left' : 'center', flexShrink: 1 }}>{toast.msg}</Text>
        {action ? (
          <Pressable
            onPress={() => {
              dismiss();
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={6}
            style={{ minHeight: 44, minWidth: 56, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: C.bg }}
          >
            <Text style={{ color: C.ink, fontSize: 14, fontWeight: '700' }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Keep phone notifications in step with reminders and medication schedules. */
function NotificationSync() {
  const { store, ready, day } = useStore();
  const latest = useRef(store);
  latest.current = store;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    initNotifications();
    // PDFs/CSVs shared during the last session; not urgent, so wait until the first screen has settled.
    const task = InteractionManager.runAfterInteractions(() => cleanupCacheExports());
    return () => {
      task.cancel();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  // immer keeps unchanged parts of the store identical, so these references only change when that data changes.
  // syncNotifications itself skips the phone's scheduler when the planned notifications are unchanged.
  useEffect(() => {
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      syncNotifications(latest.current);
    }, 1500);
  }, [ready, day, store.notifyEnabled, store.reminders, store.meds, store.doses, store.supplies, store.groom, store.pets]);
  return null;
}

/** A pushed screen: slides in from the right; on iOS it can be dragged back from the left edge. */
function StackScreen({ route, visible, top }: { route: Route; visible: boolean; top: boolean }) {
  const { back } = useNav();
  const { width } = useWindowDimensions();
  const W = useRef(width);
  W.current = width;
  const x = useRef(new Animated.Value(Platform.OS === 'web' ? 0 : width)).current;
  const mounted = useRef(true);
  useEffect(() => {
    Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    return () => {
      mounted.current = false;
    };
  }, [x]);
  const springBack = () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
  const pan = useRef(
    PanResponder.create({
      // iOS only: claim the gesture in the capture phase when it starts at the very left edge,
      // so horizontal chip rows there don't swallow it.
      onMoveShouldSetPanResponderCapture: (e, g) => Platform.OS === 'ios' && g.x0 < 20 && g.dx > 8 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderMove: (e, g) => x.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (e, g) => {
        if (g.dx > W.current / 3 || g.vx > 0.8) {
          Animated.timing(x, { toValue: W.current, duration: 160, useNativeDriver: true }).start(() => {
            back();
            // If the screen asked to stay (e.g. unsaved changes), slide it back in.
            setTimeout(() => {
              if (mounted.current) springBack();
            }, 30);
          });
        } else springBack();
      },
      onPanResponderTerminate: springBack,
    }),
  ).current;
  const S = SCREENS[route.name];
  if (!S) return null;
  return (
    <Animated.View
      {...pan.panHandlers}
      pointerEvents={top ? 'auto' : 'none'}
      // Screens below the top one stay drawn (for swipe-back) but must not be read by screen readers.
      accessibilityElementsHidden={!top}
      aria-hidden={!top}
      importantForAccessibility={top ? 'auto' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, { backgroundColor: C.bg, display: visible ? 'flex' : 'none', transform: [{ translateX: x }] }]}
    >
      <RouteKeyCtx.Provider value={route.key}>
        <S params={route.params} />
      </RouteKeyCtx.Provider>
    </Animated.View>
  );
}

function Shell() {
  const { store, ready } = useStore();
  const { tab, stack } = useNav();
  useEffect(() => {
    if (ready) hideSplash();
  }, [ready]);
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: C.accent }}>PetPal</Text>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  if (!store.onboarded) return <OnboardingScreen />;
  const TabScreen = TAB_SCREENS[tab];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* The screen right below the top one stays visible so an iOS swipe-back reveals it. */}
      <View
        style={{ flex: 1, display: stack.length <= 1 ? 'flex' : 'none' }}
        pointerEvents={stack.length ? 'none' : 'auto'}
        accessibilityElementsHidden={stack.length > 0}
        aria-hidden={stack.length > 0}
        importantForAccessibility={stack.length ? 'no-hide-descendants' : 'auto'}
      >
        <RouteKeyCtx.Provider value={`tab:${tab}`}>
          <TabScreen />
        </RouteKeyCtx.Provider>
        <TabBar />
      </View>
      {stack.map((r, i) => (
        <StackScreen key={r.key} route={r} visible={i >= stack.length - 2} top={i === stack.length - 1} />
      ))}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <NavProvider>
          <StatusBar style="dark" />
          <ErrorBoundary>
            <Shell />
          </ErrorBoundary>
          <NotificationSync />
          <Toast />
        </NavProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  bar: {
    position: 'absolute', left: 14, right: 14, minHeight: 68, paddingVertical: 6, borderRadius: 34, backgroundColor: C.ink,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6,
    shadowColor: '#3B2F28', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  tab: { flex: 1, minHeight: 56, paddingVertical: 4, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 3 },
  toastWrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center', zIndex: 100 },
  toast: { backgroundColor: C.ink, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, maxWidth: 360 },
  toastRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingRight: 6 },
});
