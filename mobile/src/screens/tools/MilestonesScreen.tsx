import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Screen, Card, Btn, Field, DateField, PhotoGrid, PetChips, Row, Section, Empty, H2, Sub, Label, confirm, Thumb } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { entriesFor, isRoutineReminder } from '../../lib/domain';
import { daysBetween, today } from '../../lib/date';
import { daysTogether } from '../../lib/domain';
import { choosePhotos, usePendingFiles, deleteFile, sharePdf, pdfShell, esc, imageDataUri } from '../../lib/files';
import { useBackHandler } from '../../nav';
import { uid } from '../../lib/seed';

interface Item { key: string; date: string; text: string; color: string; customId?: string; photo?: string }
interface Draft { id: string | null; title: string; date: string; photo?: string }

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** This year's (or next year's) occurrence of a MM-DD date; Feb 29 falls on Feb 28 in other years. */
function occurrence(md: string, year: number) {
  return md === '02-29' && !isLeap(year) ? `${year}-02-28` : `${year}-${md}`;
}

export default function MilestonesScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId, day, afterSave } = useStore();
  const pet = usePet();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [orig, setOrig] = useState('');
  const [tried, setTried] = useState(false);
  const [detail, setDetail] = useState<Item | null>(null);
  const [full, setFull] = useState<string | null>(null);
  const files = usePendingFiles();

  useEffect(() => {
    if (draft) files.discard();
    setDraft(null);
    setDetail(null);
    // reset when the pet changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  const dirty = !!draft && JSON.stringify(draft) !== orig;
  const closeDraft = () => {
    const go = () => { files.discard(); setDraft(null); setTried(false); };
    if (dirty) confirm('放棄未儲存的內容？', '這個里程碑的修改不會儲存。', go, '放棄');
    else go();
  };
  useBackHandler(draft ? () => { closeDraft(); return true; } : detail ? () => { setDetail(null); return true; } : null);

  if (!pet)
    return (
      <Screen title="里程碑">
        <Empty text="請先新增寵物" />
      </Screen>
    );

  const items: Item[] = [];
  const add = (date: string, text: string, color: string, extra: Partial<Item> = {}) => date && items.push({ key: `${date}|${text}`, date, text, color, ...extra });
  add(pet.birthday, `${pet.name} 出生`, '#C8862A');
  add(pet.adopted, '來到我們家', C.accent);
  const growth = [...entriesFor(store, pet.id, 'growth')].reverse().filter((g) => Number.isFinite(Number(g.v?.weight)) && Number(g.v?.weight) > 0);
  if (growth.length) {
    const first = Number(growth[0].v.weight);
    add(growth[0].at.slice(0, 10), `第一次記錄體重 ${first} kg`, C.green);
    if (growth.length > 1) {
      const last = Number(growth[growth.length - 1].v.weight);
      add(growth[growth.length - 1].at.slice(0, 10), last > first ? `長到 ${last} kg` : `體重 ${last} kg`, C.green);
    }
  }
  store.reminders
    .filter((r) => r.petId === pet.id && !isRoutineReminder(r))
    .forEach((r) => (r.history || []).forEach((h) => add(h, `完成「${r.title}」`, '#6E8FB0')));
  const journal = store.journal.filter((j) => j.petId === pet.id).sort((a, b) => (a.at < b.at ? -1 : 1));
  if (journal.length) add(journal[0].at.slice(0, 10), `第一篇日記：${journal[0].title}`, '#A77AA3');
  store.milestones.filter((m) => m.petId === pet.id).forEach((m) => add(m.date, m.title, C.ink, { customId: m.id, photo: m.photo }));
  items.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Next birthday
  let bday: string | null = null;
  if (pet.birthday) {
    const md = pet.birthday.slice(5);
    const y = Number(day.slice(0, 4));
    const thisYear = occurrence(md, y);
    const next = thisYear >= day ? thisYear : occurrence(md, y + 1);
    const age = Number(next.slice(0, 4)) - Number(pet.birthday.slice(0, 4));
    const left = daysBetween(day, next);
    if (age > 0) bday = left === 0 ? `今天是${pet.name}的 ${age} 歲生日，生日快樂！` : `距離${pet.name} ${age} 歲生日還有 ${left} 天`;
  }
  const together = daysTogether(pet, day);

  const openDraft = (d: Draft) => {
    setDraft(d);
    setOrig(JSON.stringify(d));
    setTried(false);
    setDetail(null);
  };
  const save = () => {
    if (!draft) return;
    setTried(true);
    if (!draft.title.trim()) return;
    update((d) => {
      const rec = { id: draft.id ?? uid('ms'), petId: pet.id, title: draft.title.trim(), date: draft.date || today(), photo: draft.photo };
      const i = d.milestones.findIndex((m) => m.id === rec.id);
      if (i >= 0) d.milestones[i] = rec;
      else d.milestones.push(rec);
    });
    files.commit(afterSave);
    setDraft(null);
    toast('已儲存里程碑');
  };

  const shareCard = async (it: Item) => {
    const img = await imageDataUri(it.photo ?? pet.photo);
    const body = `<div style="text-align:center;padding-top:40px">
      ${img ? `<img src="${img}" style="width:420px;height:420px;object-fit:cover;border-radius:28px">` : `<div style="width:420px;height:300px;margin:0 auto;border-radius:28px;background:${esc(pet.color)}"></div>`}
      <h1 style="border:none;font-size:30px;margin-top:28px">${esc(it.text)}</h1>
      <p style="font-size:18px;color:#7A685B">${esc(pet.name)} · ${esc(it.date.replace(/-/g, '/'))}</p></div>`;
    await sharePdf(pdfShell(`${pet.name} ${it.text}`, body), `${pet.name}-${it.text}`);
  };

  return (
    <Screen title="里程碑" subtitle="一起走過的日子">
      <PetChips
        value={petId}
        onChange={(id) => {
          if (id === petId) return;
          if (dirty) confirm('放棄未儲存的內容？', '切換寵物後，這個里程碑的修改不會儲存。', () => { files.discard(); setDraft(null); setPetId(id); }, '放棄');
          else setPetId(id);
        }}
      />

      {draft ? (
        <Card style={{ gap: 12, borderColor: C.accent }}>
          <H2>{draft.id ? '編輯里程碑' : '新增里程碑'}</H2>
          <Field label="發生了什麼" required value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} placeholder="例如：第一次學會坐下" error={tried && !draft.title.trim() ? '請填寫內容' : null} />
          <DateField label="日期" value={draft.date} onChange={(v) => v && setDraft({ ...draft, date: v })} />
          <Label>照片（選填）</Label>
          <PhotoGrid
            photos={draft.photo ? [draft.photo] : []}
            max={1}
            onRemove={() => { files.removed(draft.photo); setDraft({ ...draft, photo: undefined }); }}
            onAdd={() => choosePhotos(1, (u) => { if (u[0]) { files.added(u[0]); setDraft({ ...draft, photo: u[0] }); } })}
          />
          <Btn title="儲存" onPress={save} />
          <Row>
            <Btn small kind="outline" title="取消" style={{ flex: 1 }} onPress={closeDraft} />
            {draft.id ? (
              <Btn small kind="danger" title="刪除" style={{ flex: 1 }} onPress={() => confirm('刪除這個里程碑？', '照片也會一起刪除。', () => {
                const m = store.milestones.find((x) => x.id === draft.id);
                update((d) => { d.milestones = d.milestones.filter((x) => x.id !== draft.id); });
                deleteFile(m?.photo);
                files.discard();
                setDraft(null);
                toast('已刪除');
              })} />
            ) : null}
          </Row>
        </Card>
      ) : detail ? (
        <Card style={{ gap: 12, borderColor: C.accent }}>
          {detail.photo ? (
            <Pressable onPress={() => setFull(detail.photo!)} accessibilityRole="button" accessibilityLabel="放大照片">
              <Thumb uri={detail.photo} label={`${detail.text}的照片`} style={{ width: '100%', height: 240, borderRadius: 18 }} />
            </Pressable>
          ) : null}
          <H2>{detail.text}</H2>
          <Sub>{pet.name} · {detail.date.replace(/-/g, '/')}</Sub>
          <Btn title="分享紀念卡片" onPress={() => shareCard(detail)} />
          {detail.customId ? (
            <Btn kind="outline" title="編輯" onPress={() => {
              const m = store.milestones.find((x) => x.id === detail.customId);
              if (m) openDraft({ id: m.id, title: m.title, date: m.date, photo: m.photo });
            }} />
          ) : <Sub>這是依紀錄自動產生的里程碑。</Sub>}
          <Btn small kind="ghost" title="返回列表" onPress={() => setDetail(null)} />
        </Card>
      ) : null}

      {bday ? <Card style={{ backgroundColor: C.yellowBg, borderWidth: 0 }}><Text style={{ fontSize: 15, fontWeight: '700', color: '#5E4512' }}>{bday}</Text></Card> : null}
      {together !== null ? (
        <Card style={{ backgroundColor: C.greenBg, borderWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#3F5A3B' }}>{pet.name}來家第 {together} 天</Text>
        </Card>
      ) : null}

      <Section title="時間軸" action={draft ? undefined : { label: '＋ 新增里程碑', onPress: () => openDraft({ id: null, title: '', date: today() }) }}>
        {items.length ? (
          <View style={{ paddingLeft: 6 }}>
            {items.map((it, i) => (
              <Pressable key={it.key + i} onPress={() => setDetail(it)} style={{ flexDirection: 'row', gap: 14, minHeight: 56 }} accessibilityRole="button" accessibilityLabel={`${it.date} ${it.text}`}>
                <View style={{ alignItems: 'center', width: 16 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: it.color, marginTop: 4, borderWidth: 3, borderColor: C.card }} />
                  {i < items.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: C.line }} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 16, gap: 2 }}>
                  <Sub style={{ fontSize: 12, fontWeight: '600' }}>{it.date.replace(/-/g, '/')}</Sub>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: C.ink, lineHeight: 21 }}>{it.text}</Text>
                  {it.photo ? <Thumb uri={it.photo} label={`${it.text}的照片`} style={{ width: 120, height: 90, borderRadius: 12, marginTop: 4 }} /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : <Empty text="填寫生日、到家日期或記錄體重後，這裡會自動出現里程碑" />}
      </Section>
      <Sub>每月例行的驅蟲、心絲蟲等提醒不會列入里程碑。點任一項可以分享成紀念卡片。</Sub>

      <Modal visible={!!full} transparent animationType="fade" onRequestClose={() => setFull(null)}>
        <Pressable onPress={() => setFull(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.9)', alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="關閉照片">
          {full ? <Image source={{ uri: full }} style={{ width: '100%', height: '80%' }} resizeMode="contain" accessibilityLabel="照片全螢幕" /> : null}
          <Text style={{ color: '#fff', marginTop: 12 }}>點一下關閉</Text>
        </Pressable>
      </Modal>
    </Screen>
  );
}
