import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen, Btn, Banner, PetChips, Section, ListCard, KV, Sub, Row } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useNav } from '../../nav';
import { KIND_LABEL, SEX_LABEL, latestGrowth, medActiveOn, mapsSearch, primaryVetPhone } from '../../lib/domain';
import { ageText, today } from '../../lib/date';
import { callPhone, copyText, openUrl } from '../../lib/files';
import { CONTENT } from '../../data/content';

export default function SosScreen(_: { params: any }) {
  const { store, petId, setPetId, toast } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [open, setOpen] = useState<string | null>(CONTENT.firstAid[1]?.id ?? null);

  if (!pet) {
    return (
      <Screen title="緊急求助" subtitle="急診與急救步驟">
        <Btn title="找附近 24 小時急診" onPress={() => openUrl(mapsSearch('24小時 動物醫院 急診'))} />
      </Screen>
    );
  }

  const vet = primaryVetPhone(store, pet.id);
  const g = latestGrowth(store, pet.id);
  const meds = store.meds.filter((m) => m.petId === pet.id && medActiveOn(m, today())).map((m) => `${m.name}${m.dose ? ' ' + m.dose : ''}`);
  const rows: [string, string][] = [
    ['寵物', pet.name],
    ['種類／品種', `${KIND_LABEL[pet.kind]}${pet.breed ? ' · ' + pet.breed : ''}`],
    ['年齡', ageText(pet.birthday) || '不詳'],
    ['性別／結紮', `${SEX_LABEL[pet.sex]} · ${pet.neutered ? '已結紮' : '未結紮'}`],
    ['體重', g ? `${g.weight} kg` : '尚未記錄'],
    ['過敏', pet.allergy || '無'],
    ['目前用藥', meds.join('、') || '無'],
    ['晶片號碼', pet.chip || '未登記'],
  ];

  return (
    <Screen title="緊急求助" subtitle="急診與急救步驟">
      <PetChips value={petId} onChange={setPetId} />

      <View style={{ backgroundColor: C.danger, borderRadius: 26, padding: 18, gap: 12 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', opacity: 0.9 }}>{pet.name}的主治醫院</Text>
        {vet ? (
          <>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{vet.name}</Text>
            <Text selectable style={{ color: '#fff', fontSize: 16 }}>{vet.phone}</Text>
            <Btn title="立即撥打" kind="soft" onPress={() => callPhone(vet.phone)} textStyle={{ color: C.danger }} />
          </>
        ) : (
          <Text style={{ color: '#fff', fontSize: 15 }}>尚未設定</Text>
        )}
        <Btn title="找附近 24 小時急診" kind="outline" style={{ borderColor: '#fff' }} textStyle={{ color: '#fff' }} onPress={() => openUrl(mapsSearch('24小時 動物醫院 急診'))} />
      </View>

      {!vet ? (
        <Banner kind="warn" text="還沒有設定主治醫院。先設定好，緊急時就能一鍵撥打。" action={{ label: '設定主治醫院', onPress: () => nav.push('vetEdit', { petId: pet.id }) }} />
      ) : null}

      <Section title="給醫院的資料" action={{ label: '複製資料', onPress: async () => { await copyText(rows.map(([k, v]) => `${k}：${v}`).join('\n')); toast('已複製資料'); } }}>
        <ListCard>
          {rows.map(([k, v]) => (
            <KV key={k} k={k} v={v} />
          ))}
        </ListCard>
      </Section>

      <Section title="急救步驟">
        {CONTENT.firstAid.map((a) => {
          const on = open === a.id;
          return (
            <View key={a.id} style={{ borderRadius: 20, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, overflow: 'hidden' }}>
              <Pressable
                onPress={() => setOpen(on ? null : a.id)}
                style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}
                accessibilityRole="button"
                accessibilityState={{ expanded: on }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{a.name}</Text>
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
        <Sub>以上為一般急救原則，處理後仍請盡快就醫。</Sub>
      </Section>

      <Section title="相關工具">
        <Row>
          <Btn small kind="soft" title="有毒查詢" style={{ flex: 1 }} onPress={() => nav.push('toxic')} />
          <Btn small kind="soft" title="AI 健康助理" style={{ flex: 1 }} onPress={() => nav.push('ai')} />
          <Btn small kind="soft" title="走失協尋" style={{ flex: 1 }} onPress={() => nav.push('lost')} />
        </Row>
      </Section>
    </Screen>
  );
}
