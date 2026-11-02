import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Screen, Card, Btn, Chip, ChipRow, Choice, Field, NumberField, Progress, Row, Section, Empty, H2, Sub, Label, Banner, Avatar, confirm,
} from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, petName } from '../../lib/store';
import { supplyNow, supplyDaysLeft, supplyStatusText, money } from '../../lib/domain';
import { today } from '../../lib/date';
import { openUrl, shareText } from '../../lib/files';
import { useBackHandler } from '../../nav';
import { uid } from '../../lib/seed';
import type { Supply } from '../../lib/types';

const UNITS = ['kg', '包', '罐', '片', '支', '個', '條'];
const SHOPS: [string, (q: string) => string][] = [
  ['蝦皮', (q) => 'https://shopee.tw/search?keyword=' + encodeURIComponent(q)],
  ['momo', (q) => 'https://www.momoshop.com.tw/search/searchShop.jsp?keyword=' + encodeURIComponent(q)],
  ['PChome', (q) => 'https://24h.pchome.com.tw/search/?q=' + encodeURIComponent(q)],
];
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Draft { id: string | null; petId: string; name: string; unit: string; stock: number | null; use: number | null; pack: number | null; price: number | null }

export default function SuppliesScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const [all, setAll] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [orig, setOrig] = useState('');
  const [tried, setTried] = useState(false);
  const [restockFor, setRestockFor] = useState<string | null>(null);
  const [openShops, setOpenShops] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);
  const filter = all ? 'all' : petId ?? 'all';

  const dirty = !!draft && JSON.stringify(draft) !== orig;
  const close = () => {
    if (dirty) confirm('放棄未儲存的內容？', '這個用品的修改不會儲存。', () => setDraft(null), '放棄');
    else setDraft(null);
  };
  useBackHandler(draft ? () => { close(); return true; } : null);

  const open = (d: Draft) => {
    const go = () => {
      setDraft(d);
      setOrig(JSON.stringify(d));
      setTried(false);
      setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 50);
    };
    if (draft && dirty) confirm('放棄未儲存的內容？', '目前的修改不會儲存。', go, '放棄');
    else go();
  };

  const list = store.supplies
    .filter((x) => filter === 'all' || x.petId === filter)
    .map((x) => ({ x, days: supplyDaysLeft(x), now: supplyNow(x) }))
    .sort((a, b) => a.days - b.days);
  const cart = store.supplies.filter((x) => x.inCart && (filter === 'all' || x.petId === filter));

  const save = () => {
    if (!draft) return;
    setTried(true);
    if (!draft.name.trim() || draft.stock === null || draft.use === null || !draft.pack) return;
    const td = today();
    update((d) => {
      const rec: Supply = {
        id: draft.id ?? uid('s'), petId: draft.petId, name: draft.name.trim(), unit: draft.unit.trim() || '個',
        stock: round2(draft.stock ?? 0), use: round2(draft.use ?? 0), pack: round2(draft.pack ?? 1), asOf: td,
        inCart: d.supplies.find((y) => y.id === draft.id)?.inCart ?? false, price: draft.price ? Math.round(draft.price) : undefined,
      };
      const i = d.supplies.findIndex((y) => y.id === rec.id);
      if (i >= 0) d.supplies[i] = rec;
      else d.supplies.push(rec);
    });
    toast(draft.id ? '已更新' : '已新增用品');
    setDraft(null);
  };

  const restock = (x: Supply, logExpense: boolean) => {
    update((d) => {
      const y = d.supplies.find((z) => z.id === x.id);
      if (!y) return;
      y.stock = round2(supplyNow(y) + y.pack);
      y.asOf = today();
      y.inCart = false;
      if (logExpense && y.price) d.expenses.push({ id: uid('x'), date: today(), cat: '用品', amt: y.price, petId: y.petId, note: `${y.name} 補貨 ${y.pack}${y.unit}` });
    });
    setRestockFor(null);
    toast(logExpense && x.price ? `已補貨，並記一筆 ${money(x.price)}` : '已補貨');
  };

  const shareCart = () => {
    const lines = cart.map((x) => `・${x.name} ${x.pack}${x.unit}（${petName(store, x.petId)}）${x.price ? ' 約 ' + money(x.price) : ''}`);
    shareText(`PetPal 購物清單\n${lines.join('\n')}`, '購物清單');
  };

  return (
    <Screen title="用品庫存" subtitle="依每天用量自動扣庫存，快用完會提醒" scrollRef={scrollRef}>
      {store.pets.length ? (
        <ChipRow>
          <Chip label="全部" on={all} onPress={() => setAll(true)} />
          {store.pets.map((p) => (
            <Chip key={p.id} label={p.name} on={!all && p.id === petId} onPress={() => { setAll(false); setPetId(p.id); }} style={{ paddingLeft: 5 }}
              leading={<Avatar name={p.name} color={p.color} size={28} photo={p.photo} textColor={C.ink} />} />
          ))}
        </ChipRow>
      ) : null}

      {draft ? (
        <Card style={{ gap: 12, borderColor: C.accent }}>
          <H2>{draft.id ? '編輯用品' : '新增用品'}</H2>
          <Field label="名稱" required value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} placeholder="例如：乾糧、貓砂" error={tried && !draft.name.trim() ? '請填寫名稱' : null} />
          <Label>寵物</Label>
          <Choice options={store.pets.map((p) => ({ value: p.id, label: p.name }))} value={draft.petId} onChange={(v) => setDraft({ ...draft, petId: v })} />
          <Label>單位</Label>
          <Choice options={UNITS.map((u) => ({ value: u, label: u }))} value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} />
          <NumberField label="目前庫存" required unit={draft.unit} value={draft.stock} onChange={(v) => setDraft({ ...draft, stock: v })} error={tried && draft.stock === null ? '請輸入目前庫存' : null} />
          <NumberField label="每天用量" required unit={draft.unit} value={draft.use} onChange={(v) => setDraft({ ...draft, use: v })} placeholder="例如：0.18" error={tried && draft.use === null ? '請輸入每天用量（不用扣就填 0）' : null} />
          <NumberField label="每次補貨量（一包的量）" required unit={draft.unit} value={draft.pack} onChange={(v) => setDraft({ ...draft, pack: v })} error={tried && !draft.pack ? '請輸入每次補貨量' : null} />
          <NumberField label="每包價格（選填）" integer unit="元" value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} />
          <Btn title="儲存" onPress={save} />
          <Row>
            <Btn small kind="outline" title="取消" style={{ flex: 1 }} onPress={close} />
            {draft.id ? (
              <Btn small kind="danger" title="刪除" style={{ flex: 1 }} onPress={() => confirm(`刪除「${draft.name}」？`, '刪除後無法復原。', () => {
                update((d) => { d.supplies = d.supplies.filter((y) => y.id !== draft.id); });
                setDraft(null);
                toast('已刪除');
              })} />
            ) : null}
          </Row>
        </Card>
      ) : null}

      {cart.length ? (
        <Card style={{ gap: 10, backgroundColor: C.blueBg, borderWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.blueInk }}>購物清單 {cart.length} 項</Text>
          <Sub style={{ color: C.blueInk }}>{cart.map((x) => x.name).join('、')}</Sub>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Btn small kind="dark" title="分享清單" onPress={shareCart} />
            <Btn small kind="outline" title="全部標記已補貨" onPress={() => confirm('全部標記已補貨？', `清單裡的 ${cart.length} 項都會加上一次補貨量。`, () => cart.forEach((x) => restock(x, false)), '確定')} />
            <Btn small kind="ghost" title="清空清單" onPress={() => update((d) => { d.supplies.forEach((y) => { if (filter === 'all' || y.petId === filter) y.inCart = false; }); })} />
          </Row>
        </Card>
      ) : null}

      <Section title="庫存" action={draft || !store.pets.length ? undefined : { label: '＋ 新增用品', onPress: () => open({ id: null, petId: filter === 'all' ? store.pets[0].id : filter, name: '', unit: 'kg', stock: null, use: null, pack: null, price: null }) }}>
        {!store.pets.length ? <Empty text="請先新增寵物" /> : null}
        {list.map(({ x, days, now }) => {
          const color = now <= 0 || days <= 3 ? C.danger : days <= 7 ? '#B5721F' : C.greenDark;
          const perDay = x.price && x.use > 0 && x.pack > 0 ? (x.price / x.pack) * x.use : 0;
          return (
            <Card key={x.id} style={{ gap: 10, borderColor: days <= 7 ? '#E7B49A' : C.line }}>
              <Pressable onPress={() => open({ id: x.id, petId: x.petId, name: x.name, unit: x.unit, stock: now, use: x.use, pack: x.pack, price: x.price ?? null })} accessibilityRole="button" accessibilityLabel={`編輯 ${x.name}`} style={{ gap: 4 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{x.name}</Text>
                    <Sub>{petName(store, x.petId)} · 剩 {now} {x.unit} · 每天 {x.use} {x.unit}{perDay ? ` · 每天約 ${money(perDay)}` : ''}</Sub>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color, maxWidth: 140, textAlign: 'right' }}>{supplyStatusText(x)}</Text>
                </Row>
              </Pressable>
              {isFinite(days) ? <Progress pct={Math.min(100, (days / 30) * 100)} color={color} /> : null}
              {restockFor === x.id ? (
                <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: C.sand }}>
                  <Text style={{ fontSize: 14, color: C.ink }}>補貨 {x.pack} {x.unit}{x.price ? `，同時記一筆花費 ${money(x.price)}？` : '？'}</Text>
                  <Row gap={8} style={{ flexWrap: 'wrap' }}>
                    {x.price ? <Btn small title="補貨並記花費" onPress={() => restock(x, true)} /> : null}
                    <Btn small kind={x.price ? 'outline' : 'primary'} title={x.price ? '只補貨' : '確定補貨'} onPress={() => restock(x, false)} />
                    <Btn small kind="ghost" title="取消" onPress={() => setRestockFor(null)} />
                  </Row>
                </View>
              ) : (
                <Row gap={8}>
                  <Btn small kind="dark" title={`補貨 +${x.pack} ${x.unit}`} style={{ flex: 1 }} onPress={() => setRestockFor(x.id)} />
                  <Btn small kind="outline" title={x.inCart ? '已在清單' : '加入清單'} style={{ flex: 1 }}
                    onPress={() => update((d) => { const y = d.supplies.find((z) => z.id === x.id); if (y) y.inCart = !y.inCart; })} />
                </Row>
              )}
              {openShops === x.id ? (
                <Row gap={8}>
                  {SHOPS.map(([n, url]) => <Btn key={n} small kind="soft" title={n} style={{ flex: 1 }} onPress={() => openUrl(url(x.name))} />)}
                </Row>
              ) : (
                <Btn small kind="ghost" title="上網找貨" onPress={() => setOpenShops(x.id)} style={{ alignSelf: 'flex-start' }} />
              )}
            </Card>
          );
        })}
        {store.pets.length && !list.length ? <Empty text="還沒有記錄任何用品" /> : null}
      </Section>
      <Banner kind="info" text="剩 3 天以內時，手機會在早上 10 點提醒你補貨（需在設定開啟通知）。" />
    </Screen>
  );
}
