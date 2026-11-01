import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Screen, Card, Btn, Field, DateField, Stepper, Progress, PetChips, Row, Empty, Sub, confirm,
} from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { groomDue, mapsSearch } from '../../lib/domain';
import { today, daysBetween, shortDate } from '../../lib/date';
import { openUrl } from '../../lib/files';
import { uid, defaultGroom } from '../../lib/seed';

interface Draft { id: string | null; name: string; every: number; last: string }

export default function GroomScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tried, setTried] = useState(false);

  if (!pet) {
    return <Screen title="美容洗澡"><Empty text="先新增一隻寵物，就能安排美容洗澡週期。" /></Screen>;
  }
  const list = store.groom.filter((g) => g.petId === pet.id).sort((a, b) => groomDue(a) - groomDue(b));

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return setTried(true);
    update((d) => {
      const rec = { id: draft.id ?? uid('g'), petId: pet.id, name: draft.name.trim(), every: Math.max(1, Math.round(draft.every)), last: draft.last || today() };
      const i = d.groom.findIndex((g) => g.id === rec.id);
      if (i >= 0) d.groom[i] = rec;
      else d.groom.push(rec);
    });
    toast(draft.id ? '已更新' : '已新增項目');
    setDraft(null);
    setTried(false);
  };

  if (draft) {
    return (
      <Screen title={draft.id ? '編輯項目' : '新增項目'} subtitle={pet.name}>
        <Field label="項目名稱" required value={draft.name} placeholder="例如：洗澡" onChangeText={(t) => setDraft({ ...draft, name: t })} error={tried && !draft.name.trim() ? '請填寫名稱' : null} />
        <Stepper label="間隔天數" value={draft.every} min={1} max={365} unit="天" onChange={(v) => setDraft({ ...draft, every: v })} />
        <DateField label="上次完成日期" value={draft.last} onChange={(v) => setDraft({ ...draft, last: v })} />
        <Btn title="儲存" onPress={save} />
        <Row>
          <Btn small kind="outline" title="取消" style={{ flex: 1 }} onPress={() => setDraft(null)} />
          {draft.id ? (
            <Btn small kind="danger" title="刪除" style={{ flex: 1 }} onPress={() => confirm('刪除這個項目？', '刪除後無法復原。', () => {
              update((d) => { d.groom = d.groom.filter((g) => g.id !== draft.id); });
              setDraft(null);
              toast('已刪除');
            })} />
          ) : null}
        </Row>
      </Screen>
    );
  }

  return (
    <Screen title="美容洗澡" subtitle="洗澡、指甲、刷牙的週期提醒">
      <PetChips value={petId} onChange={setPetId} />
      {list.length ? list.map((g) => {
        const left = groomDue(g);
        const el = daysBetween(g.last, today());
        const color = left < 0 ? C.danger : left <= 1 ? '#D08A2E' : C.green;
        return (
          <Card key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable style={{ flex: 1, gap: 6 }} onPress={() => setDraft({ id: g.id, name: g.name, every: g.every, last: g.last })} accessibilityRole="button" accessibilityLabel={`編輯 ${g.name}`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{g.name}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color }}>{left < 0 ? `逾期 ${-left} 天` : left === 0 ? '今天' : `${left} 天後`}</Text>
              </Row>
              <Progress pct={(el / g.every) * 100} color={color} height={6} />
              <Sub>每 {g.every} 天 · 上次 {shortDate(g.last)}</Sub>
            </Pressable>
            <Btn small title="完成" style={{ backgroundColor: C.green }} onPress={() => {
              update((d) => { const x = d.groom.find((y) => y.id === g.id); if (x) x.last = today(); });
              toast(`已記錄：${g.name}`);
            }} />
          </Card>
        );
      }) : (
        <Card style={{ gap: 10 }}>
          <Sub>{pet.name}還沒有美容項目。</Sub>
          <Btn kind="outline" title="套用建議項目" onPress={() => { update((d) => { d.groom.push(...defaultGroom(pet)); }); toast('已加入建議項目'); }} />
        </Card>
      )}
      <Btn title="＋ 新增項目" onPress={() => { setDraft({ id: null, name: '', every: 7, last: today() }); setTried(false); }} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.purpleBg, borderColor: C.purpleBg }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>找附近寵物美容</Text>
          <Sub>開啟 Google 地圖搜尋</Sub>
        </View>
        <Btn small kind="dark" title="搜尋" onPress={() => openUrl(mapsSearch('寵物美容'))} />
      </Card>
    </Screen>
  );
}
