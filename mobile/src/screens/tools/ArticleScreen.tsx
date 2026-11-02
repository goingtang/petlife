import React from 'react';
import { Text, View } from 'react-native';
import { Screen, Card, Btn, Badge, Empty, Row, Section, Sub } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore } from '../../lib/store';
import { useNav } from '../../nav';
import { shareText } from '../../lib/files';
import { allArticles } from '../../data/content-articles';

export default function ArticleScreen({ params }: { params: any }) {
  const { store, update, toast } = useStore();
  const nav = useNav();
  const articles = allArticles();
  const a = articles.find((x) => x.id === params.id);
  if (!a)
    return (
      <Screen title="文章">
        <Empty text="找不到這篇文章" />
      </Screen>
    );
  const saved = !!store.saved[a.id];
  const related = articles.filter((x) => x.cat === a.cat && x.id !== a.id).slice(0, 3);

  return (
    <Screen>
      <View style={{ height: 130, borderRadius: 28, backgroundColor: a.color, justifyContent: 'flex-end', padding: 18 }}>
        <Badge text={`${a.cat} · ${a.mins} 分鐘閱讀`} bg={C.card} />
      </View>
      <Text style={{ fontSize: 25, fontWeight: '700', color: C.ink, lineHeight: 33 }}>{a.title}</Text>
      <Text style={{ fontSize: 15, lineHeight: 25, color: C.body }}>{a.lead}</Text>
      {a.steps.map((s, i) => (
        <Row key={i} gap={12} style={{ alignItems: 'flex-start', padding: 14, borderRadius: 20, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.bg, fontWeight: '700' }}>{i + 1}</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 24, color: C.ink }}>{s}</Text>
        </Row>
      ))}
      <Sub>內容為一般照護建議，實際狀況請依獸醫師評估。</Sub>
      {a.source || a.updated ? <Sub>資料來源：{a.source ?? 'PetPal 編輯整理'}{a.updated ? ` · 更新於 ${a.updated.replace('-', ' 年 ')} 月` : ''}</Sub> : null}
      <Btn
        title={saved ? '已收藏（點一下取消）' : '收藏這篇'}
        kind={saved ? 'outline' : 'primary'}
        onPress={() => {
          update((d) => {
            if (saved) delete d.saved[a.id];
            else d.saved[a.id] = true;
          });
          toast(saved ? '已取消收藏' : '已加入收藏');
        }}
      />
      <Btn kind="ghost" title="分享" onPress={() => shareText(`${a.title}\n\n${a.lead}\n\n${a.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n— PetPal 新手知識`, a.title)} />
      {related.length ? (
        <Section title="相關文章">
          {related.map((r) => (
            <Card key={r.id} onPress={() => nav.replace('article', { id: r.id })} style={{ gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{r.title}</Text>
              <Sub style={{ fontSize: 12 }}>{r.cat} · {r.mins} 分鐘閱讀</Sub>
            </Card>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
