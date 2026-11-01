import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Card, Btn, Field, PetChips, Row, Badge, Banner, Sub } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { CONTENT } from '../../data/content';

interface Result { score: number; goods: string[]; bads: { text: string; sev: number }[] }

function analyze(text: string, kind: string | undefined): Result | null {
  const t = text.toLowerCase();
  if (!t.trim()) return null;
  const parts = t.split(/[、,，;；\n]/).map((x) => x.trim()).filter(Boolean);
  const has = (kw: readonly string[]) => kw.some((k) => t.includes(k.toLowerCase()));
  const goods: string[] = [];
  const bads: { text: string; sev: number }[] = [];
  let score = 70;
  if (parts[0] && CONTENT.meat.some((k) => parts[0].includes(k.toLowerCase()))) {
    goods.push(CONTENT.meatFirst);
    score += 10;
  }
  if (parts.slice(0, 3).some((p) => CONTENT.filler.some((k) => p.includes(k.toLowerCase())))) {
    bads.push({ text: CONTENT.fillerLabel, sev: 1 });
    score -= 8;
  }
  let taurine = false;
  for (const r of CONTENT.scanRules as readonly { label: string; good: boolean; sev: number; kw: readonly string[] }[]) {
    if (!has(r.kw)) continue;
    if (r.kw.includes('taurine')) taurine = true;
    if (r.good) {
      goods.push(r.label);
      score += 5;
    } else {
      bads.push({ text: r.label, sev: r.sev });
      score -= r.sev * 8;
    }
  }
  if (kind === 'cat' && !taurine) {
    bads.push({ text: '貓咪必需牛磺酸，成分表中沒看到', sev: 2 });
    score -= 10;
  }
  return { score: Math.max(0, Math.min(100, score)), goods, bads };
}

const sevStyle = (sev: number) => (sev >= 3 ? { bg: C.danger, fg: '#fff' } : sev === 2 ? { bg: '#FBE0CF', fg: '#B4561F' } : { bg: C.yellowBg, fg: C.yellowInk });

export default function ScanScreen(_: { params: any }) {
  const { petId, setPetId } = useStore();
  const pet = usePet();
  const [text, setText] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const run = (t: string) => {
    setText(t);
    setRes(analyze(t, pet?.kind));
  };
  const scoreBg = res ? (res.score >= 75 ? C.green : res.score >= 50 ? '#D08A2E' : C.danger) : C.green;

  return (
    <Screen title="成分掃描" subtitle="看懂飼料標籤">
      <PetChips value={petId} onChange={(id) => { setPetId(id); setRes(null); }} />
      <Banner kind="info" text="可用手機相機的「原況文字」或「Google 智慧鏡頭」複製包裝上的成分文字，再貼到下方。" />
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Btn small kind="soft" title="範例：優質乾糧" onPress={() => run(CONTENT.sampleGood)} />
        <Btn small kind="soft" title="範例：有爭議成分" onPress={() => run(CONTENT.sampleBad)} />
      </Row>
      <Field multiline value={text} onChangeText={(t) => { setText(t); setRes(null); }} placeholder="貼上包裝上的成分表，用頓號或逗號分隔" label="成分表" />
      <Btn title="分析成分" onPress={() => setRes(analyze(text, pet?.kind))} disabled={!text.trim()} />
      {res ? (
        <Card style={{ gap: 12 }}>
          <Row gap={14}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: scoreBg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>{res.score}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>評分</Text>
              {pet ? <Sub>依{pet.name}的物種判斷</Sub> : null}
            </View>
          </Row>
          {res.goods.map((g) => (
            <Row key={g} gap={8}><Badge text="加分" bg={C.greenBg} fg={C.greenDark} /><Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{g}</Text></Row>
          ))}
          {res.bads.map((b) => {
            const st = sevStyle(b.sev);
            return <Row key={b.text} gap={8}><Badge text="注意" bg={st.bg} fg={st.fg} /><Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{b.text}</Text></Row>;
          })}
          {!res.bads.length ? <Text style={{ fontSize: 14, color: C.greenDark }}>沒有發現需要注意的成分</Text> : null}
          <Sub>依關鍵字比對，僅供參考。換糧請先諮詢獸醫。</Sub>
        </Card>
      ) : null}
    </Screen>
  );
}
