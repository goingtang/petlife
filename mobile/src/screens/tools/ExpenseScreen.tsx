import React, { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  Screen, Card, Btn, Thumb, PetChips, Choice, Field, DateField, NumberField, Progress, ListCard, Row, Section, Empty, H2, Sub, Label,
  Segment, PhotoGrid, Banner, confirm,
} from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, petName } from '../../lib/store';
import { money, safeFileName } from '../../lib/domain';
import { initialLastPosted, recurringMissedThisMonth } from '../../lib/life';
import { today, monthKey, addMonthKey, monthLabel, shortDate } from '../../lib/date';
import { shareTextFile, choosePhotos, usePendingFiles, deleteFile } from '../../lib/files';
import { useBackHandler } from '../../nav';
import { uid } from '../../lib/seed';
import type { Expense, RecurringExpense } from '../../lib/types';

const CATS: [string, string][] = [
  ['食物', '#E7B44C'], ['醫療', '#C4602F'], ['用品', '#7E9C78'], ['美容', '#A77AA3'], ['保險', '#6E8FB0'], ['保母', '#5E9C8A'], ['其他', '#B9A894'],
];
const catColor = (c: string) => CATS.find((x) => x[0] === c)?.[1] ?? '#B9A894';
/** Categories not in the list (e.g. from an imported backup) are counted as 其他. */
const catOf = (c: string) => (CATS.some((x) => x[0] === c) ? c : '其他');
const PAGE = 40;
const sum = (xs: Expense[]) => xs.reduce((a, x) => a + x.amt, 0);
const hundreds = (n: number) => (!n ? '—' : n < 100 ? money(n) : money(Math.round(n / 100) * 100));

interface Draft { id: string | null; amt: number | null; cat: string; petId: string; date: string; note: string; receipt?: string }
interface RDraft { id: string | null; amt: number | null; cat: string; petId: string; note: string; day: number | null }

