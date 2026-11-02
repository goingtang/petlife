import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Btn, Card, Chip, ChipRow, Field, Segment, Badge, Sub, Banner, PetChips, Section, NumberField, Row, Label, TimeField } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useNav } from '../../nav';
import { latestGrowth, primaryVetPhone } from '../../lib/domain';
import { hm, today } from '../../lib/date';
import { callPhone } from '../../lib/files';
import { uid } from '../../lib/seed';
import { CHOCOLATES, chocolateRisk, type ChocolateKind } from '../../lib/health';
import { CONTENT } from '../../data/content';
import { EXTRA_TOXIC, type ToxicItem } from '../../data/content-health';

const SPECIES = ['狗', '貓', '兔', '鳥'];
const LV: { label: string; fg: string; bg: string }[] = [
  { label: '安全', fg: '#4E6B49', bg: '#E3EBDD' },
  { label: '少量可', fg: '#7A5A12', bg: '#F8E7BF' },
  { label: '有毒', fg: '#B4561F', bg: '#FBE0CF' },
  { label: '劇毒', fg: '#FFFFFF', bg: '#A0442A' },
];
const CATS = ['全部', '食物', '植物', '居家用品', '藥物'];
/** 「少量可」 only makes sense for food; for chemicals and plants it reads as 「較低風險」. */
const lvLabel = (lv: number, cat: string) => (lv === 1 && cat !== '食物' ? '較低風險' : LV[lv].label);
const KIND_SP: Record<string, number> = { dog: 0, cat: 1, rabbit: 2, bird: 3 };

/** Base list plus Taiwan-common additions, without duplicate names. */
const ITEMS: ToxicItem[] = (() => {
  const base: ToxicItem[] = CONTENT.toxic.map((t) => ({ id: t.id, cat: t.cat, lv: [...t.lv], name: t.name, note: t.note }));
  const names = new Set(base.map((t) => t.name));
  return [...base, ...EXTRA_TOXIC.filter((t) => !names.has(t.name))];
})();

