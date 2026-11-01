import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Screen, Card, Btn, Choice, Field, Stepper, Progress, PetChips, Banner, Row, Empty, Sub, Label, confirm,
} from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, petName } from '../../lib/store';
import { supplyNow, supplyDaysLeft } from '../../lib/domain';
import { today } from '../../lib/date';
import { openUrl } from '../../lib/files';
import { uid } from '../../lib/seed';
import type { Supply } from '../../lib/types';

const UNITS = ['kg', '包', '罐', '片', '支', '個'];
const fmt = (n: number) => String(Math.round(n * 100) / 100);

interface Draft { id: string | null; name: string; petId: string; unit: string; stock: number; use: number; pack: number }

export default function SuppliesScreen(_: { params: any }) {
  const { store, update, toast } = useStore();
  const [pf, setPf] = useState('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tried, setTried] = useState(false);

  const items = store.supplies
    .filter((x) => pf === 'all' || x.petId === pf)
    .map((x) => ({ x, days: supplyDaysLeft(x) }))
    .sort((a, b) => a.days - b.days);
  const cart = store.supplies.filter((x) => x.inCart);

  const newDraft = (): Draft => ({ id: null, name: '', petId: pf !== 'all' ? pf : store.pets[0]?.id ?? 'all', unit: 'kg', stock: 1, use: 0.1, pack: 1 });
  const edit = (x: Supply) => setDraft({ id: x.id, name: x.name, petId: x.petId, unit: x.unit, stock: supplyNow(x), use: x.use, pack: x.pack });

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return setTried(true);
    update((d) => {
      const i = d.supplies.findIndex((s) => s.id === draft.id);
      const rec: Supply = {
        id: draft.id ?? uid('s'), petId: draft.petId, name: draft.name.trim(), unit: draft.unit, stock: draft.stock,
        use: draft.use, pack: draft.pack, asOf: today(), inCart: i >= 0 ? d.supplies[i].inCart : false,
      };
      if (i >= 0) d.supplies[i] = rec;
      else d.supplies.push(rec);
    });
    toast(draft.id ? '已更新' : '已新增用品');
    setDraft(null);
    setTried(false);
  };

  if (draft) {
    return (
      <Screen title={draft.id ? '編輯用品' : '新增用品'}>
        <Field label="名稱" required value={draft.name} placeholder="例如：乾糧" onChangeText={(t) => setDraft({ ...draft, name: t })} error={tried && !draft.name.trim() ? '請填寫名稱' : null} />
        <Label>寵物</Label>
        <Choice options={[{ value: 'all', label: '全部寵物' }, ...store.pets.map((p) => ({ value: p.id, label: p.name }))]} value={draft.petId} onChange={(v) => setDraft({ ...draft, petId: v })} />
        <Label>單位</Label>
        <Choice options={UNITS.map((u) => ({ value: u, label: u }))} value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} />
        <Stepper label="目前庫存" value={draft.stock} step={draft.unit === 'kg' ? 0.1 : 1} decimals={1} unit={draft.unit} onChange={(v) => setDraft({ ...draft, stock: v })} />
        <Stepper label="每天用量" value={draft.use} step={0.05} decimals={2} unit={draft.unit} onChange={(v) => setDraft({ ...draft, use: v })} />
        <Stepper label="每次補貨量" value={draft.pack} step={1} min={1} unit={draft.unit} onChange={(v) => setDraft({ ...draft, pack: v })} />
        <Sub>庫存會依每天用量自動扣減，快用完時會標示提醒。</Sub>
        <Btn title="儲存" onPress={save} />
        <Row>
          <Btn kind="outline" small title="取消" style={{ flex: 1 }} onPress={() => setDraft(null)} />
          {draft.id ? (
            <Btn kind="danger" small title="刪除" style={{ flex: 1 }} onPress={() => confirm('刪除這項用品？', '刪除後無法復原。', () => {
              update((d) => { d.supplies = d.supplies.filter((s) => s.id !== draft.id); });
              setDraft(null);
              toast('已刪除');
            })} />
          ) : null}
        </Row>
      </Screen>
    );
  }

  return (
    <Screen title="用品庫存" subtitle="快用完時提醒，一鍵找貨">
      <PetChips value={pf} onChange={setPf} allowAll />
      {cart.length ? <Banner kind="info" text={`購物清單 ${cart.length} 項：${cart.map((x) => x.name).join('、')}`} /> : null}
      {items.length ? items.map(({ x, days }) => {
        const color = days <= 3 ? C.danger : days <= 7 ? '#D08A2E' : C.green;
        return (
          <Card key={x.id} style={{ gap: 10, borderColor: days <= 7 ? '#E7B49A' : C.line }}>
            <Pressable onPress={() => edit(x)} accessibilityRole="button" accessibilityLabel={`編輯 ${x.name}`} style={{ gap: 10 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{x.name}</Text>
                  <Sub>{petName(store, x.petId)} · 剩 {fmt(supplyNow(x))} {x.unit} · 每天 {fmt(x.use)} {x.unit}</Sub>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color }}>{days <= 7 ? '快用完了 · ' : ''}約剩 {days} 天</Text>
              </Row>
              <Progress pct={(days / 30) * 100} color={color} />
            </Pressable>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Btn small kind="dark" title={`補貨 ＋${fmt(x.pack)} ${x.unit}`} onPress={() => {
                update((d) => {
                  const s = d.supplies.find((y) => y.id === x.id);
                  if (!s) return;
                  s.stock = Math.round((supplyNow(s) + s.pack) * 100) / 100;
                  s.asOf = today();
                  s.inCart = false;
                });
                toast('已補貨');
              }} />
              <Btn small kind="outline" title={x.inCart ? '已在清單 ✓' : '加入購物清單'} onPress={() => update((d) => {
                const s = d.supplies.find((y) => y.id === x.id);
                if (s) s.inCart = !s.inCart;
              })} />
              <Btn small kind="ghost" title="去蝦皮找" onPress={() => openUrl('https://shopee.tw/search?keyword=' + encodeURIComponent(x.name))} />
            </Row>
          </Card>
        );
      }) : <Empty text="還沒有記錄用品，新增後會自動估算還能用幾天。" />}
      <Btn title="＋ 新增用品" onPress={() => { setDraft(newDraft()); setTried(false); }} />
    </Screen>
  );
}