function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheets from running it as a formula
  return /[",\r\n]/.test(s) || s !== String(v ?? '') ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ExpenseScreen({ params }: { params: any }) {
  const { store, update, toast, afterSave } = useStore();
  const cur = monthKey(today());
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(cur);
  const [year, setYear] = useState(cur.slice(0, 4));
  const [pf, setPf] = useState<string>('all');
  // Opened from 「＋ 記錄 → 花費」: start with a new expense.
  const [draft, setDraft] = useState<Draft | null>(() => (params?.add ? { id: null, amt: null, cat: '食物', petId: 'all', date: today(), note: '' } : null));
  const [orig, setOrig] = useState(() => (draft ? JSON.stringify(draft) : ''));
  const [showExport, setShowExport] = useState(false);
  const [tried, setTried] = useState(false);
  const [rdraft, setRdraft] = useState<RDraft | null>(null);
  const [budgetEdit, setBudgetEdit] = useState(false);
  const [catEdit, setCatEdit] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<number | null>(null);
  const [budgetErr, setBudgetErr] = useState<string | null>(null);
  const [offer, setOffer] = useState<RecurringExpense | null>(null);
  const [shown, setShown] = useState(PAGE);
  const scrollRef = useRef<any>(null);
  const files = usePendingFiles();

  const dirty = !!draft && JSON.stringify(draft) !== orig;
  const closeDraft = (after?: () => void) => {
    const doClose = () => {
      files.discard();
      setDraft(null);
      setTried(false);
      after?.();
    };
    if (dirty) confirm('放棄未儲存的內容？', '這筆花費的修改不會儲存。', doClose, '放棄');
    else doClose();
  };
  const rFormVisible = !!rdraft && mode === 'month';
  useBackHandler(
    draft || rFormVisible
      ? () => {
          if (draft) closeDraft();
          else setRdraft(null);
          return true;
        }
      : null,
  );

  const openDraft = (d: Draft) => {
    const go = () => {
      setDraft(d);
      setOrig(JSON.stringify(d));
      setTried(false);
      setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 50);
    };
    if (draft && dirty) confirm('放棄未儲存的內容？', '目前這筆花費的修改不會儲存。', () => { files.discard(); go(); }, '放棄');
    else go();
  };

  const pageKey = `${month}|${pf}`;
  const [pageFor, setPageFor] = useState(pageKey);
  if (pageFor !== pageKey) {
    setPageFor(pageKey);
    setShown(PAGE);
  }
  const forPet = (xs: Expense[]) => (pf === 'all' ? xs : xs.filter((x) => x.petId === pf));
  const inMonthAll = store.expenses.filter((x) => x.date.startsWith(month));
  const inMonth = forPet(inMonthAll).sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = sum(inMonth);
  const sharedMonth = pf === 'all' ? 0 : sum(inMonthAll.filter((x) => x.petId === 'all'));
  const budget = store.budget || 5000;
  const byCat = CATS.map(([c, col]) => ({ c, col, amt: sum(inMonth.filter((x) => catOf(x.cat) === c)) })).filter((x) => x.amt > 0);
  const months = [-5, -4, -3, -2, -1, 0].map((n) => addMonthKey(month, n));
  const tots = months.map((m) => sum(forPet(store.expenses.filter((x) => x.date.startsWith(m)))));
  const tmax = Math.max(1, ...tots);

  const R = 54;
  const CIRC = 2 * Math.PI * R;
  let cum = 0;

  const save = () => {
    if (!draft) return;
    const a = Math.round(draft.amt ?? 0);
    if (!(a > 0)) return setTried(true);
    const rec: Expense = { id: draft.id ?? uid('x'), date: draft.date || today(), cat: draft.cat, amt: a, petId: draft.petId, note: draft.note.trim(), receipt: draft.receipt };
    update((d) => {
      const i = d.expenses.findIndex((x) => x.id === rec.id);
      if (i >= 0) d.expenses[i] = { ...d.expenses[i], ...rec };
      else d.expenses.push(rec);
    });
    files.commit(afterSave);
    toast(draft.id ? '已更新這筆花費' : '已記一筆');
    setMonth(monthKey(rec.date));
    setDraft(null);
    setTried(false);
  };

  const exportCsv = (rows: Expense[], name: string) => {
    if (!rows.length) return toast('沒有可以匯出的花費');
    const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
    const lines = ['日期,分類,金額,寵物,備註', ...sorted.map((x) => [x.date, x.cat, x.amt, petName(store, x.petId), x.note].map(csvCell).join(','))];
    shareTextFile(safeFileName(name.replace(/\.csv$/, '')) + '.csv', '﻿' + lines.join('\r\n') + '\r\n', 'text/csv');
  };
  const scopeName = pf === 'all' ? '全部' : petName(store, pf);

  const saveRecurring = () => {
    if (!rdraft) return;
    const a = Math.round(rdraft.amt ?? 0);
    const day = Math.min(28, Math.max(1, Math.round(rdraft.day ?? 1)));
    if (!(a > 0)) return toast('請輸入大於 0 的金額');
    const td = today();
    let created: RecurringExpense | null = null;
    update((d) => {
      if (rdraft.id) {
        const r = d.recurring.find((x) => x.id === rdraft.id);
        if (r) Object.assign(r, { amt: a, cat: rdraft.cat, petId: rdraft.petId, note: rdraft.note.trim(), day });
      } else {
        // If this month's day hasn't come yet, start from last month so this month posts automatically on the day.
        const r: RecurringExpense = { id: uid('rc'), amt: a, cat: rdraft.cat, petId: rdraft.petId, note: rdraft.note.trim(), day, lastPosted: initialLastPosted(td, day) };
        d.recurring.push(r);
        created = r;
      }
    });
    toast(`已設定，每月 ${day} 日自動記一筆`);
    setOffer(created && recurringMissedThisMonth(td, day) ? created : null);
    setRdraft(null);
  };

  const postThisMonth = (r: RecurringExpense) => {
    // Use the month at the moment of pressing (the banner may have stayed open past midnight).
    const date = `${monthKey(today())}-${String(r.day).padStart(2, '0')}`;
    update((d) => {
      d.expenses.push({ id: uid('x'), date, cat: r.cat, amt: r.amt, petId: r.petId, note: r.note, recurringId: r.id });
    });
    setOffer(null);
    toast(`已記入 ${shortDate(date)} 的${r.cat}`);
  };

  const saveBudget = () => {
    const v = Math.round(budgetDraft ?? 0);
    if (!(v >= 500)) return setBudgetErr('預算至少 NT$500');
    update((d) => { d.budget = v; });
    setBudgetErr(null);
    setBudgetEdit(false);
    toast('已更新每月預算');
  };

  // ---------- year view (only computed while it is shown) ----------
  const yearStats = useMemo(() => {
    if (mode !== 'year') return null;
    const rows = store.expenses.filter((x) => x.date.startsWith(year) && (pf === 'all' || x.petId === pf));
    const knownPet = new Set(['all', ...store.pets.map((p) => p.id)]);
    return {
      rows,
      total: sum(rows),
      byCat: CATS.map(([c, col]) => ({ c, col, amt: sum(rows.filter((x) => catOf(x.cat) === c)) })).filter((x) => x.amt > 0),
      byPet: [{ id: 'all', name: '共同（全部寵物）' }, ...store.pets.map((p) => ({ id: p.id, name: p.name }))]
        .map((p) => ({ ...p, amt: sum(rows.filter((x) => x.petId === p.id)) }))
        .filter((x) => x.amt > 0),
      removed: sum(rows.filter((x) => !knownPet.has(x.petId))),
    };
  }, [mode, year, pf, store.expenses, store.pets]);
  const yearRows = yearStats?.rows ?? [];
  const yearTotal = yearStats?.total ?? 0;
  const yearByCat = yearStats?.byCat ?? [];
  const yearByPet = yearStats?.byPet ?? [];
  const removedPetAmt = yearStats?.removed ?? 0;

  return (
    <Screen title="花費記帳" subtitle="每月花費、預算與年度統計" scrollRef={scrollRef}>
      {draft ? null : (
        <Btn title="＋ 記一筆" onPress={() => openDraft({ id: null, amt: null, cat: '食物', petId: pf, date: month === cur ? today() : `${month}-01`, note: '' })} />
      )}
      {store.pets.length > 1 ? <PetChips value={pf} onChange={setPf} allowAll /> : null}
      <Segment options={[{ value: 'month', label: '每月' }, { value: 'year', label: '年度統計' }]} value={mode} onChange={setMode} />

      {draft ? (
        <Card style={{ gap: 12, borderColor: C.accent }}>
          <H2>{draft.id ? '編輯花費' : '記一筆花費'}</H2>
          <NumberField label="金額（NT$）" required integer value={draft.amt} placeholder="0" onChange={(v) => setDraft({ ...draft, amt: v })}
            error={tried && !((draft.amt ?? 0) > 0) ? '請輸入大於 0 的金額' : null} />
          <Label>分類</Label>
          <Choice options={CATS.map(([c]) => ({ value: c, label: c }))} value={draft.cat} onChange={(v) => setDraft({ ...draft, cat: v })} />
          <Label>寵物</Label>
          <Choice options={[{ value: 'all', label: '全部寵物（共同）' }, ...store.pets.map((p) => ({ value: p.id, label: p.name }))]} value={draft.petId} onChange={(v) => setDraft({ ...draft, petId: v })} />
          <DateField label="日期" value={draft.date} onChange={(v) => v && setDraft({ ...draft, date: v })} />
          <Field label="備註" value={draft.note} placeholder="例如：乾糧 7 kg" onChangeText={(t) => setDraft({ ...draft, note: t })} />
          <Label>收據照片（選填）</Label>
          <PhotoGrid
            photos={draft.receipt ? [draft.receipt] : []}
            max={1}
            onRemove={() => { files.removed(draft.receipt); setDraft({ ...draft, receipt: undefined }); }}
            onAdd={() => choosePhotos(1, (u) => { if (u[0]) { files.added(u[0]); setDraft({ ...draft, receipt: u[0] }); } })}
          />
          <Btn title="儲存" onPress={save} />
          <Row>
            <Btn small kind="outline" title="取消" style={{ flex: 1 }} onPress={() => closeDraft()} />
            {draft.id ? (
              <Btn small kind="danger" title="刪除" style={{ flex: 1 }} onPress={() => {
                const id = draft.id;
                const rec = store.expenses.find((x) => x.id === id);
                if (!rec) return;
                const drop = () => {
                  update((d) => { d.expenses = d.expenses.filter((x) => x.id !== id); });
                  files.discard();
                  setDraft(null);
                };
                if (rec.receipt) {
                  // The receipt photo is deleted too, so this one can't be undone: ask first.
                  confirm('刪除這筆花費？', '收據照片也會一起刪除，無法復原。', () => {
                    drop();
                    afterSave(() => deleteFile(rec.receipt));
                    toast('已刪除');
                  });
                } else {
                  drop();
                  toast('已刪除', { action: { label: '復原', onPress: () => update((d) => { if (!d.expenses.some((x) => x.id === rec.id)) d.expenses.push(rec); }) } });
                }
              }} />
            ) : null}
          </Row>
        </Card>
      ) : null}

      {mode === 'month' ? (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <Btn small kind="soft" title="‹ 上月" accessibilityLabel="上個月" onPress={() => setMonth(addMonthKey(month, -1))} />
            <H2>{monthLabel(month)}</H2>
            <Btn small kind="soft" title="下月 ›" accessibilityLabel="下個月" disabled={month >= cur} onPress={() => setMonth(addMonthKey(month, 1))} />
          </Row>

          <Card style={{ gap: 10 }}>
            <Label>{pf === 'all' ? '本月花費' : `${petName(store, pf)}本月花費`}</Label>
            <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 34, fontWeight: '700', color: C.ink }}>{money(total)}</Text>
            {pf === 'all' ? (
              <>
                <Progress pct={(total / budget) * 100} color={total > budget ? C.danger : C.green} height={10} />
                <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <Text style={{ color: total > budget ? C.danger : C.greenDark, fontWeight: '700', fontSize: 13 }}>
                    {total > budget ? `超出 ${money(total - budget)}` : `還剩 ${money(budget - total)}`}
                  </Text>
                  <Row gap={6}>
                    <Btn small kind="soft" title="−" style={{ minWidth: 44 }} accessibilityLabel="預算減少 500" onPress={() => update((d) => { d.budget = Math.max(500, (d.budget || 5000) - 500); })} />
                    <Pressable onPress={() => { setBudgetDraft(budget); setBudgetErr(null); setBudgetEdit(!budgetEdit); }} accessibilityRole="button" accessibilityLabel="修改每月預算" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
                      <Text style={{ fontWeight: '600', color: C.ink }}>預算 {money(budget)}</Text>
                    </Pressable>
                    <Btn small kind="soft" title="＋" style={{ minWidth: 44 }} accessibilityLabel="預算增加 500" onPress={() => update((d) => { d.budget = (d.budget || 5000) + 500; })} />
                  </Row>
                </Row>
                {budgetEdit ? (
                  <View style={{ gap: 8 }}>
                    <NumberField label="每月預算（NT$）" integer value={budgetDraft} onChange={setBudgetDraft} error={budgetErr} />
                    <Row>
                      <Btn small title="儲存預算" style={{ flex: 1 }} onPress={saveBudget} />
                      <Btn small kind="outline" title="取消" style={{ flex: 1 }} onPress={() => { setBudgetEdit(false); setBudgetErr(null); }} />
                    </Row>
                  </View>
                ) : null}
              </>
            ) : (
              <Sub>另有共同花費 {money(sharedMonth)}（全部寵物，例如飼料、保險）。全家預算請在「全部」查看。</Sub>
            )}
          </Card>

          {pf === 'all' ? (
            <Card style={{ gap: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>分類預算</Text>
                <Btn small kind="ghost" title={catEdit ? '完成' : '設定'} onPress={() => setCatEdit(!catEdit)} />
              </Row>
              {catEdit ? (
                <>
                  <Sub>不需要的分類留白即可。</Sub>
                  {CATS.map(([c]) => (
                    <NumberField key={c} label={c} integer unit="元／月" value={store.catBudgets[c] ?? null}
                      onChange={(v) => update((d) => { if (v && v > 0) d.catBudgets[c] = Math.round(v); else delete d.catBudgets[c]; })} />
                  ))}
                </>
              ) : Object.keys(store.catBudgets).length ? (
                Object.entries(store.catBudgets).map(([c, b]) => {
                  const spent = sum(inMonth.filter((x) => catOf(x.cat) === c));
                  const over = spent > b;
                  return (
                    <View key={c} style={{ gap: 4 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 14, color: C.ink }}>{c}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: over ? C.danger : C.sub }}>
                          {money(spent)} / {money(b)}{over ? ` · 超出 ${money(spent - b)}` : ''}
                        </Text>
                      </Row>
                      <Progress pct={(spent / b) * 100} color={over ? C.danger : catColor(c)} />
                    </View>
                  );
                })
              ) : (
                <Sub>可以替食物、醫療等分類各設一個每月上限，超過時會變紅色。</Sub>
              )}
            </Card>
          ) : null}

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
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, minHeight: 130 }}>
              {months.map((m, i) => (
                <Pressable key={m} onPress={() => setMonth(m)} style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: 44, justifyContent: 'flex-end' }} accessibilityRole="button" accessibilityLabel={`${monthLabel(m)} ${tots[i] ? money(tots[i]) : '沒有花費'}`}>
                  <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: C.sub }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{hundreds(tots[i])}</Text>
                  {tots[i] ? (
                    <View style={{ width: '100%', maxWidth: 30, height: Math.max(4, Math.round((tots[i] / tmax) * 80)), borderRadius: 8, backgroundColor: m === month ? C.accent : '#E5D8C6' }} />
                  ) : null}
                  <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: m === month ? C.ink : C.sub, fontWeight: m === month ? '700' : '400' }}>{Number(m.slice(5))}月</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Section title="明細">
            {inMonth.length ? (
              <ListCard>
                {inMonth.slice(0, shown).map((x) => (
                  <Pressable key={x.id} onPress={() => openDraft({ id: x.id, amt: x.amt, cat: x.cat, petId: x.petId, date: x.date, note: x.note, receipt: x.receipt })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 56, backgroundColor: draft?.id === x.id ? C.sand : undefined }} accessibilityRole="button" accessibilityLabel={`編輯 ${x.cat} ${money(x.amt)}`}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: catColor(x.cat) }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>{x.cat}{x.note ? ' · ' + x.note : ''}</Text>
                      <Sub>{shortDate(x.date)} · {petName(store, x.petId)}{x.recurringId ? ' · 固定支出' : ''}</Sub>
                    </View>
                    {x.receipt ? <Thumb uri={x.receipt} style={{ width: 36, height: 36, borderRadius: 8 }} /> : null}
                    <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>{money(x.amt)}</Text>
                  </Pressable>
                ))}
              </ListCard>
            ) : (
              <Empty text="這個月還沒有花費紀錄" />
            )}
            {inMonth.length > shown ? (
              <Btn small kind="soft" title={`顯示更多（還有 ${inMonth.length - shown} 筆）`} onPress={() => setShown(shown + PAGE)} />
            ) : null}
          </Section>

          <Section title="固定支出" action={rdraft ? undefined : { label: '＋ 新增固定支出', onPress: () => { setOffer(null); setRdraft({ id: null, amt: null, cat: '保險', petId: 'all', note: '', day: 1 }); } }}>
            <Sub>例如寵物保險月繳、固定保母費。每月到了指定日期會自動記一筆。</Sub>
            {offer ? (
              <Banner
                kind="info"
                text={`本月 ${offer.day} 日已經過了，這個月不會自動記。要現在補記本月的 ${money(offer.amt)} 嗎？`}
                action={{ label: '本月也記一筆', onPress: () => postThisMonth(offer) }}
              />
            ) : null}
            {rdraft ? (
              <Card style={{ gap: 12 }}>
                <NumberField label="金額（NT$）" required integer value={rdraft.amt} onChange={(v) => setRdraft({ ...rdraft, amt: v })} />
                <Label>分類</Label>
                <Choice options={CATS.map(([c]) => ({ value: c, label: c }))} value={rdraft.cat} onChange={(v) => setRdraft({ ...rdraft, cat: v })} />
                <Label>寵物</Label>
                <Choice options={[{ value: 'all', label: '全部寵物（共同）' }, ...store.pets.map((p) => ({ value: p.id, label: p.name }))]} value={rdraft.petId} onChange={(v) => setRdraft({ ...rdraft, petId: v })} />
                <NumberField label="每月幾日（1–28）" integer value={rdraft.day} onChange={(v) => setRdraft({ ...rdraft, day: v === null ? null : Math.min(28, Math.max(1, v)) })} />
                <Field label="備註" value={rdraft.note} placeholder="例如：寵物保險月繳" onChangeText={(t) => setRdraft({ ...rdraft, note: t })} />
                <Btn title="儲存" onPress={saveRecurring} />
                <Row>
                  <Btn small kind="outline" title="取消" style={{ flex: 1 }} onPress={() => setRdraft(null)} />
                  {rdraft.id ? (
                    <Btn small kind="danger" title="刪除" style={{ flex: 1 }} onPress={() => confirm('刪除這項固定支出？', '已經記下的花費會保留。', () => {
                      update((d) => { d.recurring = d.recurring.filter((x) => x.id !== rdraft.id); });
                      setRdraft(null);
                    })} />
                  ) : null}
                </Row>
              </Card>
            ) : null}
            {store.recurring.length ? (
              <ListCard>
                {store.recurring.map((r) => (
                  <Pressable key={r.id} onPress={() => setRdraft({ id: r.id, amt: r.amt, cat: r.cat, petId: r.petId, note: r.note, day: r.day })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 56 }} accessibilityRole="button">
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>{r.cat}{r.note ? ' · ' + r.note : ''}</Text>
                      <Sub>每月 {r.day} 日自動記一筆 · {petName(store, r.petId)}</Sub>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>{money(r.amt)}</Text>
                  </Pressable>
                ))}
              </ListCard>
            ) : null}
          </Section>

          {showExport ? (
            <Card style={{ gap: 8 }}>
              <Btn kind="outline" title={`匯出${monthLabel(month)}・${scopeName}（CSV）`} onPress={() => exportCsv(inMonth, `petpal-花費-${month}-${scopeName}.csv`)} />
              <Btn kind="outline" title="匯出全部花費（CSV）" onPress={() => exportCsv(store.expenses, 'petpal-花費-全部.csv')} />
              <Btn small kind="ghost" title="收起" onPress={() => setShowExport(false)} />
            </Card>
          ) : (
            <Btn kind="ghost" title="匯出 CSV（給試算表或保險理賠）…" onPress={() => setShowExport(true)} />
          )}
        </>
      ) : (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <Btn small kind="soft" title="‹ 上一年" onPress={() => setYear(String(Number(year) - 1))} />
            <H2>{year} 年</H2>
            <Btn small kind="soft" title="下一年 ›" disabled={year >= cur.slice(0, 4)} onPress={() => setYear(String(Number(year) + 1))} />
          </Row>
          <Card style={{ gap: 8 }}>
            <Label>{pf === 'all' ? '年度總花費' : `${petName(store, pf)}年度花費`}</Label>
            <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 34, fontWeight: '700', color: C.ink }}>{money(yearTotal)}</Text>
            <Sub>平均每月 {money(yearTotal / (year === cur.slice(0, 4) ? Number(cur.slice(5)) : 12))}</Sub>
          </Card>
          <Section title="依分類">
            {yearByCat.length ? (
              <ListCard>
                {yearByCat.map((x) => (
                  <Row key={x.c} style={{ padding: 14 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: x.col }} />
                    <Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{x.c}</Text>
                    <Sub>{Math.round((x.amt / yearTotal) * 100)}%</Sub>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink, minWidth: 90, textAlign: 'right' }}>{money(x.amt)}</Text>
                  </Row>
                ))}
              </ListCard>
            ) : <Empty text="這一年沒有花費紀錄" />}
          </Section>
          {pf === 'all' && yearByPet.length ? (
            <Section title="依寵物">
              <ListCard>
                {yearByPet.map((x) => (
                  <Row key={x.id} style={{ padding: 14 }}>
                    <Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{x.name}</Text>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>{money(x.amt)}</Text>
                  </Row>
                ))}
                {removedPetAmt ? (
                  <Row style={{ padding: 14 }}>
                    <Text style={{ flex: 1, fontSize: 14, color: C.sub }}>已移除的寵物</Text>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>{money(removedPetAmt)}</Text>
                  </Row>
                ) : null}
              </ListCard>
            </Section>
          ) : null}
          <Banner kind="info" text="申請寵物保險理賠時，可匯出年度明細，再附上收據照片。" />
          <Btn kind="outline" title={`匯出 ${year} 年・${scopeName}（CSV）`} onPress={() => exportCsv(yearRows, `petpal-花費-${year}年-${scopeName}.csv`)} />
        </>
      )}
    </Screen>
  );
}
