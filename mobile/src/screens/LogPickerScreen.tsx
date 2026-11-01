import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePet } from '../lib/store';
import { useNav } from '../nav';
import { Screen, Sub } from '../ui/kit';
import { C } from '../ui/theme';

export const FORM_TILES = [
  { form: 'feed', title: '餵食', desc: '食物與飲水', color: '#F8E7BF' },
  { form: 'health', title: '健康', desc: '症狀、用藥、看診、排便', color: '#F6DCCF' },
  { form: 'growth', title: '成長', desc: '體重與體態', color: '#E3EBDD' },
  { form: 'reminder', title: '提醒', desc: '疫苗、驅蟲、回診', color: '#DDE6EE' },
  { form: 'diary', title: '日記', desc: '留住今天的小事', color: '#EEE0F0' },
  { form: 'contact', title: '緊急聯絡人', desc: '醫院、家人、保母', color: '#E6E2C8' },
];

export default function LogPickerScreen() {
  const pet = usePet();
  const nav = useNav();
  return (
    <Screen title="要記錄什麼？" subtitle={pet ? `幫${pet.name}記錄` : undefined}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {FORM_TILES.map((t) => (
          <Pressable
            key={t.form}
            onPress={() => nav.replace('form', { form: t.form, petId: pet?.id })}
            style={({ pressed }) => [{ width: '48%', minHeight: 96, borderRadius: 22, backgroundColor: t.color, padding: 14, justifyContent: 'space-between' }, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={t.title}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{t.title}</Text>
            <Sub style={{ fontSize: 12 }}>{t.desc}</Sub>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
