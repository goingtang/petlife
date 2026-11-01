import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { Avatar, Badge, Banner, Btn, Card, Field, Label, Row, Screen, Section, Sub, confirm } from '../ui/kit';
import { C } from '../ui/theme';
import { MEMBER_COLORS, uid } from '../lib/seed';

export default function MembersScreen() {
  const { store, update, toast } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(MEMBER_COLORS[1]);

  const startEdit = (id: string | 'new') => {
    const m = store.members.find((x) => x.id === id);
    setEditing(id);
    setName(m?.name ?? '');
    setColor(m?.color ?? MEMBER_COLORS[store.members.length % MEMBER_COLORS.length]);
  };

  const save = () => {
    if (!name.trim()) return;
    update((d) => {
      if (editing === 'new') d.members.push({ id: uid('u'), name: name.trim(), color });
      else {
        const m = d.members.find((x) => x.id === editing);
        if (m) Object.assign(m, { name: name.trim(), color });
      }
    });
    setEditing(null);
    toast('已儲存');
  };

  const remove = (id: string) => {
    if (store.members.length <= 1) return;
    confirm('移除這位成員？', '他負責的照護項目會改由你負責，過去的紀錄會保留。', () => {
      update((d) => {
        d.members = d.members.filter((m) => m.id !== id);
        if (d.me === id) d.me = d.members[0].id;
        d.tasks.forEach((t) => {
          if (t.who === id) t.who = d.me;
        });
      });
      setEditing(null);
    }, '移除');
  };

  return (
    <Screen title="家人成員" subtitle="共同照顧的人。照護項目可以指派給不同成員輪值。">
      <Banner kind="info" text="目前資料存在這支手機。家人用各自手機即時同步，需等雲端帳號功能上線；現在可以在同一支手機切換「我是誰」來記錄。" />

      <Section title="現在使用這支手機的是">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {store.members.map((m) => {
            const on = m.id === store.me;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  update((d) => {
                    d.me = m.id;
                  });
                  toast(`已切換為「${m.name}」`);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingRight: 14, minHeight: 44, borderRadius: 22, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.card }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Avatar name={m.name} color={m.color} size={32} />
                <Text style={{ color: on ? C.bg : C.ink, fontWeight: '600' }}>{m.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Sub>之後的打卡、紀錄和日記都會記在這個人名下。</Sub>
      </Section>

      <Section title="成員" action={{ label: '＋ 新增成員', onPress: () => startEdit('new') }}>
        {store.members.map((m) =>
          editing === m.id ? null : (
            <Card key={m.id} onPress={() => startEdit(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Avatar name={m.name} color={m.color} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{m.name}</Text>
                <Sub style={{ fontSize: 12 }}>負責 {store.tasks.filter((t) => t.who === m.id).length} 項照護</Sub>
              </View>
              {m.id === store.me ? <Badge text="目前使用者" bg={C.greenBg} fg={C.greenDark} /> : null}
              <Text style={{ color: C.sub, fontSize: 18 }}>›</Text>
            </Card>
          ),
        )}
        {editing ? (
          <Card style={{ gap: 12 }}>
            <Field label="名字" value={name} onChangeText={setName} placeholder="例如：媽媽、小傑" autoFocus />
            <View style={{ gap: 8 }}>
              <Label>代表色</Label>
              <Row gap={10}>
                {MEMBER_COLORS.map((c) => (
                  <Pressable key={c} onPress={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: C.ink }} accessibilityRole="button" accessibilityState={{ selected: color === c }} />
                ))}
              </Row>
            </View>
            <Row gap={8}>
              <Btn title="儲存" onPress={save} style={{ flex: 1 }} disabled={!name.trim()} />
              <Btn kind="outline" title="取消" onPress={() => setEditing(null)} />
            </Row>
            {editing !== 'new' && store.members.length > 1 ? <Btn kind="danger" small title="移除這位成員" onPress={() => remove(editing)} /> : null}
          </Card>
        ) : null}
      </Section>
    </Screen>
  );
}
