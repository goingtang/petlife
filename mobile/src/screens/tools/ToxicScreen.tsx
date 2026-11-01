import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Btn, Card, Chip, ChipRow, Field, Segment, Badge, Sub, Empty } from '../../ui/kit';
import { C } from '../../ui/theme';
import { usePet } from '../../lib/store';
import { useNav } from '../../nav';
import { CONTENT } from '../../data/content';

const SPECIES = ['狗', '貓', '兔', '鳥'];
const LV: { label: string; fg: string; bg: string }[] = [
  { label: '安全', fg: '#4E6B49', bg: '#E3EBDD' },
  { label: '少量可', fg: '#7A5A12', bg: '#F8E7BF' },
  { label: '有毒', fg: '#B4561F', bg: '#FBE0CF' },
  { label: '劇毒', fg: '#FFFFFF', bg: '#A0442A' },
];
const CATS = ['全部', '食物', '植物', '居家用品', '藥物'];

export default function ToxicScreen(_: { params: any }) {
  const pet = usePet();
  const nav = useNav();
  const defSp = pet ? ({ dog: 0, cat: 1, rabbit: 2, bird: 3 } as Record<string, number>)[pet.kind] ?? 0 : 0;
  const [sp, setSp] = useState(String(defSp));
  const [cat, setCat] = useState('全部');
  const [q, setQ] = useState('');
  const spi = Number(sp);
  const query = q.trim().toLowerCase();

  const items = CONTENT.toxic
    .filter((t) => (cat === '全部' || t.cat === cat) && (!query || (t.name + ' ' + t.note).toLowerCase().includes(query)))
    .slice()
    .sort((a, b) => b.lv[spi] - a.lv[spi]);

  return (
    <Screen title="有毒查詢" subtitle="食物、植物、藥物能不能碰">
      <Field value={q} onChangeText={setQ} placeholder="搜尋：巧克力、百合、普拿疼…" />
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
            <Card key={t.id} style={{ gap: 8, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{t.name}</Text>
                  <Sub>{t.note}</Sub>
                </View>
                <Badge text={lv.label} bg={lv.bg} fg={lv.fg} />
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {SPECIES.map((n, i) => {
                  const l = LV[t.lv[i]];
                  return (
                    <View key={n} style={{ backgroundColor: l.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: l.fg, fontSize: 11, fontWeight: '700' }}>{n} {l.label}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          );
        })
      ) : (
        <Empty text="找不到相關項目，換個關鍵字試試。" />
      )}

      <Sub>資料為一般性參考，若已誤食請立即聯絡獸醫。</Sub>
      <Btn kind="danger" title="已經吃了？看急救步驟" onPress={() => nav.push('sos')} />
    </Screen>
  );
}
