import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Screen, Btn, Banner, PetChips, Section, ListCard, KV, Sub, Row, Card } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useNav } from '../../nav';
import { KIND_LABEL, SEX_LABEL, entriesFor, medActiveOn, mapsSearch, primaryVetPhone } from '../../lib/domain';
import { ageText, today } from '../../lib/date';
import { callPhone, copyText, openUrl } from '../../lib/files';
import { CONTENT } from '../../data/content';
import { EXTRA_FIRST_AID } from '../../data/content-health';

const FIRST_AID = [...CONTENT.firstAid.map((a) => ({ id: a.id, name: a.name, steps: [...a.steps] })), ...EXTRA_FIRST_AID];

/** Chest-compression metronome: 110 beats per minute for 2 minutes, with a visual pulse and haptic tap. */
function CprMetronome() {
  const [running, setRunning] = useState(false);
  const [beats, setBeats] = useState(0);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  const BPM = 110;
  const TOTAL = Math.round((BPM * 120) / 60);
  const stop = () => {
    if (iv.current) clearInterval(iv.current);
    iv.current = null;
    setRunning(false);
  };
  useEffect(() => () => stop(), []);
  const start = () => {
    setBeats(0);
    setRunning(true);
    iv.current = setInterval(() => {
      setBeats((b) => {
        const n = b + 1;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        if (n >= TOTAL) stop();
        return n;
      });
    }, 60000 / BPM);
  };
  const cycle = beats % 30;
  const on = running && beats % 2 === 0;
  return (
    <Card style={{ gap: 10, backgroundColor: C.dangerBg, borderWidth: 0 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>按壓節拍（每分鐘 {BPM} 下，持續 2 分鐘）</Text>
      <Row>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: on ? C.danger : C.card, borderWidth: 3, borderColor: C.danger }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] }}>{beats} / {TOTAL}</Text>
          <Sub>{running ? (cycle >= 27 ? '準備吹氣 2 次' : `這一輪第 ${cycle + 1} 下（每 30 下吹氣 2 次）`) : '跟著閃爍與震動的節奏按壓'}</Sub>
        </View>
      </Row>
      <Btn title={running ? '停止' : beats ? '重新開始' : '開始按壓節拍'} kind={running ? 'outline' : 'primary'} onPress={running ? stop : start} />
    </Card>
  );
}

export default function SosScreen({ params }: { params: any }) {
  const { store, petId, setPetId, toast } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [open, setOpen] = useState<string | null>(params?.topic ?? 'fa_poison');
  useEffect(() => {
    if (params?.topic) setOpen(params.topic);
  }, [params?.topic]);

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

  const firstAid = (
    <Section title="急救步驟">
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
                {a.id === 'fa_cpr' ? <CprMetronome /> : null}
              </View>
            ) : null}
          </View>
        );
      })}
      <Sub>以上為一般急救原則，處理後仍請立即就醫。</Sub>
    </Section>
  );

  if (!pet) {
    return (
      <Screen title="緊急求助" subtitle="急診與急救步驟">
        <Btn title="找附近 24 小時急診" onPress={() => openUrl(mapsSearch('24小時 動物醫院 急診'))} />
        {erCard}
        {firstAid}
      </Screen>
    );
  }

  const saved = store.vets[pet.id];
  const vet = saved?.phone ? { name: saved.name || '主治醫院', phone: saved.phone } : primaryVetPhone(store, pet.id);
  const growth = entriesFor(store, pet.id, 'growth')[0];
  const meds = store.meds.filter((m) => m.petId === pet.id && medActiveOn(m, today())).map((m) => `${m.name}${m.dose ? ' ' + m.dose : ''}`);
  const vaccine = store.reminders
    .filter((r) => r.petId === pet.id && r.title.includes('疫苗') && r.history?.length)
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

      {firstAid}

      <Section title="相關工具">
        <Row>
          <Btn small kind="soft" title="有毒查詢" style={{ flex: 1 }} onPress={() => nav.pushUnique('toxic')} />
          <Btn small kind="soft" title="AI 助理" style={{ flex: 1 }} onPress={() => nav.pushUnique('ai')} />
          <Btn small kind="soft" title="走失協尋" style={{ flex: 1 }} onPress={() => nav.pushUnique('lost')} />
        </Row>
      </Section>
    </Screen>
  );
}
