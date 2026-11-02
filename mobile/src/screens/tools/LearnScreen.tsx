import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen, Chip, ChipRow, Field, Segment, Empty, Sub } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore } from '../../lib/store';
import { useNav } from '../../nav';
import { allArticles } from '../../data/content-articles';

export default function LearnScreen(_: { params: any }) {
  const { store } = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('全部');
  const [view, setView] = useState<'all' | 'saved'>('all');

  const articles = allArticles();
  const cats = ['全部', ...Array.from(new Set(articles.map((a) => a.cat)))];
  const myKinds = new Set(store.pets.map((p) => p.kind));
  const relevant = (kinds?: string[]) => !kinds?.length || kinds.some((k) => myKinds.has(k as any));
  const query = q.trim().toLowerCase();

  const savedAll = articles.filter((a) => store.saved[a.id]);
  const list = articles
    .filter((a) => (cat === '全部' || a.cat === cat) && (view === 'all' || store.saved[a.id]))
    .filter((a) => !query || [a.title, a.lead, ...a.steps].join(' ').toLowerCase().includes(query))
    .sort((a, b) => Number(relevant(b.kinds)) - Number(relevant(a.kinds)));

  let empty = '找不到相關文章，換個關鍵字試試';
  if (view === 'saved' && !savedAll.length) empty = '還沒有收藏的文章。閱讀文章時按「收藏這篇」就會出現在這裡';
  else if (view === 'saved' && cat !== '全部' && !query) empty = '此分類沒有收藏，切到「全部」可以看到其他收藏';

  return (
    <Screen title="新手知識" subtitle="照護入門與台灣在地須知">
      <Field value={q} onChangeText={setQ} placeholder="搜尋：疫苗、中暑、登記…" />
      <Segment options={[{ value: 'all', label: '全部文章' }, { value: 'saved', label: `我的收藏（${savedAll.length}）` }]} value={view} onChange={setView} />
      <ChipRow>
        {cats.map((c) => <Chip key={c} label={c} on={c === cat} onPress={() => setCat(c)} />)}
      </ChipRow>
      {list.map((a) => (
        <Pressable key={a.id} onPress={() => nav.push('article', { id: a.id })} style={({ pressed }) => [{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: 22, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card }, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={a.title}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.ink }}>{a.cat[0]}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink, lineHeight: 21 }}>{a.title}</Text>
            <Sub style={{ fontSize: 12 }}>{a.cat} · {a.mins} 分鐘閱讀{store.saved[a.id] ? ' · 已收藏' : ''}</Sub>
          </View>
        </Pressable>
      ))}
      {!list.length ? <Empty text={empty} action={view === 'saved' && cat !== '全部' ? { label: '看全部收藏', onPress: () => setCat('全部') } : undefined} /> : null}
      <Sub>內容為一般照護建議，實際狀況請依獸醫師評估。和你的寵物種類相關的文章會排在前面。</Sub>
    </Screen>
  );
}
