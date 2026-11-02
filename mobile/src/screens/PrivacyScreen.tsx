// In-app privacy summary. The full policy is published on GitHub Pages (docs/privacy.html in the repo);
// keep both in sync when anything about data handling changes.
import React from 'react';
import { Text, View } from 'react-native';
import { Btn, Card, P, Screen, Sub } from '../ui/kit';
import { C } from '../ui/theme';
import { openUrl } from '../lib/files';

export const PRIVACY_URL = 'https://goingtang.github.io/petlife/privacy.html';

const ITEMS: { title: string; body: string }[] = [
  { title: '資料只存在你的手機', body: 'PetPal 不需要註冊帳號，也沒有自己的伺服器。寵物資料、紀錄、照片和文件都存在這支手機的 App 資料夾裡，我們收不到。' },
  { title: '不追蹤、不放廣告', body: '沒有廣告，也沒有使用分析或追蹤工具。' },
  { title: '定位：只在「附近地點」使用', body: '你按下「使用目前位置」才會取得位置。位置會先四捨五入到約 100 公尺，再送到 OpenStreetMap 的公開查詢服務找附近的醫院和商店；PetPal 不會儲存你的位置。' },
  { title: '相機與相簿', body: '只用在你自己選擇或拍攝的照片（寵物、日記、收據、文件），照片縮小後存在手機裡。' },
  { title: '通知', body: '提醒都在手機上排程，不經過任何伺服器。' },
  { title: '問 AI', body: '只有在你按下並同意後，才會把整理好的文字（寵物基本資料、用藥、近期健康紀錄與症狀）交給你選擇的 AI 服務，由該服務的隱私政策規範。' },
  { title: '分享與備份', body: '備份檔、PDF 和 CSV 只有在你按下分享時才會離開手機，送給誰由你決定。備份檔含有聯絡電話等資料，請小心保管。' },
  { title: '刪除資料', body: '到「設定 → 清除所有資料」可刪除手機裡的全部資料與照片；移除 App 也會一併刪除。' },
];

export default function PrivacyScreen(_: { params: any }) {
  return (
    <Screen title="隱私說明" subtitle="PetPal 怎麼處理你的資料">
      {ITEMS.map((it) => (
        <Card key={it.title} style={{ gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{it.title}</Text>
          <P style={{ fontSize: 14 }}>{it.body}</P>
        </Card>
      ))}
      <View style={{ gap: 8 }}>
        <Btn kind="outline" title="開啟完整隱私權政策" onPress={() => openUrl(PRIVACY_URL)} />
        <Sub style={{ fontSize: 12 }}>完整版本：{PRIVACY_URL}</Sub>
      </View>
    </Screen>
  );
}
