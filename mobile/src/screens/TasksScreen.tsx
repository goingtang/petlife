import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStore, memberName } from '../lib/store';
import { useBackHandler } from '../nav';
import { Avatar, Btn, Card, Choice, Empty, Field, Label, PetChips, Row, Screen, Sub, TimeField, confirm } from '../ui/kit';
import { C } from '../ui/theme';
import { tasksFor } from '../lib/domain';
import { defaultTasks, uid } from '../lib/seed';
import type { CareTask } from '../lib/types';

export default function TasksScreen({ params }: { params: any }) {
  const { store, update, toast } = useStore();
  const [petId, setPet] = useState<string>(params.petId ?? store.pets[0]?.id);
  const [edit, setEdit] = useState<CareTask | null>(null);
  useBackHandler(edit ? () => (setEdit(null), true) : null);
  const pet = store.pets.find((p) => p.id === petId);
  const tasks = pet ? tasksFor(store, pet.id) : [];

  const save = () => {
    if (!edit || !edit.title.trim()) return;
    update((d) => {
      const i = d.tasks.findIndex((t) => t.id === edit.id);
      const clean = { ...edit, title: edit.title.trim() };
      if (i >= 0) d.tasks[i] = clean;
      else d.tasks.push(clean);
    });
    setEdit(null);
    toast('已儲存');
  };

  return (
    <Screen title="每日照護項目" subtitle="每天都會自動重新開始。指派給不同家人，就能輪流照顧。">
      <PetChips value={petId} onChange={(id) => { setPet(id); setEdit(null); }} />
      {!pet ? <Empty text="請先新增寵物" /> : null}

      {tasks.map((t) =>
        edit?.id === t.id ? null : (
          <Card key={t.id} onPress={() => setEdit({ ...t })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 16 }}>
            <Text style={{ width: 50, fontSize: 15, fontWeight: '700', color: C.ink }}>{t.time}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: C.ink }}>{t.title}</Text>
              <Sub style={{ fontSize: 12 }}>由{memberName(store, t.who)}負責</Sub>
            </View>
            <Avatar name={memberName(store, t.who)} color={store.members.find((m) => m.id === t.who)?.color ?? C.faint} size={28} />
          </Card>
        ),
      )}

      {edit ? (
        <Card style={{ gap: 12 }}>
          <Field label="項目" value={edit.title} onChangeText={(x) => setEdit({ ...edit, title: x })} placeholder="例如：晚間散步" autoFocus />
          <TimeField label="時間" value={edit.time} onChange={(x) => setEdit({ ...edit, time: x })} />
          <View style={{ gap: 8 }}>
            <Label>負責的人</Label>
            <Choice options={store.members.map((m) => ({ value: m.id, label: m.name }))} value={edit.who} onChange={(x) => setEdit({ ...edit, who: x })} />
          </View>
          <Row gap={8}>
            <Btn title="儲存" onPress={save} style={{ flex: 1 }} disabled={!edit.title.trim()} />
            <Btn kind="outline" title="取消" onPress={() => setEdit(null)} />
          </Row>
          {tasks.some((t) => t.id === edit.id) ? (
            <Btn
              small
              kind="danger"
              title="刪除這個項目"
              onPress={() =>
                confirm('刪除這個照護項目？', '', () => {
                  update((d) => {
                    d.tasks = d.tasks.filter((t) => t.id !== edit.id);
                  });
                  setEdit(null);
                })
              }
            />
          ) : null}
        </Card>
      ) : pet ? (
        <View style={{ gap: 8 }}>
          <Btn kind="outline" title="＋ 新增項目" onPress={() => setEdit({ id: uid('t'), petId: pet.id, title: '', time: '08:00', who: store.me })} />
          {!tasks.length ? (
            <Btn
              kind="ghost"
              title="套用建議項目"
              onPress={() => {
                update((d) => {
                  d.tasks.push(...defaultTasks(pet, d.me));
                });
                toast('已加入建議的照護項目');
              }}
            />
          ) : null}
        </View>
      ) : null}
      <Pressable accessible={false}>
        <Sub>小提醒：在首頁點一下項目就能打卡；如果已由其他家人完成，會提醒你不用再做。</Sub>
      </Pressable>
    </Screen>
  );
}
