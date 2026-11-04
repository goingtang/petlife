import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { today } from '../lib/date';
import { useNav, useBackHandler } from '../nav';
import { Btn, Choice, DateField, Field, Label, Row, Screen, Segment, Sub, Toggle, confirm, Thumb } from '../ui/kit';
import { C } from '../ui/theme';
import { choosePhotos, deleteFile, deleteIfUnused, usePendingFiles } from '../lib/files';
import { PET_COLORS, defaultGroom, defaultTasks, uid } from '../lib/seed';
import type { Pet, PetKind } from '../lib/types';

const BREEDS: Record<PetKind, string[]> = {
  dog: ['米克斯', '柴犬', '貴賓', '柯基', '黃金獵犬', '拉不拉多', '博美', '臘腸', '法鬥', '雪納瑞'],
  cat: ['米克斯', '英國短毛貓', '美國短毛貓', '布偶貓', '曼赤肯', '蘇格蘭摺耳', '橘貓', '暹羅貓'],
  rabbit: ['荷蘭侏儒兔', '垂耳兔', '獅子兔', '道奇兔'],
  bird: ['小太陽鸚鵡', '玄鳳鸚鵡', '虎皮鸚鵡', '文鳥'],
  other: ['倉鼠', '天竺鼠', '烏龜', '守宮'],
};

const KINDS: { value: PetKind; label: string }[] = [
  { value: 'dog', label: '狗' },
  { value: 'cat', label: '貓' },
  { value: 'rabbit', label: '兔' },
  { value: 'bird', label: '鳥' },
  { value: 'other', label: '其他' },
];

