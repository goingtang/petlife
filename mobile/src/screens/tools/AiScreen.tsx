import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen, Card, Btn, Chip, ChipRow, Field, Banner, PetChips, Section, Sub, P, Label, Row } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useNav } from '../../nav';
import { KIND_LABEL, SEX_LABEL, latestGrowth, entriesFor, entrySummary, medActiveOn, primaryVetPhone } from '../../lib/domain';
import { ageText, today } from '../../lib/date';
import { callPhone, copyText, openUrl } from '../../lib/files';

const QUICK = ['嘔吐', '腹瀉', '不吃東西', '搔癢', '跛腳', '誤食東西', '沒精神', '呼吸急促', '抽搐', '無法排尿', '出血'];

const RED_FLAGS = [
  '抽搐', '呼吸困難', '呼吸急促', '無法排尿', '尿不出來', '大量出血', '出血不止',
  '巧克力', '葡萄', '木糖醇', '百合', '老鼠藥', '昏倒', '昏迷', '腹部腫脹', '中暑', '持續嘔吐',
];

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
  const { store, petId, setPetId, toast } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [text, setText] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [provider, setProvider] = useState<ProviderKey>('chatgpt');
  const [showPrompt, setShowPrompt] = useState(false);

  const symptoms = [chips.join('、'), text.trim()].filter(Boolean).join('；');
  const flags = useMemo(() => RED_FLAGS.filter((f) => symptoms.includes(f)), [symptoms]);
  const vet = pet ? primaryVetPhone(store, pet.id) : null;

  const prompt = useMemo(() => {
    if (!pet) return '';
    const td = today();
    const g = latestGrowth(store, pet.id);
    const meds = store.meds.filter((m) => m.petId === pet.id && medActiveOn(m, td)).map((m) => `${m.name}${m.dose ? ' ' + m.dose : ''}`);
    const health = entriesFor(store, pet.id, 'health').slice(0, 3).map((e) => `${e.at.slice(0, 10)} ${entrySummary(e)}`);
    return [
      '你是協助新手飼主的獸醫分診助理。請用繁體中文回答。',
      '',
      '【寵物資料】',
      `名字：${pet.name}`,
      `種類：${KIND_LABEL[pet.kind]}${pet.breed ? '（' + pet.breed + '）' : ''}`,
      `年齡：${ageText(pet.birthday) || '不詳'}`,
      `性別：${SEX_LABEL[pet.sex]}${pet.neutered ? '，已結紮' : ''}`,
      `體重：${g ? g.weight + ' kg' : '不詳'}`,
      `過敏：${pet.allergy || '無'}`,
      `目前用藥：${meds.join('、') || '無'}`,
      `近期健康紀錄：${health.join('；') || '無'}`,
      '',
      '【目前狀況】',
      symptoms || '（尚未描述）',
      '',
      '請先用一行標示緊急程度：立即就醫／24小時內就醫／居家觀察。',
      '接著用最多 4 點說明：可能原因、在家可以觀察什麼、什麼情況要馬上就醫。',
      '請提醒這不是診斷。',
    ].join('\n');
  }, [pet, store, symptoms]);

  const toggleChip = (c: string) => setChips((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const ask = async () => {
    if (!symptoms) {
      toast('請先描述症狀');
      return;
    }
    await copyText(prompt);
    toast(provider === 'gemini' ? '提問已複製，開啟 Gemini 後請貼上' : '提問已複製');
    openUrl(providerUrl(provider, prompt));
  };

  if (!pet) {
    return (
      <Screen title="AI 健康助理" subtitle="描述症狀，先判斷急不急">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

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
      </Section>

      {symptoms ? (
        flags.length ? (
          <View style={{ backgroundColor: C.danger, borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>可能是緊急狀況，請立即就醫</Text>
            <Text style={{ color: '#fff', fontSize: 14, lineHeight: 21 }}>偵測到：{flags.join('、')}。這些狀況可能在短時間內惡化，不要等待 AI 回覆。</Text>
            <Row>
              <Btn
                title={vet ? `撥打${vet.name}` : '撥打主治醫院'}
                kind="soft"
                style={{ flex: 1 }}
                onPress={() => (vet ? callPhone(vet.phone) : nav.push('vetEdit', { petId: pet.id }))}
              />
              <Btn title="緊急求助" kind="outline" style={{ flex: 1, borderColor: '#fff' }} textStyle={{ color: '#fff' }} onPress={() => nav.push('sos')} />
            </Row>
            {!vet ? <Text style={{ color: '#fff', fontSize: 12 }}>尚未設定主治醫院，按上方按鈕可以設定。</Text> : null}
          </View>
        ) : (
          <Banner kind="info" text="沒有發現明顯的緊急警訊。若症狀持續超過 24 小時、精神變差或不吃不喝，請盡快就醫。" />
        )
      ) : null}

      <Section title="問 AI">
        <Sub>PetPal 會把{pet.name}的資料和症狀整理成提問並複製，開啟你常用的 AI 後就能直接取得建議。</Sub>
        <ChipRow>
          {PROVIDERS.map((p) => (
            <Chip key={p.k} label={p.name} on={provider === p.k} onPress={() => setProvider(p.k)} />
          ))}
        </ChipRow>
        {provider === 'gemini' ? <Sub>Gemini 無法自動帶入提問，開啟後請長按輸入框貼上。</Sub> : null}
        <Btn title="複製提問並開啟" onPress={ask} disabled={!symptoms} />
        <Pressable onPress={() => setShowPrompt((v) => !v)} accessibilityRole="button">
          <Text style={{ color: C.accent, fontWeight: '700', fontSize: 14 }}>{showPrompt ? '收合提問內容' : '查看提問內容'}</Text>
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
