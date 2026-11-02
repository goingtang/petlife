import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen, Card, Btn, Chip, ChipRow, Field, Banner, PetChips, Section, Sub, P, Label, Row, confirm } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useNav } from '../../nav';
import { KIND_LABEL, SEX_LABEL, entriesFor, entrySummary, medActiveOn, primaryVetPhone } from '../../lib/domain';
import { addDays, ageText, hm, today } from '../../lib/date';
import { callPhone, copyText, openUrl } from '../../lib/files';
import { uid } from '../../lib/seed';
import { assessSymptoms, reassurance } from '../../lib/health';

const QUICK = ['嘔吐', '腹瀉', '不吃東西', '搔癢', '跛腳', '誤食東西', '沒精神', '呼吸急促', '抽搐', '無法排尿', '出血'];
// Quick chips that are emergencies on their own; mapped to a matching sign so the checker sees them.
const CHIP_SIGN: Record<string, string> = { 誤食東西: '誤食', 出血: '出血', 無法排尿: '無法排尿', 抽搐: '抽搐', 呼吸急促: '呼吸急促' };

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

const TITLE = '症狀檢查 · 問 AI';
const SUBTITLE = '先判斷急不急（不是診斷）';

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
  const [savedFor, setSavedFor] = useState<string | null>(null);

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
  // Each chip is its own clause so a negation in the free text can't reach it.
  const checkText = [...chips.map((c) => CHIP_SIGN[c] ?? c), text.trim(), intake === '不吃不喝' ? '不吃不喝' : ''].filter(Boolean).join('。');
  const assessment = useMemo(() => assessSymptoms(checkText, pet?.kind), [checkText, pet?.kind]);
  const flags = assessment.flags;
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

  const ask = () => {
    if (!symptoms) {
      toast('請先描述症狀');
      return;
    }
    const name = PROVIDERS.find((p) => p.k === provider)?.name ?? 'AI';
    confirm(
      `把資料交給 ${name}？`,
      `會複製並送出以下內容到 ${name}（由該服務的隱私政策規範）：\n• ${pet?.name}的名字、種類、品種、年齡、性別、體重、過敏\n• 目前用藥、近 30 天健康紀錄\n• 你描述的症狀\n\n不會包含你的電話、地址或照片。`,
      () => void send(),
      '同意並開啟',
      { destructive: false },
    );
  };
  const send = async () => {
    await copyText(prompt);
    toast(`提問已複製，內含${pet?.name ?? ''}的健康資料`);
    if (provider === 'gemini') setGeminiCopied(true);
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
    setSavedFor(checkText + '|' + details.join('|'));
    toast('已存成健康紀錄');
  };
  const alreadySaved = savedFor === checkText + '|' + details.join('|');

  if (!pet) {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

  // One-time notice before first use.
  if (!store.disclaimerOk) {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <Card style={{ gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>使用前請先了解</Text>
          <P>這裡依你描述的症狀，用固定規則找出常見的緊急警訊，幫你判斷要不要馬上就醫。</P>
          <P>它不是診斷，也不能取代獸醫。沒有偵測到警訊不代表沒事；只要你覺得不對勁，請直接聯絡醫院。</P>
          <P>「問 AI」會在你同意後，把整理好的文字交給你選的 AI 服務（例如 ChatGPT），PetPal 不會自己上傳資料。</P>
          <Btn title="我了解，開始使用" onPress={() => update((d) => { d.disclaimerOk = true; })} />
          <Btn kind="danger" title="現在就是緊急狀況" onPress={() => nav.pushUnique('sos')} />
        </Card>
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
    <Screen title={TITLE} subtitle={SUBTITLE}>
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
          <Banner kind={assessment.warnings.length ? 'warn' : 'info'} text={reassurance(pet.kind, pet.birthday, assessment.warnings)} />
        )
      ) : null}

      {symptoms ? <Btn kind="outline" title={alreadySaved ? '已存成健康紀錄' : '存成健康紀錄'} disabled={alreadySaved} onPress={saveRecord} /> : null}

      <Section title="問 AI">
        <Sub>PetPal 會把{pet.name}的資料和症狀整理成提問並複製，開啟你常用的 AI 後就能直接取得建議。</Sub>
        <Sub style={{ fontSize: 12 }}>提問會包含{pet.name}的年齡、體重、用藥與近 30 天健康紀錄，並送到你選擇的 AI 服務。</Sub>
        <ChipRow wrap>
          {PROVIDERS.map((p) => (
            <Chip key={p.k} label={p.name} on={provider === p.k} onPress={() => { setProvider(p.k); setGeminiCopied(false); }} />
          ))}
        </ChipRow>
        {provider === 'gemini' ? <Sub>Gemini 無法自動帶入提問，開啟後要自己貼上。</Sub> : null}
        <Btn title="整理提問並開啟 AI" onPress={ask} disabled={!symptoms} />
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

      <Sub style={{ fontSize: 12 }}>症狀檢查與 AI 回答都僅供參考，無法取代獸醫診斷。緊急警訊的整理參考 Merck Veterinary Manual（默克獸醫手冊）等公開獸醫資料。</Sub>
    </Screen>
  );
}
