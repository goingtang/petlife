import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Badge, Btn, Card, Empty, KV, ListCard, Row, Screen, Section, Sub } from '../ui/kit';
import { C } from '../ui/theme';
import { ageText, daysBetween, today, relTime } from '../lib/date';
import { latestGrowth, KIND_LABEL, SEX_LABEL, mapsSearch } from '../lib/domain';
import { callPhone, choosePhotos, openUrl } from '../lib/files';

export default function ProfileScreen({ params }: { params: any }) {
  const { store, update, toast } = useStore();
  const nav = useNav();
  const pet = store.pets.find((p) => p.id === params.petId);
  if (!pet)
    return (
      <Screen title="寵物檔案">
        <Empty text="找不到這隻寵物" />
      </Screen>
    );
  const g = latestGrowth(store, pet.id);
  const vet = store.vets[pet.id];
  const contacts = store.contacts.filter((c) => c.petId === pet.id).sort((a, b) => Number(b.primary) - Number(a.primary));
  const diary = store.journal.filter((j) => j.petId === pet.id && (!j.private || j.author === store.me)).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 5);
  const logsToday = store.entries.filter((e) => e.petId === pet.id && e.at.startsWith(today())).length;
  const setPhoto = () =>
    choosePhotos(1, (u) => {
      if (!u[0]) return;
      update((d) => {
        const x = d.pets.find((y) => y.id === pet.id);
        if (x) x.photo = u[0];
      });
      toast('照片已更新');
    });

  return (
    <Screen title={pet.name} right={<Btn small kind="outline" title="編輯資料" onPress={() => nav.push('petEdit', { petId: pet.id })} />}>
      <Pressable onPress={setPhoto} style={{ height: 230, borderRadius: 28, backgroundColor: pet.color, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="更換照片">
        {pet.photo ? (
          <Image source={{ uri: pet.photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>＋ 加入照片</Text>
            <Sub>拍照或從相簿選擇</Sub>
          </View>
        )}
      </Pressable>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[pet.breed || KIND_LABEL[pet.kind], ageText(pet.birthday), SEX_LABEL[pet.sex], pet.neutered ? '已結紮' : '']
          .filter(Boolean)
          .map((b) => (
            <Badge key={b} text={b} bg={C.card} style={{ borderWidth: 1.5, borderColor: C.line }} />
          ))}
      </View>

      <Row gap={8}>
        {[
          { v: g ? String(g.weight) : '–', u: 'kg', l: '目前體重', bg: C.greenBg, on: () => nav.push('form', { form: 'growth', petId: pet.id }) },
          { v: pet.adopted ? String(daysBetween(pet.adopted, today())) : '–', u: '天', l: '相處天數', bg: C.yellowBg, on: () => nav.push('miles') },
          { v: String(logsToday), u: '筆', l: '今日紀錄', bg: C.dangerBg, on: () => nav.push('logPicker') },
        ].map((st) => (
          <Pressable key={st.l} onPress={st.on} style={{ flex: 1, padding: 14, borderRadius: 20, backgroundColor: st.bg, gap: 4 }} accessibilityRole="button">
            <Text style={{ fontSize: 23, fontWeight: '700', color: C.ink }}>
              {st.v}
              <Text style={{ fontSize: 12, color: '#5E4E42', fontWeight: '400' }}> {st.u}</Text>
            </Text>
            <Text style={{ fontSize: 12, color: '#5E4E42' }}>{st.l}</Text>
          </Pressable>
        ))}
      </Row>

      <Section title="基本資料">
        <ListCard>
          <KV k="生日" v={pet.birthday ? pet.birthday.replace(/-/g, '/') : '未填'} />
          <KV k="來家裡的日子" v={pet.adopted ? pet.adopted.replace(/-/g, '/') : '未填'} />
          <KV k="晶片號碼" v={pet.chip || '未填'} />
          <KV k="過敏" v={pet.allergy || '無'} />
        </ListCard>
      </Section>

      <Section title="主治醫院" action={{ label: vet ? '編輯' : '設定', onPress: () => nav.push('vetEdit', { petId: pet.id }) }}>
        {vet?.name ? (
          <Card style={{ gap: 10 }}>
            <View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{vet.name}</Text>
              <Sub>{[vet.doctor, vet.hours].filter(Boolean).join(' · ')}</Sub>
            </View>
            {vet.addr ? <Sub>{vet.addr}</Sub> : null}
            <Row gap={8}>
              {vet.phone ? <Btn kind="dark" title={`撥打 ${vet.phone}`} onPress={() => callPhone(vet.phone)} style={{ flex: 1 }} /> : null}
              <Btn kind="outline" title="導航" onPress={() => openUrl(mapsSearch(`${vet.name} ${vet.addr}`))} />
            </Row>
          </Card>
        ) : (
          <Empty text="設定主治醫院後，緊急時可以一鍵撥打" />
        )}
      </Section>

      <Section title="緊急聯絡人" action={{ label: '＋ 新增', onPress: () => nav.push('form', { form: 'contact', petId: pet.id }) }}>
        {contacts.length ? (
          contacts.map((c) => (
            <Card key={c.id} onPress={() => nav.push('form', { form: 'contact', petId: pet.id, editId: c.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 16, borderColor: c.primary ? '#E7B49A' : C.line }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{c.name}</Text>
                  <Badge text={c.rel} />
                  {c.primary ? <Badge text="第一聯絡人" bg={C.accent} fg="#fff" /> : null}
                </Row>
                <Sub>{c.phone}</Sub>
              </View>
              <Btn small kind="dark" title="撥打" onPress={() => callPhone(c.phone)} />
            </Card>
          ))
        ) : (
          <Empty text="還沒有緊急聯絡人" />
        )}
      </Section>

      <Section title="成長日記" action={{ label: '＋ 寫日記', kind: 'primary', onPress: () => nav.push('form', { form: 'diary', petId: pet.id }) }}>
        {diary.length ? (
          diary.map((j) => (
            <Card key={j.id} onPress={() => nav.push('form', { form: 'diary', editId: j.id, petId: pet.id })} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Badge text={j.mood} bg={C.purpleBg} fg="#5B3F60" />
                <Sub style={{ fontSize: 12 }}>{relTime(j.at)}</Sub>
              </Row>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{j.title}</Text>
              {j.body ? <Sub numberOfLines={3}>{j.body}</Sub> : null}
            </Card>
          ))
        ) : (
          <Empty text="還沒有日記" />
        )}
      </Section>
    </Screen>
  );
}
