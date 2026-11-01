import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Screen, Btn, Card, Chip, ChipRow, Field, DateField, TimeField, Stepper, Toggle, Badge, Banner, PetChips, Section, ListCard, Sub, Row, Label, Empty, confirm } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useNav } from '../../nav';
import type { Med } from '../../lib/types';
import { adherence, doseKey, medActiveOn } from '../../lib/domain';
import { addDays, daysBetween, shortDate, today } from '../../lib/date';
import { uid } from '../../lib/seed';

const PRESET = ['07:00', '08:00', '09:00', '12:00', '18:00', '20:00', '21:00'];

function Ring({ pct }: { pct: number }) {
  const r = 34;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: 84, height: 84 }}>
      <Svg width={84} height={84} viewBox="0 0 84 84" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={42} cy={42} r={r} stroke={C.lineSoft} strokeWidth={10} fill="none" />
        <Circle cx={42} cy={42} r={r} stroke={C.green} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={`${len}`} strokeDashoffset={len * (1 - pct / 100)} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 19, fontWeight: '700', color: C.ink }}>{pct}%</Text>
      </View>
    </View>
  );
}

function MedForm({ med, petId, onDone }: { med: Med | null; petId: string; onDone: () => void }) {
  const { update, toast, store } = useStore();
  const nav = useNav();
  const td = today();
  const [name, setName] = useState(med?.name ?? '');
  const [dose, setDose] = useState(med?.dose ?? '');
  const [times, setTimes] = useState<string[]>(med?.times ?? ['08:00']);
  const [start, setStart] = useState(med?.start ?? td);
  const [days, setDays] = useState(med ? (med.end ? daysBetween(med.start, med.end) + 1 : 0) : 7);
  const [notify, setNotify] = useState(med?.notify ?? true);
  const [custom, setCustom] = useState('19:00');
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleTime = (t: string) => setTimes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort()));

  const save = () => {
    if (!name.trim() || !times.length) {
      setTried(true);
      return;
    }
    const m: Med = { id: med?.id ?? uid('m'), petId, name: name.trim(), dose: dose.trim(), times: [...times].sort(), start, end: days > 0 ? addDays(start, days - 1) : null, notify };
    update((d) => {
      const i = d.meds.findIndex((x) => x.id === m.id);
      if (i >= 0) d.meds[i] = m;
      else d.meds.push(m);
    });
    toast(med ? '已更新用藥' : '已新增用藥');
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
      <Field label="藥品名稱" required value={name} onChangeText={setName} placeholder="例如：外用藥膏、益生菌" error={tried && !name.trim() ? '請填寫藥品名稱' : null} />
      <Field label="劑量" value={dose} onChangeText={setDose} placeholder="例如：1 顆、薄擦一層" />
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
          <Btn small kind="outline" title="加入" onPress={() => !times.includes(custom) && setTimes([...times, custom].sort())} />
        </Row>
      </View>
      <DateField label="開始日期" value={start} onChange={(v) => v && setStart(v)} />
      <Stepper label="天數（0 = 長期服用）" value={days} onChange={setDays} min={0} max={365} unit={days ? '天' : '長期'} />
      <Toggle label="到時間提醒我" value={notify} onChange={setNotify} />
      <Row>
        <Btn kind="outline" title="取消" style={{ flex: 1 }} onPress={onDone} />
        <Btn title="儲存" style={{ flex: 1 }} onPress={save} />
      </Row>
    </Card>
  );
}

