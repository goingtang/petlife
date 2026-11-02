import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={on ? C.ink : '#D8C8B4'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d={t.d} />
              {t.d2 ? <Path d={t.d2} /> : null}
            </Svg>
            <Text style={{ fontSize: 11, color: on ? C.ink : '#D8C8B4', fontWeight: '500' }}>{t.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toast() {
  const toastMsg = useToastMsg();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    // Android reads the live region below; iOS VoiceOver needs an explicit announcement.
    if (toastMsg && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(toastMsg);
  }, [toastMsg]);
  if (!toastMsg) return null;
  return (
    <View pointerEvents="none" style={[st.toastWrap, { top: insets.top + 12 }]}>
      <View style={st.toast} accessibilityLiveRegion="polite">
        <Text style={{ color: C.bg, fontSize: 14, fontWeight: '500', textAlign: 'center' }}>{toastMsg}</Text>
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
    cleanupCacheExports(); // PDFs/CSVs shared during the last session
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  // immer keeps unchanged parts of the store identical, so these references only change when that data changes.
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
      <View style={{ flex: 1, display: stack.length <= 1 ? 'flex' : 'none' }} pointerEvents={stack.length ? 'none' : 'auto'}>
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
          <Shell />
          <NotificationSync />
          <Toast />
        </NavProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  bar: {
    position: 'absolute', left: 14, right: 14, height: 68, borderRadius: 34, backgroundColor: C.ink,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6,
    shadowColor: '#3B2F28', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  tab: { flex: 1, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 3 },
  toastWrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center', zIndex: 100 },
  toast: { backgroundColor: C.ink, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, maxWidth: 360 },
});
