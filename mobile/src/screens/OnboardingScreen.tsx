import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, sampleStore } from '../lib/store';
import { useNav } from '../nav';
import { Btn, Card, Field, P, Sub } from '../ui/kit';
import { C } from '../ui/theme';

export default function OnboardingScreen() {
  const { update, replace } = useStore();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');

  const start = () => {
    update((d) => {
      d.onboarded = true;
      d.members = [{ ...d.members[0], name: name.trim() || '我' }];
    });
    nav.push('petEdit', { first: true });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 48, gap: 20 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 34, fontWeight: '700', color: C.accent }}>PetPal</Text>
      <Text style={{ fontSize: 24, fontWeight: '700', color: C.ink, lineHeight: 32 }}>一起照顧毛孩的每一天</Text>
      <P>記錄餵食、健康、疫苗與用藥，到時間會在手機上提醒你。所有資料都存在這支手機裡。</P>

      <Card style={{ gap: 14 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>開始使用</Text>
        <Field label="你的稱呼" value={name} onChangeText={setName} placeholder="例如：小明、媽媽" />
        <Btn title="建立我的寵物" onPress={start} />
      </Card>

      <Card style={{ gap: 10, backgroundColor: C.sand }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>只是想先看看？</Text>
        <Sub>載入範例資料（豆豆、麻糬、小白三隻寵物和三位家人），所有功能都可以直接操作。之後可以在「更多 → 設定」清除。</Sub>
        <Btn kind="outline" title="使用範例資料" onPress={() => replace(sampleStore())} />
      </Card>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}
