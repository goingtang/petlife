import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Screen, Card, Btn, Field, NumberField, PetChips, Row, Section, Empty, Badge, Banner, Sub, Label, H2, confirm,
} from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { today } from '../../lib/date';
import { uid } from '../../lib/seed';
import { CONTENT } from '../../data/content';
import { mentionsGrape } from '../../lib/life';
import { KIND_LABEL } from '../../lib/domain';
import type { PetKind } from '../../lib/types';

type Species = PetKind;

interface Rule {
  label: string;
  good: boolean;
  /** severity 1–3 per species; 0 = rule does not apply */
  sev: Partial<Record<Species, number>> & { def: number };
  kw: string[];
  /** words that cancel a match, e.g. 天然色素 */
  not?: string[];
  /** custom matcher on the whole text, used instead of kw */
  test?: (text: string) => boolean;
}

const ALL = (n: number) => ({ def: n });
const RULES: Rule[] = [
  { label: '含蔥蒜類，對犬貓有毒', good: false, sev: { def: 3, rabbit: 2, bird: 2 }, kw: ['洋蔥', '洋葱', '大蒜', '蒜粉', '蔥', 'onion', 'garlic'] },
  { label: '含木糖醇（狗吃少量就會低血糖）', good: false, sev: { def: 2, dog: 3 }, kw: ['木糖醇', 'xylitol'] },
  // 葡萄糖 (glucose) and 葡萄柚籽萃取 (grapefruit seed extract, a preservative) are not grapes.
  { label: '含葡萄或葡萄乾，可能造成腎衰竭', good: false, sev: ALL(3), kw: [], test: mentionsGrape },
  { label: '含可可或巧克力', good: false, sev: ALL(3), kw: ['可可', '巧克力', 'cocoa', 'chocolate'] },
  { label: '含丙二醇（貓不宜）', good: false, sev: { def: 1, cat: 3 }, kw: ['丙二醇', 'propylene glycol'] },
  { label: '人工防腐劑 BHA／BHT／乙氧基喹', good: false, sev: ALL(2), kw: ['bha', 'bht', '乙氧基喹', 'ethoxyquin'] },
  { label: '人工色素', good: false, sev: ALL(1), kw: ['色素', 'artificial color', 'red 40', 'yellow 5', '焦糖色'], not: ['天然色素', '天然 色素'] },
  { label: '卡拉膠', good: false, sev: ALL(1), kw: ['卡拉膠', '鹿角菜膠', 'carrageenan'] },
  { label: '額外添加鹽或味精', good: false, sev: ALL(1), kw: ['食鹽', '鹽', '味精', '麩胺酸鈉', 'salt', 'msg'], not: ['鹽酸', '氯化鉀'] },
  { label: '來源不明的副產品或動物性油脂', good: false, sev: ALL(1), kw: ['副產品', '副产品', 'by-product', 'byproduct', '動物性油脂', 'animal fat'] },
  { label: '添加糖', good: false, sev: { def: 1, rabbit: 2, bird: 2 }, kw: ['蔗糖', '砂糖', '糖漿', '果糖', 'sugar', 'syrup'], not: ['葡萄糖胺'] },
  { label: '含牛磺酸', good: true, sev: { def: 1, rabbit: 0, bird: 0 }, kw: ['牛磺酸', 'taurine'] },
  { label: '含魚油或 Omega-3', good: true, sev: { def: 1, rabbit: 0 }, kw: ['魚油', '鮭魚油', 'omega', '亞麻仁', '亞麻籽', 'fish oil', 'salmon oil', 'flaxseed'] },
];
const MEAT = ['雞肉', '去骨雞', '雞', '牛肉', '羊肉', '鴨肉', '鴨', '魚', '鮭', '鮪', '火雞', 'chicken', 'beef', 'lamb', 'duck', 'salmon', 'fish', 'turkey', '鹿肉', '豬肉'];
const NOT_MEAT = ['雞蛋', '雞精', '魚油', '鮭魚油', '雞油', '雞脂', 'fish oil', 'salmon oil', 'chicken fat', 'egg', 'fish meal oil'];
const FILLER = ['玉米', '小麥', 'corn', 'wheat'];
const HAY = ['牧草', '提摩西', '苜蓿', 'timothy', 'alfalfa', 'hay'];