export default function ToxicScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const nav = useNav();
  const known = pet ? KIND_SP[pet.kind] : undefined;
  const [sp, setSp] = useState(String(known ?? 0));
  const [cat, setCat] = useState('全部');
  const [q, setQ] = useState('');
  // Re-default the species whenever another pet is chosen.
  useEffect(() => {
    if (known !== undefined) setSp(String(known));
  }, [petId, known]);

  const [chocType, setChocType] = useState<ChocolateKind>('milk');
  const [grams, setGrams] = useState<number | null>(null);
  const g = pet ? latestGrowth(store, pet.id) : null;
  const [weight, setWeight] = useState<number | null>(g?.weight ?? null);
  useEffect(() => setWeight(g?.weight ?? null), [petId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [ate, setAte] = useState('');
  const [amount, setAmount] = useState('');
  const [logged, setLogged] = useState(false);
  const [foundAt, setFoundAt] = useState(hm());
  const scrollRef = useRef<any>(null);
  const formY = useRef(0);
  // Another pet: the ingestion form starts over.
  useEffect(() => {
    setAte('');
    setAmount('');
    setLogged(false);
    setFoundAt(hm());
    setGrams(null);
  }, [petId]);

  const spi = Number(sp);
  const query = q.trim().toLowerCase();
  const items = ITEMS.filter((t) => (cat === '全部' || t.cat === cat) && (!query || (t.name + ' ' + t.note).toLowerCase().includes(query)))
    .slice()
    .sort((a, b) => b.lv[spi] - a.lv[spi]);
  const vet = pet ? primaryVetPhone(store, pet.id) : null;

  const choc = CHOCOLATES.find((c) => c.k === chocType)!;
  // Severity follows the pet's own species, not the species tab being browsed.
  const petSp = known ?? spi;
  const calcKind = pet && (pet.kind === 'dog' || pet.kind === 'cat') ? pet.kind : spi === 1 ? 'cat' : 'dog';
  const chocRes = grams && weight ? chocolateRisk(chocType, grams, weight, calcKind) : null;
  const mgPerKg = chocRes ? chocRes.mgPerKg : null;

  const logIngestion = (what: string, amt: string, severity: 'mild' | 'moderate' | 'severe') => {
    if (!pet) return;
    update((d) => {
      d.entries.push({
        id: uid('e'),
        petId: pet.id,
        form: 'health',
        at: `${today()}T${hm()}`,
        who: d.me,
        v: { hType: 'symptom', signs: ['誤食'], severity, note: [`誤食：${what}`, amt ? `份量：${amt}` : null, `發現時間：${foundAt}`].filter(Boolean).join('；') },
      });
    });
    setLogged(true);
    toast('已記錄到健康紀錄');
  };

  const matched = ITEMS.find((t) => ate.trim() && (t.name.includes(ate.trim()) || ate.includes(t.name.split('、')[0])));
  const ateSeverity: 'mild' | 'moderate' | 'severe' = matched ? (matched.lv[petSp] >= 3 ? 'severe' : matched.lv[petSp] === 2 ? 'moderate' : 'mild') : 'moderate';

  return (
    <Screen title="有毒查詢" subtitle="食物、植物、藥物能不能碰" scrollRef={scrollRef}>
      <PetChips value={petId} onChange={setPetId} />
      <Field value={q} onChangeText={setQ} placeholder="搜尋：巧克力、檳榔、普拿疼…" />
      {pet && known === undefined ? <Sub>{pet.name}的種類不在清單內，請選擇最接近的物種查看。</Sub> : null}
      <Segment options={SPECIES.map((n, i) => ({ value: String(i), label: n }))} value={sp} onChange={setSp} />
      <ChipRow>
        {CATS.map((c) => (
          <Chip key={c} label={c} on={cat === c} onPress={() => setCat(c)} />
        ))}
      </ChipRow>

      {items.length ? (
        items.map((t) => {
          const lv = LV[t.lv[spi]];
          return (
            <Card
              key={t.id}
              style={{ gap: 8, padding: 14 }}
              onPress={() => {
                if (!pet) return;
                setAte(t.name);
                setLogged(false);
                scrollRef.current?.scrollTo?.({ y: Math.max(0, formY.current - 12), animated: true });
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{t.name}</Text>
                  <Sub>{t.note}</Sub>
                </View>
                <Badge text={lvLabel(t.lv[spi], t.cat)} bg={lv.bg} fg={lv.fg} />
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {SPECIES.map((n, i) => {
                  const l = LV[t.lv[i]];
                  return (
                    <View key={n} style={{ backgroundColor: l.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Text style={{ color: l.fg, fontSize: 12, fontWeight: '700' }}>{n} {lvLabel(t.lv[i], t.cat)}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          );
        })
      ) : (
        <Banner
          kind="warn"
          text="未列出不代表安全，有疑慮請直接聯絡獸醫。"
          action={vet ? { label: `撥打${vet.name}`, onPress: () => callPhone(vet.phone) } : { label: '緊急求助', onPress: () => nav.pushUnique('sos', { topic: 'fa_poison' }) }}
        />
      )}
      <Sub>資料為一般性參考，個體差異很大。若已誤食，請立即聯絡獸醫。</Sub>

      {(pet ? pet.kind === 'dog' || pet.kind === 'cat' : spi === 0 || spi === 1) ? (
        <Section title="吃了巧克力？算算看">
          <Card style={{ gap: 12 }}>
            <ChipRow wrap>
              {CHOCOLATES.map((c) => (
                <Chip key={c.k} label={c.label} on={chocType === c.k} onPress={() => setChocType(c.k)} />
              ))}
            </ChipRow>
            <Row gap={8} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <NumberField label="吃了多少" value={grams} onChange={setGrams} unit="克" />
              </View>
              <View style={{ flex: 1 }}>
                <NumberField label="體重" value={weight} onChange={setWeight} unit="kg" />
              </View>
            </Row>
            <Sub>{g ? '體重預設為最近一次紀錄。' : ''}一般牛奶巧克力一片約 40 克。不確定是哪一種時，選「不確定種類」會用最高含量估算。</Sub>
            {chocRes && mgPerKg !== null ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>約 {Math.round(mgPerKg)} mg／kg 可可鹼</Text>
                <Banner kind={chocRes.kind} text={chocRes.text} />
                <Btn kind="outline" title="記錄這次誤食" onPress={() => logIngestion(choc.label, `${grams} 克`, chocRes.severity)} />
              </View>
            ) : null}
            <Sub style={{ fontSize: 12 }}>以平均含量估算，各品牌差異大；巧克力裡的咖啡因也有毒性，這裡沒有計入。僅供判斷急迫程度參考，不能取代獸醫評估。</Sub>
          </Card>
        </Section>
      ) : null}

      {pet ? (
        <View onLayout={(e) => (formY.current = e.nativeEvent.layout.y)}>
        <Section title="記錄誤食">
          <Card style={{ gap: 10 }}>
            <Sub>點上方項目可直接帶入。記錄後會出現在{pet.name}的健康紀錄，就醫時可以給醫師看。</Sub>
            <Field label="吃了什麼" value={ate} onChangeText={(t) => { setAte(t); setLogged(false); }} placeholder="例如：葡萄、普拿疼" />
            <Field label="大約多少" value={amount} onChangeText={setAmount} placeholder="例如：3 顆、半片" />
            <TimeField label="發現時間" value={foundAt} onChange={setFoundAt} />
            <Btn title="記錄" disabled={!ate.trim()} onPress={() => logIngestion(ate.trim(), amount.trim(), ateSeverity)} />
            {logged ? (
              <Banner kind="danger" text="記錄好了。請帶著包裝或剩下的東西，盡快聯絡獸醫。" action={{ label: '看急救步驟', onPress: () => nav.pushUnique('sos', { topic: 'fa_poison' }) }} />
            ) : null}
          </Card>
        </Section>
        </View>
      ) : null}

      <Label>已經吃了？</Label>
      <Btn kind="danger" title="看急救步驟" onPress={() => nav.pushUnique('sos', { topic: 'fa_poison' })} />
    </Screen>
  );
}
