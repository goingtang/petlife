import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, memberName, memberColor, petName, isOwner } from '../lib/store';
import { useNav } from '../nav';
import { Avatar, Badge, Btn, Card, Chip, ChipRow, Empty, Row, Screen, Sub, confirm } from '../ui/kit';
import { C } from '../ui/theme';
import { addDays, today, weekday, relTime, addMonths } from '../lib/date';
import { shareText, shareFile, deleteFile } from '../lib/files';
import type { JournalEntry } from '../lib/types';

export default function DiaryScreen() {
  const { store, update, toast } = useStore();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState<string | null>(null);
  const [pet, setPet] = useState<string>('all');
  const td = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(td, i - 6));

  const visible = store.journal.filter((j) => !j.private || j.author === store.me);
  const list = visible
    .filter((j) => (pet === 'all' || j.petId === pet) && (!day || j.at.startsWith(day)))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const lastYear = visible.filter((j) => j.at.startsWith(addMonths(td, -12)));

  const share = (j: JournalEntry) => {
    const text = `${j.title}｜${petName(store, j.petId)}的日記\n${j.body}\n${[j.mood, ...j.acts].join(' · ')}\n— PetPal`;
    if (j.photos[0]) shareFile(j.photos[0], 'image/jpeg', j.title).then((ok) => { if (!ok) shareText(text); });
    else shareText(text, j.title);
  };

  const remove = (j: JournalEntry) =>
    confirm('刪除這篇日記？', '照片也會一起刪除，無法復原。', () => {
      j.photos.forEach((u) => deleteFile(u));
      update((d) => {
        d.journal = d.journal.filter((x) => x.id !== j.id);
      });
      toast('已刪除');
    });

  return (
    <View style={{ flex: 1 }}>
      <Screen root title="共享日記" right={<Btn small kind="dark" title="家人成員" onPress={() => nav.push('members')} />}>
        <Sub>在這支手機上記錄的日記。家人用各自手機同步，需等雲端帳號功能上線。</Sub>

        <View style={{ flexDirection: 'row', gap: 4 }}>
          {days.map((d) => {
            const on = day === d;
            const has = visible.some((j) => j.at.startsWith(d));
            return (
              <Pressable
                key={d}
                onPress={() => setDay(on ? null : d)}
                style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.card }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={d}
              >
                <Text style={{ fontSize: 11, color: on ? C.bg : C.ink }}>{d === td ? '今' : weekday(d)}</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: on ? C.bg : C.ink }}>{Number(d.slice(8))}</Text>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: has ? (on ? C.yellow : C.accent) : 'transparent' }} />
              </Pressable>
            );
          })}
        </View>

        <ChipRow>
          <Chip label="全部" on={pet === 'all'} onPress={() => setPet('all')} />
          {store.pets.map((p) => (
            <Chip key={p.id} label={p.name} on={pet === p.id} onPress={() => setPet(p.id)} />
          ))}
        </ChipRow>

        {!day && lastYear.length ? (
          <Card style={{ backgroundColor: C.purpleBg, borderWidth: 0, gap: 4 }} onPress={() => setDay(null)}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#5B3F60' }}>去年的今天</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{lastYear[0].title}</Text>
          </Card>
        ) : null}

        {list.map((j) => (
          <Card key={j.id} style={{ gap: 12, padding: 14 }}>
            <Row>
              <Avatar name={memberName(store, j.author)} color={memberColor(store, j.author)} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{memberName(store, j.author)}</Text>
                <Sub style={{ fontSize: 12 }}>{petName(store, j.petId)} · {relTime(j.at)}</Sub>
              </View>
              {j.private ? <Badge text="私密" bg={C.sand2} fg="#5E4E42" /> : null}
            </Row>
            {j.photos.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: 18, overflow: 'hidden' }}>
                {j.photos.map((u, i) => (
                  <Image
                    key={u + i}
                    source={{ uri: u }}
                    style={{ width: j.photos.length === 1 || (j.photos.length === 3 && i === 0) ? '100%' : '49.3%', height: j.photos.length === 1 ? 230 : 150, backgroundColor: C.sand }}
                  />
                ))}
              </View>
            ) : null}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink, lineHeight: 24 }}>{j.title}</Text>
              {j.body ? <Text style={{ fontSize: 14, lineHeight: 23, color: C.body }}>{j.body}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[j.mood, ...j.acts].map((t) => (
                <Badge key={t} text={t} bg={C.sand} fg="#5E4E42" />
              ))}
            </View>
            <Row gap={8} style={{ borderTopWidth: 1.5, borderTopColor: C.lineSoft, paddingTop: 10 }}>
              <Btn small kind="soft" title="分享" onPress={() => share(j)} />
              <Btn small kind="soft" title="編輯" onPress={() => nav.push('form', { form: 'diary', editId: j.id, petId: j.petId })} />
              {j.author === store.me || isOwner(store) ? <Btn small kind="soft" title="刪除" onPress={() => remove(j)} textStyle={{ color: C.danger }} /> : null}
            </Row>
          </Card>
        ))}
        {!list.length ? (
          <Empty
            text={day ? '這天還沒有日記' : '還沒有日記，寫下第一篇吧'}
            action={day ? { label: '顯示全部', onPress: () => setDay(null) } : undefined}
          />
        ) : null}
      </Screen>
      {store.pets.length ? (
        <Btn
          title="＋ 寫日記"
          onPress={() => nav.push('form', { form: 'diary', petId: pet === 'all' ? store.pets[0].id : pet })}
          style={{ position: 'absolute', right: 20, bottom: insets.bottom + 92, shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
        />
      ) : null}
    </View>
  );
}