interface Result { score: number | null; goods: string[]; bads: { text: string; sev: number }[]; notes: string[] }

function analyze(text: string, sp: Species): Result {
  const t = text.toLowerCase();
  const parts = t.split(/[、,，;；\n]/).map((x) => x.trim()).filter(Boolean);
  const goods: string[] = [];
  const bads: { text: string; sev: number }[] = [];
  const notes: string[] = [];
  let score = 70;
  let matched = 0;
  const hasWord = (p: string, words: string[], not: string[] = []) => {
    let s = p;
    for (const n of not) s = s.split(n.toLowerCase()).join(' ');
    return words.some((w) => s.includes(w.toLowerCase()));
  };

  // Meat-first and grain rules are for dogs and cats only; reptiles, fish, rabbits and birds eat very differently.
  if (sp === 'dog' || sp === 'cat') {
    if (parts[0] && hasWord(parts[0], MEAT, NOT_MEAT)) {
      goods.push('第一項是肉類');
      score += 10;
      matched++;
    }
    if (parts.slice(0, 3).some((p) => hasWord(p, FILLER))) {
      bads.push({ text: '前三項有玉米或小麥', sev: 1 });
      score -= 8;
      matched++;
    }
  }
  if (sp === 'rabbit') {
    if (parts[0] && hasWord(parts[0], HAY)) {
      goods.push('第一項是牧草');
      score += 10;
      matched++;
    } else if (parts.length) {
      bads.push({ text: '第一項不是牧草，兔子主食應以牧草為主', sev: 1 });
      score -= 8;
      matched++;
    }
  }
  if (parts.some((p) => hasWord(p, MEAT, NOT_MEAT) || hasWord(p, FILLER) || hasWord(p, HAY))) matched++;

  for (const r of RULES) {
    const sev = r.sev[sp] ?? r.sev.def;
    if (!sev) continue;
    if (r.test ? !r.test(t) : !parts.some((p) => hasWord(p, r.kw, r.not))) continue;
    matched++;
    if (r.good) {
      goods.push(r.label);
      score += 5;
    } else {
      bads.push({ text: r.label, sev });
      score -= sev * 8;
    }
  }
  if (sp === 'cat' && !parts.some((p) => hasWord(p, ['牛磺酸', 'taurine']))) {
    bads.push({ text: '貓咪必需牛磺酸，成分表中沒看到', sev: 2 });
    score -= 10;
  }
  if (sp === 'bird') notes.push('鳥類飼料差異很大，以上只檢查常見有害成分，不做肉類或穀物評分。');
  if (sp === 'other') notes.push('這種寵物的飲食差異很大，以上只檢查常見有害成分，不做肉類或穀物評分。');
  if (!matched) return { score: null, goods: [], bads: [], notes };
  return { score: Math.max(0, Math.min(100, score)), goods, bads, notes };
}

const SEV_STYLE = (sev: number) => (sev >= 3 ? { bg: C.danger, fg: '#fff' } : sev === 2 ? { bg: '#FBE0CF', fg: '#B4561F' } : { bg: C.yellowBg, fg: C.yellowInk });
const scoreColor = (s: number) => (s >= 75 ? C.green : s >= 50 ? '#C8862A' : C.danger);