export default function PetEditScreen({ params }: { params: any }) {
  const { store, update, toast, setPetId, afterSave, getStore } = useStore();
  const nav = useNav();
  const existing = params.petId ? store.pets.find((p) => p.id === params.petId) : undefined;
  const [p, setP] = useState<Pet>(
    existing ?? { id: uid('p'), name: '', kind: 'dog', breed: '', sex: 'male', birthday: '', adopted: '', neutered: false, chip: '', allergy: '', color: PET_COLORS[store.pets.length % PET_COLORS.length] },
  );
  const [tried, setTried] = useState(false);
  // New pets: choose the kind first (no default, so a cat owner doesn't end up with dog care tasks).
  const [kindPicked, setKindPicked] = useState(!!existing);
  const [more, setMore] = useState(!!existing);
  const [initial] = useState(p);
  const set = <K extends keyof Pet>(k: K, v: Pet[K]) => setP((o) => ({ ...o, [k]: v }));
  const pf = usePendingFiles();
  const setPhoto = (uri: string | undefined) => {
    if (uri) pf.added(uri);
    // The saved photo may also be the lost-pet poster's photo, so it is deleted on save only if nothing else uses it.
    if (p.photo !== existing?.photo) pf.removed(p.photo);
    set('photo', uri);
  };
  useBackHandler(
    JSON.stringify(p) !== JSON.stringify(initial) && !params.first
      ? () => {
          confirm('放棄未儲存的內容？', '剛才修改的資料不會保存。', () => nav.pop(), '放棄');
          return true;
        }
      : null,
  );

  const save = () => {
    setTried(true);
    if (!p.name.trim() || !kindPicked) return;
    const clean = { ...p, name: p.name.trim(), breed: p.breed.trim(), chip: p.chip.trim(), allergy: p.allergy.trim() };
    update((d) => {
      if (existing) {
        const i = d.pets.findIndex((x) => x.id === existing.id);
        if (i >= 0) d.pets[i] = clean;
        // The lost-pet poster defaults to the profile photo; keep it pointing at a file that still exists.
        const lost = d.lost[existing.id];
        if (lost && lost.photo === existing.photo && existing.photo !== clean.photo) lost.photo = clean.photo;
      } else {
        d.pets.push(clean);
        d.tasks.push(...defaultTasks(clean, d.me));
        d.groom.push(...defaultGroom(clean));
        if (params.first) d.ownerId = d.me;
      }
    });
    pf.commit(afterSave);
    const old = existing?.photo;
    if (old && old !== clean.photo) afterSave(() => deleteIfUnused(old, getStore()));
    if (!existing) setPetId(clean.id);
    toast(existing ? '已更新寵物資料' : `已新增${clean.name}，每日照護項目也幫你建好了`);
    if (params.first) nav.popToRoot();
    else nav.pop();
  };

  const remove = () =>
    confirm(`刪除${existing?.name}？`, '這隻寵物的紀錄、日記、提醒、文件和照片都會一起刪除，無法復原。過去的花費紀錄會保留，方便對帳；這隻寵物的每月固定支出會停止。', () => {
      const id = existing!.id;
      // Collect the files first; they are deleted only after the change has been saved.
      const files: (string | null | undefined)[] = [
        existing!.photo,
        ...store.journal.filter((j) => j.petId === id).flatMap((j) => j.photos),
        ...store.entries.filter((e) => e.petId === id).flatMap((e) => e.v?.docs || []),
        ...store.docs.filter((x) => x.petId === id).flatMap((x) => [x.fileUri, ...(x.pages || [])]),
        ...store.milestones.filter((m) => m.petId === id).map((m) => m.photo),
        store.lost[id]?.photo,
      ];
      update((d) => {
        d.recurring = d.recurring.filter((r) => r.petId !== id);
        d.pets = d.pets.filter((x) => x.id !== id);
        d.tasks = d.tasks.filter((x) => x.petId !== id);
        d.entries = d.entries.filter((x) => x.petId !== id);
        d.reminders = d.reminders.filter((x) => x.petId !== id);
        d.contacts = d.contacts.filter((x) => x.petId !== id);
        d.journal = d.journal.filter((x) => x.petId !== id);
        d.meds = d.meds.filter((x) => x.petId !== id);
        d.docs = d.docs.filter((x) => x.petId !== id);
        d.supplies = d.supplies.filter((x) => x.petId !== id);
        d.groom = d.groom.filter((x) => x.petId !== id);
        d.milestones = d.milestones.filter((x) => x.petId !== id);
        delete d.vets[id];
        delete d.lost[id];
        delete d.care[id];
        if (d.timer?.petId === id) d.timer = null;
      });
      afterSave(() => files.forEach((u) => deleteFile(u)));
      toast('已刪除');
      nav.popToRoot();
    });

  return (
    <Screen
      title={existing ? '編輯寵物' : params.first ? '建立你的第一隻寵物' : '新增寵物'}
      footer={
        <View style={{ gap: 8 }}>
          <Btn title="儲存" onPress={save} />
          {existing ? <Btn kind="danger" title="刪除這隻寵物" onPress={remove} /> : null}
        </View>
      }
    >
      <Row>
        <Pressable onPress={() => choosePhotos(1, (u) => u[0] && setPhoto(u[0]))} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: p.color, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="選擇寵物照片">
          {p.photo ? <Thumb uri={p.photo} label="寵物照片" style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: 13, color: C.ink, textAlign: 'center' }}>加入{'\n'}照片</Text>}
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          <Btn small kind="outline" title={p.photo ? '更換照片' : '拍照或選照片'} onPress={() => choosePhotos(1, (u) => u[0] && setPhoto(u[0]))} />
          {p.photo ? <Btn small kind="ghost" title="移除照片" onPress={() => setPhoto(undefined)} /> : null}
        </View>
      </Row>

      <Field label="名字" required value={p.name} onChangeText={(t) => set('name', t)} placeholder="例如：豆豆" error={tried && !p.name.trim() ? '請填寫名字' : null} />
      <View style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>種類</Label>
          <Text style={{ fontSize: 12, color: tried && !kindPicked ? C.danger : C.faint }}>{tried && !kindPicked ? '請選擇種類' : '必填'}</Text>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {KINDS.map((k) => {
            const on = kindPicked && p.kind === k.value;
            return (
              <Pressable
                key={k.value}
                onPress={() => {
                  if (p.kind !== k.value) setP((o) => ({ ...o, kind: k.value, breed: '' }));
                  setKindPicked(true);
                }}
                style={{ flexGrow: 1, flexBasis: '30%', minHeight: 56, borderRadius: 18, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.card, alignItems: 'center', justifyContent: 'center' }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={k.label}
              >
                <Text style={{ fontSize: 17, fontWeight: '700', color: on ? C.bg : C.ink }}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {more ? (
        <>
      <View style={{ gap: 8 }}>
        <Field label="品種" value={p.breed} onChangeText={(t) => set('breed', t)} placeholder="例如：米克斯" />
        <Choice options={BREEDS[p.kind].map((b) => ({ value: b, label: b }))} value={p.breed} onChange={(b) => set('breed', b)} />
      </View>
      <View style={{ gap: 8 }}>
        <Label>性別</Label>
        <Segment options={[{ value: 'male', label: '公' }, { value: 'female', label: '母' }]} value={p.sex} onChange={(s) => set('sex', s)} />
      </View>
      <Toggle label="已結紮" value={p.neutered} onChange={(v) => set('neutered', v)} />
      <DateField label="生日（不確定可填大約日期）" value={p.birthday} onChange={(v) => set('birthday', v)} optional max={today()} />
      <DateField label="來到家裡的日子" value={p.adopted} onChange={(v) => set('adopted', v)} optional max={today()} />
      <Field label="晶片號碼" value={p.chip} onChangeText={(t) => set('chip', t)} keyboardType="numeric" placeholder="15 碼" />
      <Field label="過敏" value={p.allergy} onChangeText={(t) => set('allergy', t)} placeholder="例如：雞肉；沒有可留白" />
      <View style={{ gap: 8 }}>
        <Label>代表色</Label>
        <Row gap={10}>
          {PET_COLORS.map((c) => (
            <Pressable key={c} onPress={() => set('color', c)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, borderWidth: p.color === c ? 3 : 1, borderColor: p.color === c ? C.ink : C.line }} accessibilityRole="button" accessibilityLabel={`顏色 ${c}`} accessibilityState={{ selected: p.color === c }} />
          ))}
        </Row>
      </View>
        </>
      ) : (
        <Btn kind="soft" title="＋ 更多資料（品種、生日、晶片…選填）" onPress={() => setMore(true)} />
      )}
      {!existing ? <Sub>儲存後會依種類自動建立建議的每日照護和美容項目，之後都可以修改。</Sub> : null}
    </Screen>
  );
}
