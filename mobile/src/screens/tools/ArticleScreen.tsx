import React from 'react';
import { Text, View } from 'react-native';
import { Screen, Card, Btn, Badge, Row, Empty, Sub } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore } from '../../lib/store';
import { shareText } from '../../lib/files';
import { CONTENT } from '../../data/content';

export default function ArticleScreen({ params }: { params: any }) {
  const { store, update, toast } = useStore();
  const a = CONTENT.articles.find((x) => x.id === params?.id);
  if (!a) return <Screen title="文章"><Empty text="找不到這篇文章" /></Screen>;
  const saved = !!store.saved[a.id];

  return (
    <Screen>
      <View style={{ height: 140, borderRadius: 28, backgroundColor: a.color, justifyContent: 'flex-end', padding: 18 }}>
        <Badge text={`${a.cat} · ${a.mins} 分鐘閱讀`} bg={C.card} />
      </View>
      <Text style={{ fontSize: 26, fontWeight: '700', color: C.ink, lineHeight: 34 }}>{a.title}</Text>
      <Text style={{ fontSize: 15, lineHeight: 25, color: C.body }}>{a.lead}</Text>
      {a.steps.map((s, i) => (
        <Card key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.bg, fontWeight: '700' }}>{i + 1}</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 23, color: C.ink, paddingTop: 2 }}>{s}</Text>
        </Card>
      ))}
      <Sub>內容為一般照護建議，實際狀況請依獸醫師評估。</Sub>
      <Btn
        title={saved ? '已收藏 ✓' : '收藏這篇'}
        kind={saved ? 'outline' : 'primary'}
        onPress={() => {
          update((d) => { d.saved[a.id] = !saved; });
          if (!saved) toast('已加入收藏');
        }}
      />
      <Row>
        <Btn kind="ghost" title="分享這篇" style={{ flex: 1 }} onPress={() => shareText(`${a.title}\n\n${a.lead}\n\n${a.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n— PetPal 新手知識`, a.title)} />
      </Row>
    </Screen>
  );
}
