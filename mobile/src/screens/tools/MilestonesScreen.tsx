import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Screen, Card, Btn, Field, DateField, PetChips, PhotoGrid, Banner, Empty, Sub, confirm } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { entriesFor } from '../../lib/domain';
import { today, parseYmd, ymd, daysBetween } from '../../lib/date';
import { choosePhotos, deleteFile } from '../../lib/files';
import { uid } from '../../lib/seed';

interface Item { key: string; date: string; text: string; color: string; customId?: string; photo?: string }

export default function MilestonesScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [photo, setPhoto] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  if (!pet) return <Screen title="里程碑"><Empty text="先新增一隻寵物，就能記錄一起走過的日子。" /></Screen>;

  const items: Item[] = [];
  if (pet.birthday) items.push({ key: 'b', date: pet.birthday, text: `${pet.name}出生`, color: '#E7B44C' });
  if (pet.adopted) items.push({ key: 'a', date: pet.adopted, text: '來到我們家', color: C.accent });
  const g = entriesFor(store, pet.id, 'growth').slice().reverse();
  if (g.length) {
    items.push({ key: 'g0', date: g[0].at.slice(0, 10), text: `第一次記錄體重 ${g[0].v.weight} kg`, color: C.green });
    if (g.length > 1) items.push({ key: 'g1', date: g[g.length - 1].at.slice(0, 10), text: `體重長到 ${g[g.length - 1].v.weight} kg`, color: C.green });
  }
  store.reminders.filter((r) => r.petId === pet.id).forEach((r) =>
    (r.history || []).forEach((h, i) => items.push({ key: `r${r.id}${i}`, date: h, text: `完成「${r.title}」`, color: '#6E8FB0' })),
  );
  const J = store.journal.filter((j) => j.petId === pet.id).sort((a, b) => (a.at < b.at ? -1 : 1));
  if (J.length) items.push({ key: 'j', date: J[0].at.slice(0, 10), text: `第一篇日記：${J[0].title}`, color: '#A77AA3' });
  store.milestones.filter((m) => m.petId === pet.id).forEach((m) => items.push({ key: m.id, date: m.date, text: m.title, color: C.ink, customId: m.id, photo: m.photo }));
  items.sort((a, b) => (a.date < b.date ? 1 : -1));

  let next: string | null = null;
  if (pet.birthday) {
    const b = parseYmd(pet.birthday);
    const now = parseYmd(today());
    let y = now.getFullYear();
    let nb = new Date(y, b.getMonth(), b.getDate());
    if (ymd(nb) < today()) nb = new Date(++y, b.getMonth(), b.getDate());
    const d = daysBetween(today(), ymd(nb));
    next = d === 0 ? `今天是${pet.name}的 ${y - b.getFullYear()} 歲生日！` : `距離${pet.name} ${y - b.getFullYear()} 歲生日還有 ${d} 天`;
  }

  const save = () => {
    if (!title.trim()) return setTried(true);
    update((d) => { d.milestones.push({ id: uid('ms'), petId: pet.id, date: date || today(), title: title.trim(), photo: photo[0] }); });
    toast('里程碑已新增');
    setAdding(false);
    setTitle('');
    setPhoto([]);
    setDate(today());
    setTried(false);
  };

  return (
    <Screen title="里程碑" subtitle="一起走過的日子">
      <PetChips value={petId} onChange={setPetId} />
      {next ? <Banner kind="warn" text={next} /> : null}
      {adding ? (
        <Card style={{ gap: 12 }}>
          <Field label="發生了什麼" required value={title} placeholder="例如：第一次學會坐下" onChangeText={setTitle} error={tried && !title.trim() ? '請填寫內容' : null} />
          <DateField label="日期" value={date} onChange={setDate} />
          <PhotoGrid photos={photo} max={1} onRemove={() => setPhoto([])} onAdd={() => choosePhotos(1, (u) => u.length && setPhoto(u))} />
          <Btn title="儲存" onPress={save} />
          <Btn small kind="outline" title="取消" onPress={() => { setAdding(false); setTried(false); }} />
        </Card>
      ) : (
        <Btn kind="outline" title="＋ 新增里程碑" onPress={() => setAdding(true)} />
      )}
      {items.length ? (
        <View style={{ paddingLeft: 6 }}>
          {items.map((it, i) => (
            <View key={it.key} style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ alignItems: 'center', width: 16 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: it.color, borderWidth: 3, borderColor: C.card, marginTop: 4 }} />
                {i < items.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: C.line, minHeight: 20 }} /> : null}
              </View>
              <Pressable
                disabled={!it.customId}
                onPress={() => it.customId && confirm('刪除這個里程碑？', it.text, () => {
                  update((d) => { d.milestones = d.milestones.filter((m) => m.id !== it.customId); });
                  deleteFile(it.photo);
                  toast('已刪除');
                })}
                style={{ flex: 1, paddingBottom: 18, gap: 4 }}
                accessibilityRole={it.customId ? 'button' : undefined}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.sub }}>{it.date.replace(/-/g, '/')}</Text>
                <Text style={{ fontSize: 15, fontWeight: '500', color: C.ink, lineHeight: 21 }}>{it.text}</Text>
                {it.photo ? <Image source={{ uri: it.photo }} style={{ width: 160, height: 120, borderRadius: 14, marginTop: 4 }} /> : null}
                {it.customId ? <Sub>點一下可刪除</Sub> : null}
              </Pressable>
            </View>
          ))}
        </View>
      ) : <Empty text="還沒有里程碑" />}
    </Screen>
  );
}
