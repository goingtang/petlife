import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen, Card, Btn, Chip, ChipRow, Field, Banner, PetChips, Section, Sub, P, Label, Row, Segment } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useNav } from '../../nav';
import { KIND_LABEL, SEX_LABEL, entriesFor, entrySummary, medActiveOn, primaryVetPhone } from '../../lib/domain';
import { addDays, ageText, hm, today } from '../../lib/date';
import { callPhone, copyText, openUrl } from '../../lib/files';
import { uid } from '../../lib/seed';

const QUICK = ['嘔吐', '腹瀉', '不吃東西', '搔癢', '跛腳', '誤食東西', '沒精神', '呼吸急促', '抽搐', '無法排尿', '出血'];

/** Signs that need a vet now. Matched in the description and quick chips, ignoring negated mentions. */
const RED_FLAGS = [
  '抽搐', '痙攣', '呼吸困難', '呼吸急促', '喘不過氣', '無法排尿', '尿不出', '頻尿', '一直蹲貓砂', '大量出血', '出血不止', '出血',
  '巧克力', '葡萄', '木糖醇', '百合', '老鼠藥', '蟑螂藥', '洋蔥', '普拿疼', '乙醯胺酚', '布洛芬', '誤食',
  '吞異物', '吞下', '車禍', '骨折', '昏倒', '昏迷', '叫不醒', '腹部腫脹', '肚子脹', '中暑', '持續嘔吐', '吐血', '血便',
];
const NEGATIONS = ['沒有', '沒', '無', '不'];

/** Red-flag terms present in the text, skipping ones preceded (within 3 characters) by a negation. */
export function findRedFlags(text: string): string[] {
  const hits = new Set<string>();
  for (const term of RED_FLAGS) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(term, from);
      if (i < 0) break;
      const before = text.slice(Math.max(0, i - 3), i);
      if (!NEGATIONS.some((n) => before.includes(n))) {
        // Report the longest matching term only (e.g. "出血不止" rather than also "出血").
        if (![...hits].some((h) => h.includes(term))) hits.add(term);
        for (const h of [...hits]) if (term.includes(h) && term !== h) hits.delete(h);
      }
      from = i + term.length;
    }
  }
  return [...hits];
}

const ONSET = ['今天', '1–3 天', '超過 3 天', '反覆發生'] as const;
const FREQ = ['一次', '2–3 次', '很多次'] as const;
const INTAKE = ['正常', '變少', '不吃不喝'] as const;
const OUTPUT = ['正常', '異常'] as const;

const PROVIDERS = [
  { k: 'chatgpt', name: 'ChatGPT' },
  { k: 'claude', name: 'Claude' },
  { k: 'gemini', name: 'Gemini' },
  { k: 'perplexity', name: 'Perplexity' },
  { k: 'copilot', name: 'Copilot' },
] as const;
type ProviderKey = (typeof PROVIDERS)[number]['k'];

function providerUrl(k: ProviderKey, prompt: string): string {
  const q = encodeURIComponent(prompt);
  switch (k) {
    case 'chatgpt': return `https://chatgpt.com/?q=${q}`;
    case 'claude': return `https://claude.ai/new?q=${q}`;
    case 'perplexity': return `https://www.perplexity.ai/search?q=${q}`;
    case 'copilot': return `https://copilot.microsoft.com/?q=${q}`;
    default: return 'https://gemini.google.com/app';
  }
}

