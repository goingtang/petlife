import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePet } from '../lib/store';
import { useNav } from '../nav';
import { Screen, Sub } from '../ui/kit';
import { C, TILE_COLORS } from '../ui/theme';

type Tile = { name: string; desc: string; route: string; params?: any };

export default function MoreScreen() {
  const nav = useNav();
  const pet = usePet();
  // Things already on a tab (用藥、健康報告、文件夾 on 健康; the pet profile on 今天) are not repeated here.
  const groups: { name: string; items: Tile[] }[] = [
    {
      name: '安全',
      items: [
        { name: '緊急求助', desc: '急診、急救步驟', route: 'sos' },
        { name: '症狀檢查 · 問 AI', desc: '先判斷急不急', route: 'ai' },
        { name: '有毒查詢', desc: '食物、植物、藥物', route: 'toxic' },
        { name: '走失協尋', desc: '協尋海報與分享', route: 'lost' },
      ],
    },
    {
      name: '生活照護',
      items: [
        { name: '花費記帳', desc: '每月花費與預算', route: 'expense' },
        { name: '用品庫存', desc: '快用完時提醒', route: 'supplies' },
        { name: '美容洗澡', desc: '洗澡、指甲、刷牙', route: 'groom' },
        { name: '附近地點', desc: '依定位找醫院與商店', route: 'places' },
        { name: '照顧須知', desc: '給保母或寄宿的說明', route: 'care' },
        { name: '成分掃描', desc: '看懂飼料標籤', route: 'scan' },
      ],
    },
    {
      name: '回憶與學習',
      items: [
        { name: '里程碑', desc: '一起走過的日子', route: 'miles' },
        { name: '新手知識', desc: '照護入門', route: 'learn' },
      ],
    },
    {
      name: '管理',
      items: [
        { name: '新增寵物', desc: '建立新的寵物檔案', route: 'petEdit', params: {} },
        ...(pet ? [{ name: '照護項目', desc: '每日待辦與輪值', route: 'tasks', params: { petId: pet.id } }] : []),
        { name: '家人成員', desc: '誰在用這支手機', route: 'members' },
        { name: '設定', desc: '備份、通知、隱私說明', route: 'settings' },
      ],
    },
  ];
  return (
    <Screen root title="更多功能">
      {groups.map((g, gi) => (
        <View key={g.name} style={{ gap: 10 }}>
          <Sub style={{ fontWeight: '700' }}>{g.name}</Sub>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {g.items.map((it, i) => (
              <Pressable
                key={it.name}
                onPress={() => nav.push(it.route, it.params)}
                style={({ pressed }) => [{ width: '48%', minHeight: 88, borderRadius: 22, backgroundColor: TILE_COLORS[(i + gi * 2) % TILE_COLORS.length], padding: 14, justifyContent: 'space-between' }, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel={it.name}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{it.name}</Text>
                <Text style={{ fontSize: 12, color: '#5E4E42', lineHeight: 17 }}>{it.desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}
