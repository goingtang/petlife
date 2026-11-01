import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Card, Chip, ChipRow, Field, Segment, Empty } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore } from '../../lib/store';
import { useNav } from '../../nav';
import { CONTENT } from '../../data/content';

export default function LearnScreen(_: { params: any }) {
  const { store } = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('全部');
  const [seg, setSeg] = useState<'all' | 'saved'>('all');
  const cats = ['全部', ...Array.from(new Set(CONTENT.articles.map((a) => a.cat as string)))];
  const ql = q.trim().toLowerCase();
  const list = CONTENT.articles.filter(
    (a) =>
      (cat === '全部' || a.cat === cat) &&
      (seg === 'all' || store.saved[a.id]) &&
      (!ql || [a.title, a.lead, ...a.steps].join(' ').toLowerCase().includes(ql)),
  );

  return (
    <Screen title="新手知識" subtitle="照護入門">
      <Field value={q} onChangeText={setQ} placeholder="搜尋：餵食、疫苗、環境…" />
      <Segment options={[{ value: 'all', label: '全部文章' }, { value: 'saved', label: '我的收藏' }]} value={seg} onChange={setSeg} />
      <ChipRow>
        {cats.map((c) => <Chip key={c} label={c} on={c === cat} onPress={() => setCat(c)} />)}
      </ChipRow>
      {list.length ? list.map((a) => (
        <Card key={a.id} onPress={() => nav.push('article', { id: a.id })} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, color: C.ink }}>{a.cat[0]}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink, lineHeight: 21 }}>{a.title}</Text>
            <Text style={{ fontSize: 12, color: C.sub }}>{a.cat} · {a.mins} 分鐘閱讀{store.saved[a.id] ? ' · 已收藏' : ''}</Text>
          </View>
        </Card>
      )) : (
        <Empty text={seg === 'saved' && !ql ? '還沒有收藏的文章，打開文章後按「收藏這篇」。' : '找不到相關文章，換個關鍵字試試'} />
      )}
    </Screen>
  );
}
