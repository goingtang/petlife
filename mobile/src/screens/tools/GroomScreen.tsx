import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Screen, Card, Btn, Field, DateField, NumberField, Stepper, Progress, PetChips, Row, Section, Empty, H2, Sub, confirm,
} from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { groomDue, groomDueText, mapsSearch, money } from '../../lib/domain';
import { daysBetween, shortDate, today } from '../../lib/date';
import { openUrl } from '../../lib/files';
import { useBackHandler } from '../../nav';
import { defaultGroom, uid } from '../../lib/seed';
import type { GroomTask } from '../../lib/types';

interface Draft { id: string | null; name: string; every: number; last: string }
interface Undo { id: string; prevLast: string; at: number; expenseId?: string }

export default function GroomScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId, day } = useStore();
  const pet = usePet();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [orig, setOrig] = useState('');
  const [undo, setUndo] = useState<Undo | null>(null);
  const [costFor, setCostFor] = useState<string | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);
  useEffect(() => {
    setDraft(null);
    setCostFor(null);
  }, [petId]);

  const dirty = !!draft && JSON.stringify(draft) !== orig;
  const close = () => {
    if (dirty) confirm('放棄未儲存的內容？', '這個項目的修改不會儲存。', () => setDraft(null), '放棄');
    else setDraft(null);
  };
  useBackHandler(draft ? () => { close(); return true; } : null);
  const open = (d: Draft) => {
    setDraft(d);
    setOrig(JSON.stringify(d));
    setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 50);
  };

  if (!pet)
    return (
      <Screen title="美容洗澡">
        <Empty text="請先新增寵物" />
      </Screen>
    );

  const items = store.groom.filter((g) => g.petId === pet.id).sort((a, b) => groomDue(a, day) - groomDue(b, day));

  const done = (g: GroomTask) => {
    const td = today();
    update((d) => {
      const x = d.groom.find((y) => y.id === g.id);
      if (!x) return;
      if (x.last && x.last !== td) x.history = [...(x.history || []), x.last].slice(-30);
      x.last = td;
    });
    setUndo({ id: g.id, prevLast: g.last, at: Date.now() });
    // Offer (collapsed) to log a cost — only if the user says it was done at a shop.
    setCostFor(g.id);
    setCostOpen(false);
    setCost(null);
    toast(`已完成「${g.name}」`);
  };
  const doUndo = () => {
    if (!undo) return;
    update((d) => {
      const x = d.groom.find((y) => y.id === undo.id);
      if (!x) return;
      x.last = undo.prevLast;
      if (x.history.length && x.history[x.history.length - 1] === undo.prevLast) x.history = x.history.slice(0, -1);
      // A grooming cost logged with this completion is undone too.
      if (undo.expenseId) d.expenses = d.expenses.filter((e) => e.id !== undo.expenseId);
    });
    setUndo(null);
    setCostFor(null);
    toast(undo.expenseId ? '已復原，剛記的花費也一併刪除' : '已復原');
  };

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    update((d) => {
      const rec = { id: draft.id ?? uid('g'), petId: pet.id, name: draft.name.trim(), every: Math.max(1, Math.round(draft.every)), last: draft.last || today() };
      const i = d.groom.findIndex((y) => y.id === rec.id);
      if (i >= 0) {
        const prev = d.groom[i];
        // Changing "上次完成" by hand keeps the previous date in the history.
        const history = prev.last && prev.last !== rec.last && !prev.history.includes(prev.last) ? [...prev.history, prev.last].sort().slice(-30) : prev.history;
        d.groom[i] = { ...prev, ...rec, history };
      } else d.groom.push({ ...rec, history: [] });
    });
    setDraft(null);
    toast('已儲存');
  };

  return (
    <Screen title="美容洗澡" subtitle="洗澡、指甲、刷牙的週期，到期當天早上提醒" scrollRef={scrollRef}>
      <PetChips value={petId} onChange={setPetId} />

      {draft ? (
        <Card style={{ gap: 12, borderColor: C.accent }}>
          <H2>{draft.id ? '編輯項目' : '新增項目'}</H2>
          <Field label="項目" required value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} placeholder="例如：洗澡" />
          <Stepper label="每幾天一次" value={draft.every} onChange={(v) => setDraft({ ...draft, every: v })} min={1} unit="天" />
          <DateField label="上次完成" value={draft.last} onChange={(v) => v && setDraft({ ...draft, last: v })} />
          <Btn title="儲存" onPress={save} disabled={!draft.name.trim()} />
          <Row>
            <Btn small kind="outline" title="取消" style={{ flex: 1 }} onPress={close} />
            {draft.id ? (
              <Btn small kind="danger" title="刪除" style={{ flex: 1 }} onPress={() => confirm(`刪除「${draft.name}」？`, '這個項目和它的完成紀錄都會刪除，無法復原。', () => {
                update((d) => { d.groom = d.groom.filter((y) => y.id !== draft.id); });
                setDraft(null);
              })} />
            ) : null}
          </Row>
        </Card>
      ) : null}

      <Section title={`${pet.name}的項目`} action={draft ? undefined : { label: '＋ 新增項目', onPress: () => open({ id: null, name: '', every: 7, last: today() }) }}>
        {items.map((g) => {
          const n = groomDue(g, day);
          const color = n < 0 ? C.danger : n <= 1 ? '#B5721F' : C.greenDark;
          const el = Math.max(0, daysBetween(g.last, day));
          const isOpen = expanded === g.id;
          return (
            <Card key={g.id} style={{ gap: 8 }}>
              <Row>
                <Pressable style={{ flex: 1, gap: 4 }} onPress={() => open({ id: g.id, name: g.name, every: g.every, last: g.last })} accessibilityRole="button" accessibilityLabel={`編輯 ${g.name}`}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{g.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color }}>{groomDueText(g, day)}</Text>
                  </Row>
                  <Progress pct={(el / g.every) * 100} color={color} height={6} />
                  <Sub>每 {g.every} 天 · {g.history?.length ? `上次 ${shortDate(g.last)}` : `從 ${shortDate(g.last)} 開始計算`}</Sub>
                </Pressable>
                <Btn small title={g.last === day ? '今天已完成' : '完成'} disabled={g.last === day} onPress={() => done(g)} style={{ backgroundColor: g.last === day ? C.sand : C.greenDark }} textStyle={{ color: g.last === day ? C.sub : '#fff' }} />
              </Row>
              {undo?.id === g.id ? <Btn small kind="ghost" title="復原剛才的完成" onPress={doUndo} style={{ alignSelf: 'flex-start' }} /> : null}
              {costFor === g.id && !costOpen ? (
                <Btn small kind="ghost" title="在店家完成？記一筆美容花費" onPress={() => setCostOpen(true)} style={{ alignSelf: 'flex-start' }} />
              ) : null}
              {costFor === g.id && costOpen ? (
                <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: C.sand }}>
                  <Text style={{ fontSize: 14, color: C.ink }}>在店家完成的花費</Text>
                  <NumberField integer unit="元" value={cost} onChange={setCost} placeholder="金額" />
                  <Row gap={8}>
                    <Btn small title="記一筆" disabled={!cost} onPress={() => {
                      const id = uid('x');
                      update((d) => { d.expenses.push({ id, date: today(), cat: '美容', amt: Math.round(cost ?? 0), petId: pet.id, note: g.name }); });
                      setUndo((u) => (u && u.id === g.id ? { ...u, expenseId: id } : u));
                      setCostFor(null);
                      toast(`已記一筆 ${money(cost ?? 0)}`);
                    }} />
                    <Btn small kind="ghost" title="不用" onPress={() => setCostFor(null)} />
                  </Row>
                </View>
              ) : null}
              {g.history?.length ? (
                <Btn small kind="ghost" title={isOpen ? '收合紀錄' : `過去紀錄（${g.history.length}）`} onPress={() => setExpanded(isOpen ? null : g.id)} style={{ alignSelf: 'flex-start' }} />
              ) : null}
              {isOpen ? <Sub>{[...g.history].reverse().map((h) => h.replace(/-/g, '/')).join('、')}</Sub> : null}
            </Card>
          );
        })}
        {!items.length ? (
          <Card style={{ gap: 10, alignItems: 'flex-start' }}>
            <Sub>還沒有美容項目。可以套用依{pet.name}種類建議的項目，從今天開始計算。</Sub>
            <Btn small title="套用建議項目" onPress={() => { update((d) => { d.groom.push(...defaultGroom(pet)); }); toast('已加入建議項目'); }} />
          </Card>
        ) : null}
      </Section>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.purpleBg, borderWidth: 0 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>找附近寵物美容</Text>
          <Sub>開啟 Google 地圖搜尋</Sub>
        </View>
        <Btn small kind="dark" title="搜尋" onPress={() => openUrl(mapsSearch('寵物美容'))} />
      </Card>
      <Sub>夏天潮濕悶熱，記得洗澡後吹乾，外出回家檢查有沒有壁蝨。</Sub>
    </Screen>
  );
}
