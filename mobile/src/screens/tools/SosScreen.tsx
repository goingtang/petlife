import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Screen, Btn, Banner, PetChips, Section, ListCard, KV, Sub, Row, Card } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useNav } from '../../nav';
import { KIND_LABEL, SEX_LABEL, entriesFor, medActiveOn, mapsSearch, primaryVetPhone } from '../../lib/domain';
import { ageText, today } from '../../lib/date';
import { callPhone, copyText, openUrl } from '../../lib/files';
import { CONTENT } from '../../data/content';
import { EXTRA_FIRST_AID, HEALTH_SOURCES } from '../../data/content-health';

const ALL_AID = [...CONTENT.firstAid.map((a) => ({ id: a.id, name: a.name, steps: [...a.steps] })), ...EXTRA_FIRST_AID];
const CPR = ALL_AID.find((a) => a.id === 'fa_cpr')!;
const FIRST_AID = ALL_AID.filter((a) => a.id !== 'fa_cpr');

/** Keeps the screen on while mounted (CPR must not be interrupted by the screen locking). */
function StayAwake() {
  useKeepAwake('petpal-cpr');
  return null;
}

/**
 * Chest-compression metronome: 110 beats per minute with a visual pulse on every beat and a haptic tap.
 * It keeps going until stopped (CPR continues until breathing returns or you reach the hospital).
 */
function CprMetronome() {
  const BPM = 110;
  const [running, setRunning] = useState(false);
  const [beats, setBeats] = useState(0);
  const [flash, setFlash] = useState(false);
  const count = useRef(0);
  const started = useRef(0);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  const off = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (iv.current) clearInterval(iv.current);
    if (off.current) clearTimeout(off.current);
    iv.current = null;
    setRunning(false);
    setFlash(false);
  };
  useEffect(() => () => stop(), []);
  const start = () => {
    count.current = 0;
    started.current = Date.now();
    setBeats(0);
    setRunning(true);
    iv.current = setInterval(() => {
      count.current += 1;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setBeats(count.current);
      setFlash(true);
      if (off.current) clearTimeout(off.current);
      off.current = setTimeout(() => setFlash(false), 180);
    }, 60000 / BPM);
  };
  const cycle = beats % 30;
  const secs = running ? Math.floor((Date.now() - started.current) / 1000) : 0;
  const checkNow = running && secs > 0 && secs % 120 < 10;
  return (
    <Card style={{ gap: 10, backgroundColor: C.dangerBg, borderWidth: 0 }}>
      {running ? <StayAwake /> : null}
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>按壓節拍（每分鐘 {BPM} 下）</Text>
      <Row>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: flash ? C.danger : C.card, borderWidth: 3, borderColor: C.danger }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] }}>
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
          </Text>
          <Sub>{running ? (cycle >= 27 ? '準備吹氣 2 次' : `這一輪第 ${cycle + 1} 下（每 30 下吹氣 2 次）`) : '跟著閃爍與震動的節奏按壓，畫面會保持亮著'}</Sub>
        </View>
      </Row>
      {checkNow ? <Banner kind="warn" text="每 2 分鐘：停下幾秒，檢查有沒有呼吸與心跳；沒有就繼續按壓。" /> : null}
      <Btn title={running ? '停止' : beats ? '重新開始' : '開始按壓節拍'} kind={running ? 'outline' : 'primary'} onPress={running ? stop : start} />
    </Card>
  );
}

