import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useStore, usePet, memberName } from '../lib/store';
import { useNav, useBackHandler } from '../nav';
import { Btn, Card, DateField, Empty, ListCard, PetChips, Row, Screen, Section, Stepper, Sub, confirm } from '../ui/kit';
import { C } from '../ui/theme';
import { addDays, hm, relTime, today, weekday, ymd } from '../lib/date';
import { entriesFor } from '../lib/domain';
import type { Store } from '../lib/types';
import { uid } from '../lib/seed';

const ACT: Record<string, { label: string; start: string; goal: number }> = {
  dog: { label: '散步', start: '出門散步', goal: 40 },
  cat: { label: '遊戲時間', start: '開始逗貓', goal: 20 },
  rabbit: { label: '放風時間', start: '開始放風', goal: 60 },
  bird: { label: '放鳥時間', start: '開始放鳥', goal: 60 },
  other: { label: '活動', start: '開始計時', goal: 30 },
};

type Timer = NonNullable<Store['timer']>;

const elapsedOf = (t: Timer | null) => (t ? Math.floor(t.accumulated + (t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0)) : 0);

/** The clock and ring own the 1-second tick, so the rest of the screen (stats, list) doesn't re-render every second. */
function TimerFace({ timer, goalMin }: { timer: Timer | null; goalMin: number }) {
  const [, tick] = useState(0);
  const running = !!timer?.startedAt;
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);
  const { width } = useWindowDimensions();
  const size = Math.max(160, Math.min(220, width - 120));
  const r = size / 2 - 14;
  const ring = 2 * Math.PI * r;
  const elapsed = elapsedOf(timer);
  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.lineSoft} strokeWidth={16} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.green} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${ring}`} strokeDashoffset={ring * (1 - Math.min(1, elapsed / (goalMin * 60)))} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Sub>{running ? '進行中' : elapsed ? '已暫停' : '準備好了嗎？'}</Sub>
        <Text
          maxFontSizeMultiplier={1.3}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{ fontSize: size >= 200 ? 46 : 38, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] }}
          accessibilityLabel={`已經 ${mm} 分 ${ss} 秒`}
        >
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </Text>
        <Sub>目標 {goalMin} 分鐘</Sub>
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [manual, setManual] = useState(false);
  useBackHandler(manual ? () => (setManual(false), true) : null);
  const [mMin, setMMin] = useState(30);
  const [mDate, setMDate] = useState(today());

  const t = store.timer;
  const running = !!t?.startedAt;
  const td = today();
  const goalMin = pet ? (ACT[pet.kind] ?? ACT.other).goal : 30;
  const acts = useMemo(() => (pet ? entriesFor(store, pet.id, 'activity') : []), [store.entries, pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => {
    const week = Array.from({ length: 7 }, (_, i) => addDays(td, i - 6)).map((d) => ({
      d,
      min: acts.filter((e) => e.at.startsWith(d)).reduce((s, e) => s + Number(e.v.min || 0), 0),
    }));
    return {
      week,
      wmax: Math.max(goalMin, ...week.map((w) => w.min)),
      total: week.reduce((s, w) => s + w.min, 0),
      hit: week.filter((w) => w.min >= goalMin).length,
    };
  }, [acts, td, goalMin]);

  if (!pet)
    return (
      <Screen root title="活動">
        <Empty text="先新增寵物，才能記錄活動" action={{ label: '新增寵物', onPress: () => nav.push('petEdit', {}) }} />
      </Screen>
    );

  const a = ACT[pet.kind] ?? ACT.other;
  const mine = t && t.petId === pet.id ? t : null;
  const otherPet = t && t.petId !== pet.id ? store.pets.find((p) => p.id === t.petId) : null;
  // A timer exists for this pet once it has been started (even if paused at 0 seconds).
  const started = !!mine;

  const start = () => {
    if (otherPet) {
      toast(`${otherPet.name} 的計時還在進行，先結束那一段`);
      return;
    }
    update((d) => {
      d.timer = { petId: pet.id, startedAt: Date.now(), accumulated: mine?.accumulated ?? 0 };
    });
  };
  const pause = () =>
    update((d) => {
      if (d.timer?.startedAt) {
        d.timer.accumulated += (Date.now() - d.timer.startedAt) / 1000;
        d.timer.startedAt = null;
      }
    });
  const finish = () => {
    const elapsed = elapsedOf(mine);
    const min = Math.max(1, Math.round(elapsed / 60));
    // Log on the day the session started (a walk from 23:50 to 00:20 belongs to the first day).
    const startedAt = new Date(Date.now() - elapsed * 1000);
    update((d) => {
      d.entries.push({ id: uid('e'), petId: pet.id, form: 'activity', at: `${ymd(startedAt)}T${hm(startedAt)}`, who: d.me, v: { min } });
      d.timer = null;
    });
    toast(`已記錄 ${min} 分鐘${a.label}`);
  };
  const cancel = () => confirm('放棄這次計時？', '不會留下紀錄。', () => update((d) => { d.timer = null; }), '放棄');

  const { week, wmax, total, hit } = stats;

  return (
    <Screen root title="活動" subtitle={`${pet.name}的${a.label}`}>
      <PetChips value={petId} onChange={setPetId} />
      {otherPet ? <Sub style={{ color: C.danger }}>{otherPet.name} 正在計時中。切換回 {otherPet.name} 可以暫停或結束。</Sub> : null}

      <Card style={{ alignItems: 'center', gap: 20, paddingVertical: 24, borderRadius: 32 }}>
        <TimerFace timer={mine} goalMin={a.goal} />
        <Row style={{ alignSelf: 'stretch' }} gap={10}>
          <Btn title={running && mine ? '暫停' : started ? '繼續' : a.start} onPress={running && mine ? pause : start} style={{ flex: 1 }} />
          {started ? <Btn kind="outline" title="完成並記錄" onPress={finish} style={{ flex: 1 }} /> : null}
        </Row>
        {started ? <Btn small kind="ghost" title="放棄這次計時" onPress={cancel} /> : <Sub style={{ fontSize: 12 }}>離開 App 也會繼續計時</Sub>}
      </Card>

      <Card style={{ gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>最近 7 天</Text>
          <Sub>共 {total} 分鐘 · {hit} 天達標</Sub>
        </Row>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 120, gap: 8 }}>
          {week.map((w) => (
            <View key={w.d} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: C.sub }}>{w.min || ''}</Text>
              <View style={{ width: '100%', maxWidth: 28, height: Math.max(6, Math.round((w.min / wmax) * 72)), borderRadius: 10, backgroundColor: w.d === td ? C.accent : w.min >= a.goal ? C.green : '#E5D8C6' }} />
              <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: w.d === td ? C.ink : C.sub, fontWeight: w.d === td ? '700' : '400' }}>{w.d === td ? '今' : weekday(w.d)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Section title="紀錄" action={{ label: manual ? '取消' : '＋ 補登', onPress: () => setManual(!manual) }}>
        {manual ? (
          <Card style={{ gap: 12 }}>
            <DateField label="日期" value={mDate} onChange={(x) => x && setMDate(x)} />
            <Stepper label="時間長度" value={mMin} onChange={setMMin} step={5} min={5} unit="分鐘" />
            <Btn
              title="儲存"
              onPress={() => {
                update((d) => {
                  d.entries.push({ id: uid('e'), petId: pet.id, form: 'activity', at: mDate === today() ? `${mDate}T${hm()}` : `${mDate}T12:00`, who: d.me, v: { min: mMin } });
                });
                setManual(false);
                toast('已補登');
              }}
            />
          </Card>
        ) : null}
        {acts.length ? (
          <ListCard>
            {acts.slice(0, 10).map((e) => (
              <Row key={e.id} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{relTime(e.at)}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{e.v.min} 分鐘</Text>
                <Sub style={{ width: 52, textAlign: 'right' }}>{memberName(store, e.who)}</Sub>
                <Btn
                  small
                  kind="ghost"
                  title="刪除"
                  accessibilityLabel={`刪除 ${relTime(e.at)} ${e.v.min} 分鐘`}
                  onPress={() => {
                    update((d) => {
                      d.entries = d.entries.filter((x) => x.id !== e.id);
                    });
                    toast('已刪除', { action: { label: '復原', onPress: () => update((d) => { if (!d.entries.some((x) => x.id === e.id)) d.entries.push(e); }) } });
                  }}
                  textStyle={{ color: C.danger }}
                />
              </Row>
            ))}
          </ListCard>
        ) : (
          <Empty text="還沒有活動紀錄。按上面的按鈕開始計時，或補登一筆" action={{ label: '＋ 補登', onPress: () => setManual(true) }} />
        )}
      </Section>
    </Screen>
  );
}