export default function MedsScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const [editing, setEditing] = useState<Med | 'new' | null>(null);
  const td = today();

  if (!pet) {
    return (
      <Screen title="用藥打卡" subtitle="排程與服藥紀錄">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

  const mine = store.meds.filter((m) => m.petId === pet.id);
  const adh = adherence(store, pet.id);
  const doses: { m: Med; t: string }[] = [];
  mine.filter((m) => medActiveOn(m, td)).forEach((m) => m.times.forEach((t) => doses.push({ m, t })));
  doses.sort((a, b) => (a.t < b.t ? -1 : 1));

  const setDose = (m: Med, t: string, v: 'taken' | 'skip' | null) =>
    update((d) => {
      const k = doseKey(td, m.id, t);
      if (v) d.doses[k] = v;
      else delete d.doses[k];
    });

  if (editing) {
    return (
      <Screen title={editing === 'new' ? '新增用藥' : '編輯用藥'} subtitle={pet.name}>
        <MedForm med={editing === 'new' ? null : editing} petId={pet.id} onDone={() => setEditing(null)} />
      </Screen>
    );
  }

  return (
    <Screen title="用藥打卡" subtitle="排程與服藥紀錄">
      <PetChips value={petId} onChange={setPetId} />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ring pct={adh.pct} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>7 天服藥率</Text>
          <Sub>{adh.sched ? `已服用 ${adh.taken} / 應服 ${adh.sched} 次` : '近 7 天沒有排定的用藥'}</Sub>
        </View>
      </Card>

      <Section title="今天的用藥">
        {doses.length ? (
          <ListCard>
            {doses.map(({ m, t }) => {
              const st = store.doses[doseKey(td, m.id, t)];
              return (
                <Row key={m.id + t} style={{ paddingVertical: 10, paddingHorizontal: 14, minHeight: 62 }}>
                  <Text style={{ width: 48, fontSize: 14, fontWeight: '600', color: C.ink }}>{t}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: st ? C.sub : C.ink, textDecorationLine: st === 'skip' ? 'line-through' : 'none' }}>{m.name}</Text>
                    {m.dose ? <Sub>{m.dose}</Sub> : null}
                  </View>
                  {st ? (
                    <Pressable onPress={() => setDose(m, t, null)} accessibilityRole="button" accessibilityLabel="取消紀錄">
                      <Badge text={st === 'taken' ? '已服用' : '已略過'} bg={st === 'taken' ? C.greenBg : C.sand} fg={st === 'taken' ? C.greenDark : C.sub} />
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
            <Empty text="今天沒有要吃的藥" />
          </Card>
        )}
        {doses.some(({ m, t }) => store.doses[doseKey(td, m.id, t)]) ? <Sub>點「已服用」或「已略過」可以取消紀錄。</Sub> : null}
      </Section>

      <Section title="用藥清單" action={{ label: '＋ 新增用藥', onPress: () => setEditing('new') }}>
        {mine.length ? (
          mine.map((m) => {
            const active = medActiveOn(m, td);
            const ended = !!m.end && m.end < td;
            return (
              <Card key={m.id} style={{ gap: 8 }} onPress={() => setEditing(m)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: ended ? C.sub : C.ink, flex: 1 }}>{m.name}</Text>
                  <Badge text={ended ? '已結束' : active ? (m.end ? `到 ${shortDate(m.end)}` : '長期') : `${shortDate(m.start)} 開始`} bg={ended ? C.sand : C.greenBg} fg={ended ? C.sub : C.greenDark} />
                </Row>
                <Sub>{[m.dose, m.times.join(' / '), m.notify ? '會提醒' : '不提醒'].filter(Boolean).join(' · ')}</Sub>
                <Row>
                  {!ended ? (
                    <Btn
                      small
                      kind="outline"
                      title="停用"
                      onPress={() => {
                        update((d) => {
                          const x = d.meds.find((y) => y.id === m.id);
                          if (x) x.end = x.start > addDays(td, -1) ? x.start : addDays(td, -1);
                        });
                        toast('已停用，今天起不再提醒');
                      }}
                    />
                  ) : null}
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
          })
        ) : (
          <Card>
            <Empty text={`${pet.name}目前沒有用藥紀錄`} action={{ label: '新增用藥', onPress: () => setEditing('new') }} />
          </Card>
        )}
        <Sub>點卡片可以編輯。</Sub>
      </Section>
    </Screen>
  );
}
