import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  Screen, Card, Btn, Chip, ChipRow, Choice, Field, DateField, Progress, ListCard, Row, Section, Empty, H2, Sub, Label, confirm,
} from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, petName } from '../../lib/store';
import { money } from '../../lib/domain';
import { today, monthKey, addMonthKey, monthLabel, shortDate } from '../../lib/date';
import { shareTextFile } from '../../lib/files';
import { uid } from '../../lib/seed';
import type { Expense } from '../../lib/types';

const CATS: [string, string][] = [
  ['食物', '#E7B44C'], ['醫療', '#C4602F'], ['用品', '#7E9C78'], ['美容', '#A77AA3'], ['保險', '#6E8FB0'], ['保母', '#5E9C8A'], ['其他', '#B9A894'],
];
const catColor = (c: string) => CATS.find((x) => x[0] === c)?.[1] ?? '#B9A894';

interface Draft { id: string | null; amt: string; cat: string; petId: string; date: string; note: string }
const blank = (): Draft => ({ id: null, amt: '', cat: '食物', petId: 'all', date: today(), note: '' });

export default function ExpenseScreen(_: { params: any }) {
  const { store, update, toast } = useStore();
  const cur = monthKey(today());
  const [month, setMonth] = useState(cur);
  const [pf, setPf] = useState<string>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tried, setTried] = useState(false);

  const filtered = useMemo(
    () => store.expenses.filter((x) => pf === 'all' || x.petId === pf),
    [store.expenses, pf],
  );
  const inMonth = filtered.filter((x) => x.date.startsWith(month)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = inMonth.reduce((a, x) => a + x.amt, 0);
  const budget = store.budget || 5000;
  const byCat = CATS.map(([c, col]) => ({ c, col, amt: inMonth.filter((x) => x.cat === c).reduce((a, x) => a + x.amt, 0) })).filter((x) => x.amt > 0);
  const months = [-5, -4, -3, -2, -1, 0].map((n) => addMonthKey(month, n));
  const tots = months.map((m) => filtered.filter((x) => x.date.startsWith(m)).reduce((a, x) => a + x.amt, 0));
  const tmax = Math.max(1, ...tots);

  const R = 54;
  const CIRC = 2 * Math.PI * R;
  let cum = 0;

  const save = () => {
    if (!draft) return;
    const a = Number(draft.amt);
    if (!(a > 0)) return setTried(true);
    const rec: Expense = { id: draft.id ?? uid('x'), date: draft.date || today(), cat: draft.cat, amt: a, petId: draft.petId, note: draft.note.trim() };
    update((d) => {
      const i = d.expenses.findIndex((x) => x.id === rec.id);
      if (i >= 0) d.expenses[i] = rec;
      else d.expenses.push(rec);
    });
    toast(draft.id ? '已更新這筆花費' : '已記一筆');
    setMonth(monthKey(rec.date));
    setDraft(null);
    setTried(false);
  };

  const exportCsv = () => {
    const rows = [...store.expenses].sort((a, b) => (a.date < b.date ? -1 : 1));
    const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = '﻿' + ['日期,分類,金額,寵物,備註', ...rows.map((x) => [x.date, q(x.cat), x.amt, q(petName(store, x.petId)), q(x.note)].join(','))].join('\n');
    shareTextFile(`petpal-花費-${month}.csv`, csv, 'text/csv');
  };

  return (
    <Screen title="花費記帳" subtitle="每月花費與預算">
      <ChipRow>
        <Chip label="全部" on={pf === 'all'} onPress={() => setPf('all')} />
        {store.pets.map((p) => <Chip key={p.id} label={p.name} on={pf === p.id} onPress={() => setPf(p.id)} />)}
      </ChipRow>

      <Row style={{ justifyContent: 'space-between' }}>
        <Btn small kind="soft" title="‹" accessibilityLabel="上個月" onPress={() => setMonth(addMonthKey(month, -1))} />
        <H2>{monthLabel(month)}</H2>
        <Btn small kind="soft" title="›" accessibilityLabel="下個月" disabled={month >= cur} onPress={() => setMonth(addMonthKey(month, 1))} />
      </Row>

      <Card style={{ gap: 10 }}>
        <Label>本月花費</Label>
        <Text style={{ fontSize: 34, fontWeight: '700', color: C.ink }}>{money(total)}</Text>
        <Progress pct={(total / budget) * 100} color={total > budget ? C.danger : C.green} height={10} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: total > budget ? C.danger : C.greenDark, fontWeight: '700', fontSize: 13 }}>
            {total > budget ? `超出 ${money(total - budget)}` : `還剩 ${money(budget - total)}`}
          </Text>
          <Row gap={6}>
            <Sub>預算</Sub>
            <Btn small kind="soft" title="−" accessibilityLabel="預算減少 500" onPress={() => update((d) => { d.budget = Math.max(500, (d.budget || 5000) - 500); })} />
            <Text style={{ fontWeight: '600', color: C.ink }}>{money(budget)}</Text>
            <Btn small kind="soft" title="＋" accessibilityLabel="預算增加 500" onPress={() => update((d) => { d.budget = (d.budget || 5000) + 500; })} />
          </Row>
        </Row>
      </Card>

      {byCat.length ? (
        <Card style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Svg width={128} height={128} viewBox="0 0 140 140">
            <Circle cx={70} cy={70} r={R} stroke={C.lineSoft} strokeWidth={20} fill="none" />
            {byCat.map((x) => {
              const len = (x.amt / total) * CIRC;
              const el = (
                <Circle key={x.c} cx={70} cy={70} r={R} stroke={x.col} strokeWidth={20} fill="none"
                  strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={-cum} rotation={-90} origin="70,70" />
              );
              cum += len;
              return el;
            })}
          </Svg>
          <View style={{ flex: 1, gap: 6 }}>
            {byCat.map((x) => (
              <Row key={x.c} gap={6}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: x.col }} />
                <Text style={{ flex: 1, fontSize: 12, color: C.ink }}>{x.c} {Math.round((x.amt / total) * 100)}%</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.ink }}>{money(x.amt)}</Text>
              </Row>
            ))}
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Label>近 6 個月</Label>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120 }}>
          {months.map((m, i) => (
            <Pressable key={m} onPress={() => setMonth(m)} style={{ flex: 1, alignItems: 'center', gap: 4 }} accessibilityRole="button" accessibilityLabel={monthLabel(m)}>
              <Text style={{ fontSize: 10, color: C.sub }}>{tots[i] ? (Math.round(tots[i] / 100) / 10) + 'k' : ''}</Text>
              <View style={{ width: '100%', maxWidth: 30, height: Math.max(4, Math.round((tots[i] / tmax) * 80)), borderRadius: 8, backgroundColor: m === month ? C.accent : '#E5D8C6' }} />
              <Text style={{ fontSize: 11, color: C.sub }}>{Number(m.slice(5))}月</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Section title="明細" action={draft ? undefined : { label: '＋ 記一筆', kind: 'primary', onPress: () => { setDraft(blank()); setTried(false); } }}>
        {draft ? (
          <Card style={{ gap: 12 }}>
            <Field label="金額（NT$）" required keyboardType="numeric" value={draft.amt} placeholder="0"
              onChangeText={(t) => setDraft({ ...draft, amt: t.replace(/[^0-9.]/g, '') })}
              error={tried && !(Number(draft.amt) > 0) ? '請輸入大於 0 的金額' : null} />
            <Label>分類</Label>
            <Choice options={CATS.map(([c]) => ({ value: c, label: c }))} value={draft.cat} onChange={(v) => setDraft({ ...draft, cat: v })} />
            <Label>寵物</Label>
            <Choice options={[{ value: 'all', label: '全部寵物' }, ...store.pets.map((p) => ({ value: p.id, label: p.name }))]} value={draft.petId} onChange={(v) => setDraft({ ...draft, petId: v })} />
            <DateField label="日期" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} />
            <Field label="備註" value={draft.note} placeholder="例如：乾糧 7kg" onChangeText={(t) => setDraft({ ...draft, note: t })} />
            <Btn title="儲存" onPress={save} />
            <Row>
              <Btn small kind="outline" title="取消" style={{ flex: 1 }} onPress={() => setDraft(null)} />
              {draft.id ? (
                <Btn small kind="danger" title="刪除" style={{ flex: 1 }} onPress={() => confirm('刪除這筆花費？', '刪除後無法復原。', () => {
                  update((d) => { d.expenses = d.expenses.filter((x) => x.id !== draft.id); });
                  setDraft(null);
                  toast('已刪除');
                })} />
              ) : null}
            </Row>
          </Card>
        ) : null}
        {inMonth.length ? (
          <ListCard>
            {inMonth.map((x) => (
              <Pressable key={x.id} onPress={() => { setDraft({ id: x.id, amt: String(x.amt), cat: x.cat, petId: x.petId, date: x.date, note: x.note }); setTried(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }} accessibilityRole="button" accessibilityLabel={`編輯 ${x.cat} ${money(x.amt)}`}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: catColor(x.cat) }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>{x.cat}{x.note ? ' · ' + x.note : ''}</Text>
                  <Sub>{shortDate(x.date)} · {petName(store, x.petId)}</Sub>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>{money(x.amt)}</Text>
              </Pressable>
            ))}
          </ListCard>
        ) : (
          <Empty text="這個月還沒有花費紀錄" />
        )}
      </Section>

      <Btn kind="outline" title="匯出全部花費（CSV）" onPress={exportCsv} />
    </Screen>
  );
}
