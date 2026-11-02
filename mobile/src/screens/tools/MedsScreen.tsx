import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Screen, Btn, Card, Chip, ChipRow, Field, DateField, TimeField, Stepper, Toggle, Badge, Banner, PetChips, Section, ListCard, Sub, Row, Label, Empty, NumberField, Segment, confirm } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useBackHandler, useNav } from '../../nav';
import type { Med, MedFreq, Store } from '../../lib/types';
import { adherence, doseKey, entriesFor, FREQ_LABEL, medDueOn, nextDueDate } from '../../lib/domain';
import { addDays, daysBetween, shortDate, today } from '../../lib/date';
import { uid } from '../../lib/seed';
import { applyMedEdit, stopMed, freqText } from '../../lib/health';

const PRESET = ['07:00', '08:00', '09:00', '12:00', '18:00', '20:00', '21:00'];

function Ring({ pct }: { pct: number | null }) {
  const r = 34;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: 84, height: 84 }}>
      <Svg width={84} height={84} viewBox="0 0 84 84" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={42} cy={42} r={r} stroke={C.lineSoft} strokeWidth={10} fill="none" />
        {pct !== null ? (
          <Circle cx={42} cy={42} r={r} stroke={C.green} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={`${len}`} strokeDashoffset={len * (1 - pct / 100)} />
        ) : null}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 19, fontWeight: '700', color: C.ink }}>{pct === null ? '—' : `${pct}%`}</Text>
      </View>
    </View>
  );
}