export default function SosScreen({ params }: { params: any }) {
  const { store, petId, setPetId, toast } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [open, setOpen] = useState<string | null>(params?.topic ?? 'fa_poison');
  // Re-open the requested topic every time this screen is reached again (params object changes).
  useEffect(() => {
    if (params?.topic && params.topic !== 'fa_cpr') setOpen(params.topic);
  }, [params]);

  const er = store.erVet;
  const erCard = (
    <Card style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.sub }}>夜間／假日急診</Text>
        <Btn small kind="ghost" title={er ? '編輯' : '設定'} onPress={() => nav.push('vetEdit', { er: true })} />
      </Row>
      {er ? (
        <>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{er.name}</Text>
          <Text selectable style={{ fontSize: 15, color: C.ink }}>{er.phone}{er.hours ? ` · ${er.hours}` : ''}</Text>
          {er.addr ? <Sub>{er.addr}</Sub> : null}
          <Row gap={8}>
            <Btn kind="dark" title="撥打急診" style={{ flex: 1 }} onPress={() => callPhone(er.phone)} />
            <Btn kind="outline" title="導航" onPress={() => openUrl(mapsSearch(`${er.name} ${er.addr}`))} />
          </Row>
        </>
      ) : (
        <Sub>主治醫院休診時可以去的 24 小時醫院。先設定好，半夜就不用臨時找。</Sub>
      )}
    </Card>
  );

  const cprCard = (
    <Section title="沒有呼吸心跳（CPR）">
      <Card style={{ gap: 10, borderColor: C.danger }}>
        {CPR.steps.map((st, i) => (
          <Row key={i} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 22, color: C.ink }}>{st}</Text>
          </Row>
        ))}
        <CprMetronome />
        <Sub style={{ fontSize: 12 }}>{HEALTH_SOURCES.cpr}</Sub>
      </Card>
    </Section>
  );

  const firstAid = (
    <Section title="其他急救步驟">
      {FIRST_AID.map((a) => {
        const on = open === a.id;
        return (
          <View key={a.id} style={{ borderRadius: 20, borderWidth: 1.5, borderColor: on ? C.danger : C.line, backgroundColor: C.card, overflow: 'hidden' }}>
            <Pressable
              onPress={() => setOpen(on ? null : a.id)}
              style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink, flex: 1 }}>{a.name}</Text>
              <Text style={{ fontSize: 18, color: C.sub }}>{on ? '−' : '＋'}</Text>
            </Pressable>
            {on ? (
              <View style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
                {a.steps.map((st, i) => (
                  <Row key={i} style={{ alignItems: 'flex-start' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, lineHeight: 22, color: C.ink }}>{st}</Text>
                  </Row>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      <Sub>以上為一般急救原則，處理後仍請立即就醫。</Sub>
      <Sub style={{ fontSize: 12 }}>{HEALTH_SOURCES.firstAid}</Sub>
    </Section>
  );

  if (!pet) {
    return (
      <Screen title="緊急求助" subtitle="急診與急救步驟">
        <Btn title="找附近 24 小時急診" onPress={() => openUrl(mapsSearch('24小時 動物醫院 急診'))} />
        {erCard}
        {cprCard}
        {firstAid}
      </Screen>
    );
  }

  const saved = store.vets[pet.id];
  const vet = saved?.phone ? { name: saved.name || '主治醫院', phone: saved.phone } : primaryVetPhone(store, pet.id);
  const growth = entriesFor(store, pet.id, 'growth')[0];
  const meds = store.meds.filter((m) => m.petId === pet.id && medActiveOn(m, today())).map((m) => `${m.name}${m.dose ? ' ' + m.dose : ''}`);
  const vaccine = store.reminders
    .filter((r) => r.petId === pet.id && !r.docId && r.title.includes('疫苗') && r.history?.length)
    .map((r) => ({ title: r.title, date: [...r.history].sort().pop()! }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const rows: [string, string][] = [
    ['寵物', pet.name],
    ['種類／品種', `${KIND_LABEL[pet.kind]}${pet.breed ? ' · ' + pet.breed : ''}`],
    ['年齡', ageText(pet.birthday) || '不詳'],
    ['性別／結紮', `${SEX_LABEL[pet.sex]} · ${pet.neutered ? '已結紮' : '未結紮'}`],
    ['體重', growth ? `${growth.v.weight} kg（${growth.at.slice(0, 10).replace(/-/g, '/')}）` : '尚未記錄'],
    ['過敏', pet.allergy || '無'],
    ['目前用藥', meds.join('、') || '無'],
    ['最近疫苗', vaccine ? `${vaccine.title}（${vaccine.date.replace(/-/g, '/')}）` : '無紀錄'],
    ['晶片號碼', pet.chip || '未登記'],
    ['飼主電話', store.ownerPhone || '未填（可在設定中填寫）'],
  ];

  return (
    <Screen title="緊急求助" subtitle="急診與急救步驟">
      <PetChips value={petId} onChange={setPetId} />

      <View style={{ backgroundColor: C.danger, borderRadius: 26, padding: 18, gap: 12 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', opacity: 0.9 }}>{pet.name}的主治醫院</Text>
        {vet ? (
          <>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{vet.name}</Text>
            <Text selectable style={{ color: '#fff', fontSize: 16 }}>
              {vet.phone}
              {saved?.hours ? ` · ${saved.hours}` : ''}
            </Text>
            <Btn title="立即撥打" kind="soft" onPress={() => callPhone(vet.phone)} textStyle={{ color: C.danger }} />
            {saved?.addr ? (
              <Btn title="導航到醫院" kind="outline" style={{ borderColor: '#fff' }} textStyle={{ color: '#fff' }} onPress={() => openUrl(mapsSearch(`${saved.name} ${saved.addr}`))} />
            ) : null}
          </>
        ) : (
          <Text style={{ color: '#fff', fontSize: 15 }}>尚未設定</Text>
        )}
        <Btn title="找附近 24 小時急診" kind="outline" style={{ borderColor: '#fff' }} textStyle={{ color: '#fff' }} onPress={() => openUrl(mapsSearch('24小時 動物醫院 急診'))} />
      </View>

      {!vet ? (
        <Banner kind="warn" text="還沒有設定主治醫院。先設定好，緊急時就能一鍵撥打。" action={{ label: '設定主治醫院', onPress: () => nav.push('vetEdit', { petId: pet.id }) }} />
      ) : null}

      {erCard}

      <Section title="給醫院的資料" action={{ label: '複製資料', onPress: async () => { await copyText(rows.map(([k, v]) => `${k}：${v}`).join('\n')); toast('已複製資料'); } }}>
        <ListCard>
          {rows.map(([k, v]) => (
            <KV key={k} k={k} v={v} />
          ))}
        </ListCard>
      </Section>

      {cprCard}

      {firstAid}

      <Section title="相關工具">
        <Row>
          <Btn small kind="soft" title="有毒查詢" style={{ flex: 1 }} onPress={() => nav.pushUnique('toxic')} />
          <Btn small kind="soft" title="症狀檢查 · 問 AI" style={{ flex: 1 }} onPress={() => nav.pushUnique('ai')} />
          <Btn small kind="soft" title="走失協尋" style={{ flex: 1 }} onPress={() => nav.pushUnique('lost')} />
        </Row>
      </Section>
    </Screen>
  );
}