export default function ScanScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const sp: Species = pet?.kind ?? 'dog';
  const [text, setText] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const [name, setName] = useState('');
  const [protein, setProtein] = useState<number | null>(null);
  const [moisture, setMoisture] = useState<number | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  // Guaranteed analysis of the product being analysed (saved with it) — separate from the free calculator below.
  const [pProtein, setPProtein] = useState<number | null>(null);
  const [pMoisture, setPMoisture] = useState<number | null>(null);

  const newResult = (r: Result | null) => {
    setRes(r);
    setPProtein(null);
    setPMoisture(null);
  };
  useEffect(() => newResult(null), [petId]);

  const dmOf = (p: number | null, m: number | null) =>
    p !== null && m !== null && m < 100 && p + m <= 100 ? Math.round((p / (100 - m)) * 1000) / 10 : null;
  const badSum = (p: number | null, m: number | null) => p !== null && m !== null && p + m > 100;
  const dm = dmOf(protein, moisture);
  const pdm = dmOf(pProtein, pMoisture);
  const dmGoal = sp === 'cat' ? 26 : sp === 'dog' ? 18 : null;

  const save = () => {
    if (!res || res.score === null) return;
    if (!name.trim()) return toast('請輸入產品名稱');
    if (badSum(pProtein, pMoisture)) return toast('粗蛋白加水分不能超過 100%');
    const label = KIND_LABEL[sp];
    const full = name.includes(`（${label}）`) ? name.trim() : `${name.trim()}（${label}）`;
    update((d) => {
      d.scans.unshift({ id: uid('sc'), name: full, date: today(), score: res.score as number, protein: pdm ?? undefined, text: text.slice(0, 500) });
    });
    setName('');
    setPProtein(null);
    setPMoisture(null);
    toast('已儲存，可以和其他產品比較');
  };

  const compare = store.scans.filter((x) => pick.includes(x.id));

  return (
    <Screen title="成分掃描" subtitle="貼上飼料成分表，依關鍵字評分">
      <PetChips value={petId} onChange={setPetId} />
      <Sub>可用手機相機的「原況文字」或「Google 智慧鏡頭」複製包裝上的成分文字，再貼到下方。</Sub>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Btn small kind="soft" title="範例：優質乾糧" onPress={() => { setText(CONTENT.sampleGood); newResult(analyze(CONTENT.sampleGood, sp)); }} />
        <Btn small kind="soft" title="範例：有爭議成分" onPress={() => { setText(CONTENT.sampleBad); newResult(analyze(CONTENT.sampleBad, sp)); }} />
      </Row>
      <Field label="成分表" value={text} onChangeText={(t) => { setText(t); newResult(null); }} multiline placeholder="例如：去骨雞肉、糙米、豌豆、鮭魚油、牛磺酸…" />
      <Btn title="分析成分" disabled={!text.trim()} onPress={() => newResult(analyze(text, sp))} />

      {res ? (
        <Card style={{ gap: 12 }}>
          {res.score === null ? (
            <Banner kind="warn" text="無法判斷，請確認貼上的是成分表（以頓號或逗號分隔的原料清單）。" />
          ) : (
            <>
              <Row gap={14}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: scoreColor(res.score), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>{res.score}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>評分</Text>
                  <Sub>依{pet ? pet.name + '的種類' : '狗'}的規則計算</Sub>
                </View>
              </Row>
              {res.goods.map((g) => (
                <Row key={g} gap={8}><Badge text="加分" bg={C.greenBg} fg={C.greenDark} /><Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{g}</Text></Row>
              ))}
              {res.bads.map((b) => {
                const st = SEV_STYLE(b.sev);
                return <Row key={b.text} gap={8}><Badge text="注意" bg={st.bg} fg={st.fg} /><Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{b.text}</Text></Row>;
              })}
              {!res.bads.length ? <Text style={{ fontSize: 14, color: C.greenDark }}>沒有發現需要注意的成分</Text> : null}
              <Field label="產品名稱（儲存用）" value={name} onChangeText={setName} placeholder="例如：某品牌雞肉成犬糧" />
              <Label>這個產品的保證分析值（選填，用來比較蛋白質）</Label>
              <Row gap={10}>
                <View style={{ flex: 1 }}><NumberField label="粗蛋白" unit="%" value={pProtein} onChange={setPProtein} /></View>
                <View style={{ flex: 1 }}><NumberField label="水分" unit="%" value={pMoisture} onChange={setPMoisture} error={badSum(pProtein, pMoisture) ? '兩者相加不能超過 100%' : null} /></View>
              </Row>
              {pdm !== null ? <Sub>乾物質蛋白質 {pdm}%</Sub> : null}
              <Btn small kind="outline" title="儲存結果" onPress={save} />
            </>
          )}
          {res.notes.map((n) => <Sub key={n}>{n}</Sub>)}
          <Sub>依關鍵字比對，僅供參考。換糧請先諮詢獸醫。</Sub>
        </Card>
      ) : null}

      <Section title="乾物質蛋白質">
        <Card style={{ gap: 10 }}>
          <Sub>包裝的「保證分析值」是含水分的數字。換算成乾物質，乾糧和罐頭才能互相比較。</Sub>
          <Row gap={10}>
            <View style={{ flex: 1 }}><NumberField label="粗蛋白" unit="%" value={protein} onChange={setProtein} /></View>
            <View style={{ flex: 1 }}><NumberField label="水分" unit="%" value={moisture} onChange={setMoisture} error={badSum(protein, moisture) ? '兩者相加不能超過 100%' : null} /></View>
          </Row>
          {dm !== null ? (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.ink }}>乾物質蛋白質 {dm}%</Text>
              {dmGoal ? (
                <Text style={{ fontSize: 13, color: dm >= dmGoal ? C.greenDark : C.danger }}>
                  {sp === 'cat' ? '成貓' : '成犬'}建議至少 {dmGoal}%（AAFCO 最低標準）：{dm >= dmGoal ? '符合' : '偏低'}
                </Text>
              ) : <Sub>兔子與鳥類的蛋白質需求差異大，請依獸醫建議。</Sub>}
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="已儲存的產品">
        {store.scans.length ? (
          <>
            <Sub>選兩個產品可以並排比較。名稱後面括號是評分時用的寵物種類，不同種類的分數不能直接比較。</Sub>
            {store.scans.map((x) => {
              const on = pick.includes(x.id);
              return (
                <Card key={x.id} onPress={() => setPick(on ? pick.filter((y) => y !== x.id) : [...pick.slice(-1), x.id])} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: on ? C.ink : C.line }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: scoreColor(x.score), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{x.score}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{x.name}</Text>
                    <Sub>{x.date.replace(/-/g, '/')}{x.protein ? ` · 乾物質蛋白質 ${x.protein}%` : ''}</Sub>
                  </View>
                  <Btn small kind="ghost" title="刪除" textStyle={{ color: C.danger }} onPress={() => confirm(`刪除「${x.name}」？`, '刪除後無法復原。', () => {
                    update((d) => { d.scans = d.scans.filter((y) => y.id !== x.id); });
                    setPick(pick.filter((y) => y !== x.id));
                  })} />
                </Card>
              );
            })}
            {compare.length === 2 ? (
              <Card style={{ gap: 8 }}>
                <H2>比較</H2>
                <Row>
                  <Label style={{ width: 90 }}>項目</Label>
                  {compare.map((x) => <Text key={x.id} style={{ flex: 1, fontWeight: '700', color: C.ink }} numberOfLines={2}>{x.name}</Text>)}
                </Row>
                <Row>
                  <Label style={{ width: 90 }}>評分</Label>
                  {compare.map((x) => <Text key={x.id} style={{ flex: 1, fontSize: 18, fontWeight: '700', color: scoreColor(x.score) }}>{x.score}</Text>)}
                </Row>
                <Row>
                  <Label style={{ width: 90 }}>乾物質蛋白質</Label>
                  {compare.map((x) => <Text key={x.id} style={{ flex: 1, color: C.ink }}>{x.protein ? x.protein + '%' : '—'}</Text>)}
                </Row>
                <Pressable onPress={() => setPick([])} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ color: C.accent, fontWeight: '700' }}>清除選擇</Text>
                </Pressable>
              </Card>
            ) : null}
          </>
        ) : <Empty text="分析後輸入產品名稱即可儲存" />}
      </Section>
    </Screen>
  );
}