function MedForm({ med, petId, onDone, dirty }: { med: Med | null; petId: string; onDone: () => void; dirty: React.MutableRefObject<boolean> }) {
  const { update, toast, store } = useStore();
  const nav = useNav();
  const td = today();
  const [name, setName] = useState(med?.name ?? '');
  const [dose, setDose] = useState(med?.dose ?? '');
  const [times, setTimes] = useState<string[]>(med?.times ?? ['08:00']);
  const [freq, setFreq] = useState<MedFreq>(med?.freq ?? 'daily');
  const [start, setStart] = useState(med?.start ?? td);
  const [days, setDays] = useState(med ? (med.end ? daysBetween(med.start, med.end) + 1 : 0) : 7);
  const [notify, setNotify] = useState(med?.notify ?? true);
  const [count, setCount] = useState<number | null>(med?.count ?? null);
  const [refillAt, setRefillAt] = useState<number | null>(med?.refillAt ?? 3);
  const [custom, setCustom] = useState('19:00');
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    dirty.current = true;
    fn(v);
  };
  const growth = entriesFor(store, petId, 'growth')[0];

  const toggleTime = (t: string) => {
    dirty.current = true;
    setTimes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort()));
  };

  const save = () => {
    if (!name.trim() || !times.length) {
      setTried(true);
      return;
    }
    const end = days > 0 ? addDays(start, days - 1) : null;
    const base = { petId, name: name.trim(), dose: dose.trim(), times: [...times].sort(), notify, freq, count, refillAt: refillAt ?? 0 };
    const scheduleChanged =
      !!med && (med.dose !== base.dose || med.freq !== freq || med.times.join() !== base.times.join());
    let msg = med ? '已更新用藥' : '已新增用藥';
    if (med && scheduleChanged && med.freq === 'daily' && freq === 'daily' && med.start < td && (!end || end >= td)) {
      msg = '已更新，新的服藥方式從今天開始；之前的紀錄保留不變';
    }
    update((d: Store) => {
      if (med) applyMedEdit(d, med.id, { ...base, start, end }, td, uid('m'));
      else d.meds.push({ id: uid('m'), ...base, start, end });
    });
    dirty.current = false;
    toast(msg);
    if (notify && !store.notifyEnabled) setSaved(true);
    else onDone();
  };

  if (saved) {
    return (
      <View style={{ gap: 12 }}>
        <Banner kind="warn" text="已儲存。要在服藥時間收到提醒，請先到「設定」開啟通知。" action={{ label: '前往設定', onPress: () => { onDone(); nav.push('settings'); } }} />
        <Btn kind="outline" title="之後再說" onPress={onDone} />
      </View>
    );
  }

  return (
    <Card style={{ gap: 14 }}>
      <Field label="藥品名稱" required value={name} onChangeText={touch(setName)} placeholder="例如：外用藥膏、心絲蟲預防藥" error={tried && !name.trim() ? '請填寫藥品名稱' : null} />
      <Field label="劑量" value={dose} onChangeText={touch(setDose)} placeholder="例如：1 顆、0.5 ml、薄擦一層" />
      <Sub>{growth ? `最近體重 ${growth.v.weight} kg（${growth.at.slice(0, 10).replace(/-/g, '/')} 記錄），依體重給藥時請以醫師處方為準。` : '還沒有體重紀錄。依體重給藥的藥物，請以醫師處方為準。'}</Sub>
      <View style={{ gap: 8 }}>
        <Label>多久吃一次</Label>
        <Segment options={[{ value: 'daily', label: '每天' }, { value: 'weekly', label: '每週' }, { value: 'monthly', label: '每月' }]} value={freq} onChange={touch(setFreq)} />
        <Sub>{freq === 'daily' ? '每天在下面的時間吃。' : freq === 'weekly' ? '每週同一天（開始日期那個星期幾）吃一次。' : '每月同一日（開始日期那一天）吃一次，適合心絲蟲、體內外驅蟲、除蚤滴劑。'}</Sub>
      </View>
      <View style={{ gap: 8 }}>
        <Label>服藥時間</Label>
        <ChipRow wrap>
          {Array.from(new Set([...PRESET, ...times])).sort().map((t) => (
            <Chip key={t} label={t} on={times.includes(t)} onPress={() => toggleTime(t)} />
          ))}
        </ChipRow>
        {tried && !times.length ? <Text style={{ fontSize: 12, color: C.danger }}>請至少選一個時間</Text> : null}
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <TimeField label="其他時間" value={custom} onChange={setCustom} />
          </View>
          <Btn
            small
            kind="outline"
            title={times.includes(custom) ? '已加入' : '加入'}
            disabled={times.includes(custom)}
            onPress={() => {
              dirty.current = true;
              setTimes([...times, custom].sort());
            }}
          />
        </Row>
      </View>
      <DateField label="開始日期" value={start} onChange={(v) => v && touch(setStart)(v)} />
      <View style={{ gap: 8 }}>
        <Label>療程</Label>
        <ChipRow wrap>
          {[7, 14, 30, 0].map((n) => (
            <Chip key={n} label={n ? `${n} 天` : '長期'} on={days === n} onPress={() => touch(setDays)(n)} />
          ))}
        </ChipRow>
        {days ? <Stepper value={days} onChange={touch(setDays)} min={1} max={365} unit="天" /> : null}
        {days ? <Sub>吃到 {addDays(start, days - 1).replace(/-/g, '/')}</Sub> : <Sub>長期服用，沒有結束日。</Sub>}
      </View>
      <Row gap={8} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <NumberField label="藥還剩幾次" value={count} onChange={touch(setCount)} integer placeholder="不記錄可留白" />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="剩幾次時提醒補藥" value={refillAt} onChange={touch(setRefillAt)} integer />
        </View>
      </Row>
      <Sub>有填「剩幾次」的話，每次打卡會自動減一，快吃完時會提醒你回診或補藥。</Sub>
      <Toggle label="到時間提醒我" value={notify} onChange={touch(setNotify)} />
      <Row>
        <Btn kind="outline" title="取消" style={{ flex: 1 }} onPress={() => { dirty.current = false; onDone(); }} />
        <Btn title="儲存" style={{ flex: 1 }} onPress={save} />
      </Row>
    </Card>
  );
}