export default function AiScreen(_: { params: any }) {
  const { store, petId, setPetId, toast, update } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [text, setText] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [onset, setOnset] = useState<string | null>(null);
  const [freq, setFreq] = useState<string | null>(null);
  const [intake, setIntake] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderKey>('chatgpt');
  const [showPrompt, setShowPrompt] = useState(false);
  const [geminiCopied, setGeminiCopied] = useState(false);

  // A new pet means a new problem: start over.
  useEffect(() => {
    setText('');
    setChips([]);
    setOnset(null);
    setFreq(null);
    setIntake(null);
    setOutput(null);
    setGeminiCopied(false);
  }, [petId]);

  const symptoms = [chips.join('、'), text.trim()].filter(Boolean).join('；');
  const flags = useMemo(() => findRedFlags(symptoms + (intake === '不吃不喝' ? '；不吃不喝' : '')), [symptoms, intake]);
  const details = [
    onset ? `發生多久：${onset}` : null,
    freq ? `頻率：${freq}` : null,
    intake ? `吃喝：${intake}` : null,
    output ? `排尿排便：${output}` : null,
  ].filter(Boolean) as string[];
  const vet = pet ? primaryVetPhone(store, pet.id) : null;

  const prompt = useMemo(() => {
    if (!pet) return '';
    const td = today();
    const cutoff = addDays(td, -30);
    const growth = entriesFor(store, pet.id, 'growth')[0];
    const meds = store.meds.filter((m) => m.petId === pet.id && medActiveOn(m, td)).map((m) => `${m.name}${m.dose ? ' ' + m.dose : ''}`);
    const health = entriesFor(store, pet.id, 'health')
      .filter((e) => e.at.slice(0, 10) >= cutoff)
      .slice(0, 5)
      .map((e) => `${e.at.slice(0, 10)} ${entrySummary(e)}`);
    return [
      '你是協助新手飼主的獸醫分診助理。請用繁體中文回答。',
      '',
      '【寵物資料】',
      `名字：${pet.name}`,
      `種類：${KIND_LABEL[pet.kind]}${pet.breed ? '（' + pet.breed + '）' : ''}`,
      `年齡：${ageText(pet.birthday) || '不詳'}`,
      `性別：${SEX_LABEL[pet.sex]}${pet.neutered ? '，已結紮' : ''}`,
      `體重：${growth ? `${growth.v.weight} kg（${growth.at.slice(0, 10)} 記錄）` : '不詳'}`,
      `過敏：${pet.allergy || '無'}`,
      `目前用藥：${meds.join('、') || '無'}`,
      `近 30 天健康紀錄：${health.join('；') || '無'}`,
      '',
      '【目前狀況】',
      symptoms || '（尚未描述）',
      ...details,
      '',
      '請先用一行標示緊急程度：立即就醫／24小時內就醫／居家觀察。',
      '接著用最多 4 點說明：可能原因、在家可以觀察什麼、什麼情況要馬上就醫。',
      '請提醒這不是診斷。',
    ].join('\n');
  }, [pet, store, symptoms, details.join('|')]);

  const toggleChip = (c: string) => setChips((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const ask = async () => {
    if (!symptoms) {
      toast('請先描述症狀');
      return;
    }
    await copyText(prompt);
    if (provider === 'gemini') {
      setGeminiCopied(true);
      toast('提問已複製');
    } else toast('提問已複製');
    openUrl(providerUrl(provider, prompt));
  };

  const saveRecord = () => {
    if (!pet || !symptoms) return;
    const note = [text.trim(), ...details].filter(Boolean).join('；');
    update((d) => {
      d.entries.push({
        id: uid('e'),
        petId: pet.id,
        form: 'health',
        at: `${today()}T${hm()}`,
        who: d.me,
        v: { hType: 'symptom', signs: chips.length ? chips : ['其他'], severity: flags.length ? 'severe' : 'moderate', note },
      });
    });
    toast('已存成健康紀錄');
  };

  if (!pet) {
    return (
      <Screen title="AI 健康助理" subtitle="描述症狀，先判斷急不急">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

  const pick = (opts: readonly string[], v: string | null, set: (x: string | null) => void) => (
    <ChipRow wrap>
      {opts.map((o) => (
        <Chip key={o} label={o} on={v === o} onPress={() => set(v === o ? null : o)} />
      ))}
    </ChipRow>
  );

  return (
    <Screen title="AI 健康助理" subtitle="描述症狀，先判斷急不急">
      <PetChips value={petId} onChange={setPetId} />

      <Section title={`${pet.name}哪裡不舒服？`}>
        <ChipRow wrap>
          {QUICK.map((c) => (
            <Chip key={c} label={c} on={chips.includes(c)} onPress={() => toggleChip(c)} />
          ))}
        </ChipRow>
        <Field value={text} onChangeText={setText} multiline placeholder="例如：今天吐了兩次，精神還好，有喝水" />
        <View style={{ gap: 8 }}>
          <Label>發生多久</Label>
          {pick(ONSET, onset, setOnset)}
          <Label>頻率</Label>
          {pick(FREQ, freq, setFreq)}
          <Label>吃喝</Label>
          {pick(INTAKE, intake, setIntake)}
          <Label>排尿排便</Label>
          {pick(OUTPUT, output, setOutput)}
        </View>
      </Section>

      {symptoms ? (
        flags.length ? (
          <View style={{ backgroundColor: C.danger, borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>可能是緊急狀況，請立即就醫</Text>
            <Text style={{ color: '#fff', fontSize: 14, lineHeight: 21 }}>偵測到：{flags.join('、')}。這些狀況可能在短時間內惡化，不要等待 AI 回覆。</Text>
            <Row>
              <Btn
                title={vet ? `撥打${vet.name}` : '設定主治醫院'}
                kind="soft"
                style={{ flex: 1 }}
                onPress={() => (vet ? callPhone(vet.phone) : nav.push('vetEdit', { petId: pet.id }))}
              />
              <Btn title="緊急求助" kind="outline" style={{ flex: 1, borderColor: '#fff' }} textStyle={{ color: '#fff' }} onPress={() => nav.pushUnique('sos')} />
            </Row>
            {store.erVet?.phone ? (
              <Btn title={`撥打夜間急診：${store.erVet.name}`} kind="soft" onPress={() => callPhone(store.erVet!.phone)} />
            ) : null}
          </View>
        ) : (
          <Banner kind="info" text="沒有發現明顯的緊急警訊。若症狀持續超過 24 小時、精神變差或不吃不喝，請盡快就醫。" />
        )
      ) : null}

      {symptoms ? <Btn kind="outline" title="存成健康紀錄" onPress={saveRecord} /> : null}

      <Section title="問 AI">
        <Sub>PetPal 會把{pet.name}的資料和症狀整理成提問並複製，開啟你常用的 AI 後就能直接取得建議。</Sub>
        <ChipRow>
          {PROVIDERS.map((p) => (
            <Chip key={p.k} label={p.name} on={provider === p.k} onPress={() => { setProvider(p.k); setGeminiCopied(false); }} />
          ))}
        </ChipRow>
        {provider === 'gemini' ? <Sub>Gemini 無法自動帶入提問，開啟後要自己貼上。</Sub> : null}
        <Btn title="複製提問並開啟" onPress={ask} disabled={!symptoms} />
        {geminiCopied && provider === 'gemini' ? (
          <Banner kind="ok" text="已複製。開啟 Gemini 後，長按輸入框選「貼上」，再送出。" />
        ) : null}
        <Pressable
          onPress={() => setShowPrompt((v) => !v)}
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 12 }}
          hitSlop={6}
        >
          <Text style={{ color: C.accent, fontWeight: '700', fontSize: 15 }}>{showPrompt ? '收合提問內容' : '查看提問內容'}</Text>
        </Pressable>
        {showPrompt ? (
          <Card style={{ backgroundColor: C.sand }}>
            <Label>將會複製的內容</Label>
            <P style={{ fontSize: 13, lineHeight: 20, marginTop: 6 }}>{prompt}</P>
          </Card>
        ) : null}
      </Section>

      <Sub style={{ fontSize: 12 }}>AI 回答僅供參考，無法取代獸醫診斷。</Sub>
    </Screen>
  );
}