export default function MedsScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId, day: td } = useStore();
  const pet = usePet();
  const [editing, setEditing] = useState<Med | 'new' | null>(null);
  const [which, setWhich] = useState<'today' | 'yesterday'>('today');
  const [showEnded, setShowEnded] = useState(false);
  const dirty = useRef(false);
  const scrollRef = useRef<any>(null);

  useBackHandler(
    editing
      ? () => {
          if (dirty.current) {
            confirm('放棄未儲存的內容？', '剛才的修改不會保留。', () => {
              dirty.current = false;
              setEditing(null);
            }, '放棄');
          } else setEditing(null);
          return true;
        }
      : null,
  );

  if (!pet) {
    return (
      <Screen title="用藥打卡" subtitle="排程與服藥紀錄">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

  const open = (m: Med | 'new') => {
    dirty.current = false;
    setEditing(m);
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  };

  if (editing) {
    return (
      <Screen title={editing === 'new' ? '新增用藥' : '編輯用藥'} subtitle={pet.name} scrollRef={scrollRef}>
        <MedForm med={editing === 'new' ? null : editing} petId={pet.id} dirty={dirty} onDone={() => setEditing(null)} />
      </Screen>
    );
  }

  const day = which === 'today' ? td : addDays(td, -1);
  const mine = store.meds.filter((m) => m.petId === pet.id);
  const adh = adherence(store, pet.id);
  const doses: { m: Med; t: string }[] = [];
  mine.filter((m) => medDueOn(m, day)).forEach((m) => m.times.forEach((t) => doses.push({ m, t })));
  doses.sort((a, b) => (a.t < b.t ? -1 : 1));

  const setDose = (m: Med, t: string, v: 'taken' | 'skip' | null) =>
    update((d) => {
      const k = doseKey(day, m.id, t);
      const prev = d.doses[k];
      const med = d.meds.find((x) => x.id === m.id);
      if (med && med.count !== null && med.count !== undefined) {
        if (prev !== 'taken' && v === 'taken') med.count = Math.max(0, med.count - 1);
        if (prev === 'taken' && v !== 'taken') med.count = med.count + 1;
      }
      if (v) d.doses[k] = v;
      else delete d.doses[k];
    });

  const ended = (m: Med) => !!m.end && m.end < td;
  const activeMeds = mine.filter((m) => !ended(m)).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  const endedMeds = mine.filter(ended).sort((a, b) => ((a.end ?? '') < (b.end ?? '') ? 1 : -1));

  const stop = (m: Med) => {
    const notYet = m.start >= td;
    confirm(
      notYet ? '取消這個療程？' : '停用這個用藥？',
      notYet ? `「${m.name}」從今天或之後才開始，取消後會直接移除；今天已打卡的會退回藥量。` : `「${m.name}」會在昨天結束，今天起不再提醒。過去的服藥紀錄會保留，今天已打卡的會退回藥量。`,
      () => {
        const res: { r: 'stopped' | 'removed' } = { r: 'stopped' };
        update((d) => {
          res.r = stopMed(d, m.id, td);
        });
        toast(res.r === 'removed' ? '已取消療程' : '已停用，今天起不再提醒');
      },
      notYet ? '取消療程' : '停用',
    );
  };

  const card = (m: Med) => {
    const isEnded = ended(m);
    const notStarted = m.start > td;
    const startsToday = m.start === td;
    const next = !isEnded ? nextDueDate(m, td) : null;
    const low = m.count !== null && m.count !== undefined && m.count <= m.refillAt;
    return (
      <Card key={m.id} style={{ gap: 8 }} onPress={() => open(m)}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: isEnded ? C.sub : C.ink, flex: 1 }}>{m.name}</Text>
          <Badge
            text={isEnded ? `${m.end ? shortDate(m.end) : ''} 已結束` : notStarted ? `${shortDate(m.start)} 開始` : m.end ? `到 ${shortDate(m.end)}` : '長期'}
            bg={isEnded ? C.sand : C.greenBg}
            fg={isEnded ? C.sub : C.greenDark}
          />
        </Row>
        <Sub>{[m.dose, freqText(m), m.times.join(' / '), m.notify ? '會提醒' : '不提醒'].filter(Boolean).join(' · ')}</Sub>
        {!isEnded && m.freq !== 'daily' && next ? <Sub>下次：{next.replace(/-/g, '/')}</Sub> : null}
        {m.count !== null && m.count !== undefined ? (
          <Row gap={6}>
            <Text style={{ fontSize: 13, color: C.ink }}>剩 {m.count} 次</Text>
            {low && !isEnded ? <Badge text="快吃完了，記得補藥" bg={C.yellowBg} fg={C.yellowInk} /> : null}
          </Row>
        ) : null}
        <Row>
          {!isEnded ? <Btn small kind="outline" title={notStarted || startsToday ? '取消療程' : '停用'} onPress={() => stop(m)} /> : null}
          <Btn
            small
            kind="danger"
            title="刪除"
            onPress={() =>
              confirm('刪除用藥', `確定刪除「${m.name}」和它的服藥紀錄嗎？`, () => {
                update((d) => {
                  d.meds = d.meds.filter((y) => y.id !== m.id);
                  for (const k of Object.keys(d.doses)) if (k.split('|')[1] === m.id) delete d.doses[k];
                });
                toast('已刪除');
              })
            }
          />
        </Row>
      </Card>
    );
  };

  return (
    <Screen title="用藥打卡" subtitle="排程與服藥紀錄" scrollRef={scrollRef}>
      <PetChips value={petId} onChange={setPetId} />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ring pct={adh.pct} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>7 天服藥率</Text>
          <Sub>{adh.pct !== null ? `已服用 ${adh.taken} / 應服 ${adh.sched} 次` : '近 7 天沒有排定的用藥'}</Sub>
        </View>
      </Card>

      <Section title={which === 'today' ? '今天的用藥' : '昨天的用藥（補登）'}>
        <Segment options={[{ value: 'today', label: '今天' }, { value: 'yesterday', label: '昨天' }]} value={which} onChange={setWhich} />
        {doses.length ? (
          <ListCard>
            {doses.map(({ m, t }) => {
              const st = store.doses[doseKey(day, m.id, t)];
              return (
                <Row key={m.id + t} style={{ paddingVertical: 10, paddingHorizontal: 14, minHeight: 64 }}>
                  <Text style={{ width: 48, fontSize: 14, fontWeight: '600', color: C.ink }}>{t}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: st ? C.sub : C.ink, textDecorationLine: st === 'skip' ? 'line-through' : 'none' }}>{m.name}</Text>
                    {m.dose ? <Sub>{m.dose}</Sub> : null}
                  </View>
                  {st ? (
                    <Pressable
                      onPress={() => setDose(m, t, null)}
                      accessibilityRole="button"
                      accessibilityLabel={`${st === 'taken' ? '已服用' : '已略過'}，點一下取消紀錄`}
                      style={{ minHeight: 44, minWidth: 72, justifyContent: 'center', alignItems: 'flex-end' }}
                      hitSlop={6}
                    >
                      <Badge text={st === 'taken' ? '已服用 ✓' : '已略過'} bg={st === 'taken' ? C.greenBg : C.sand} fg={st === 'taken' ? C.greenDark : C.sub} style={{ paddingVertical: 8, paddingHorizontal: 12 }} />
                    </Pressable>
                  ) : (
                    <Row gap={6}>
                      <Btn small kind="soft" title="略過" onPress={() => setDose(m, t, 'skip')} />
                      <Btn small title="打卡" style={{ backgroundColor: C.green }} onPress={() => { setDose(m, t, 'taken'); toast(`${m.name} 已服用`); }} />
                    </Row>
                  )}
                </Row>
              );
            })}
          </ListCard>
        ) : (
          <Card>
            <Empty text={which === 'today' ? '今天沒有要吃的藥' : '昨天沒有要吃的藥'} />
          </Card>
        )}
        {doses.some(({ m, t }) => store.doses[doseKey(day, m.id, t)]) ? <Sub>點「已服用」或「已略過」可以取消紀錄。</Sub> : null}
      </Section>

      <Section title="用藥清單" action={{ label: '＋ 新增用藥', onPress: () => open('new') }}>
        {activeMeds.length ? activeMeds.map(card) : (
          <Card>
            <Empty text={`${pet.name}目前沒有進行中的用藥`} action={{ label: '新增用藥', onPress: () => open('new') }} />
          </Card>
        )}
        {endedMeds.length ? (
          <>
            <Btn small kind="ghost" title={showEnded ? `收合已結束的用藥` : `已結束的用藥（${endedMeds.length}）`} onPress={() => setShowEnded(!showEnded)} style={{ alignSelf: 'flex-start' }} />
            {showEnded ? endedMeds.map(card) : null}
          </>
        ) : null}
        <Sub>點卡片可以編輯。心絲蟲、驅蟲等每月一次的藥，新增時選「每月」。</Sub>
      </Section>
    </Screen>
  );
}
