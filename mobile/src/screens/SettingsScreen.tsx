import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useStore, useDraft, sampleStore, emptyStore, migrate } from '../lib/store';
import { useNav } from '../nav';
import { Banner, Btn, Card, Field, KV, ListCard, Screen, Section, Sub, Toggle, confirm } from '../ui/kit';
import { askPermission, syncNotifications, testNotification } from '../lib/notify';
import { cleanupOrphans, shareTextFile } from '../lib/files';
import { today } from '../lib/date';

export default function SettingsScreen() {
  const { store, update, replace, toast, afterSave } = useStore();
  /** Swap in a whole new data set, then delete photos/files the old data used and the new one doesn't. */
  const replaceAll = (next: typeof store) => {
    replace(next);
    afterSave(() => cleanupOrphans(next));
  };
  const nav = useNav();
  const [count, setCount] = useState<number | null>(null);
  const [phone, setPhone] = useDraft(store.ownerPhone, (v) =>
    update((d) => {
      d.ownerPhone = v.trim();
    }),
  );
  const web = Platform.OS === 'web';

  const toggleNotify = async (on: boolean) => {
    if (on) {
      const ok = await askPermission();
      if (!ok) {
        toast('沒有取得通知權限，請到手機設定允許通知');
        return;
      }
    }
    update((d) => {
      d.notifyEnabled = on;
    });
    if (on) {
      const n = await syncNotifications({ ...store, notifyEnabled: true });
      setCount(n);
      toast(`已開啟通知，排定 ${n} 則提醒`);
    } else {
      setCount(0);
      toast('已關閉通知');
    }
  };

  const importBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const text = web ? await (await fetch(res.assets[0].uri)).text() : await new File(res.assets[0].uri).text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.pets)) throw new Error('bad');
      confirm('用備份取代目前資料？', `備份內有 ${data.pets.length} 隻寵物。目前這支手機上的資料會被取代。`, () => {
        replaceAll({ ...migrate(data), onboarded: true });
        // Photos in a backup point at the old phone's files; they show as blank until re-added.
        nav.popToRoot();
        toast('已還原備份');
      }, '還原');
    } catch {
      toast('這個檔案不是 PetPal 備份');
    }
  };

  const stats = [
    ['寵物', store.pets.length],
    ['紀錄', store.entries.length],
    ['日記', store.journal.length],
    ['提醒', store.reminders.length],
    ['用藥', store.meds.length],
    ['花費', store.expenses.length],
  ] as const;

  return (
    <Screen title="設定">
      <Section title="通知">
        {web ? <Banner kind="warn" text="網頁預覽無法發送手機通知，請在 Expo Go 或安裝後的 App 中使用。" /> : null}
        <Toggle label="手機通知" hint="疫苗與提醒（前一晚、當天早上）和用藥時間" value={store.notifyEnabled} onChange={toggleNotify} />
        {store.notifyEnabled ? (
          <View style={{ gap: 8 }}>
            {count !== null ? <Sub>目前排定 {count} 則提醒。</Sub> : null}
            <Btn
              kind="outline"
              title="傳送測試通知"
              onPress={async () => {
                const ok = await testNotification();
                toast(ok ? '3 秒後會收到一則測試通知' : '無法傳送，請確認通知權限');
              }}
            />
          </View>
        ) : null}
      </Section>

      <Section title="飼主與急診">
        <Field label="飼主電話" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="會出現在照顧須知、協尋海報和給醫院的資料" />
        <Card onPress={() => nav.push('vetEdit', { er: true })} style={{ gap: 4 }}>
          <Sub style={{ fontWeight: '700' }}>夜間／假日急診醫院</Sub>
          <Sub>{store.erVet ? `${store.erVet.name} · ${store.erVet.phone}` : '尚未設定，點這裡新增'}</Sub>
        </Card>
      </Section>

      <Section title="資料">
        <ListCard>
          {stats.map(([k, v]) => (
            <KV key={k} k={k} v={`${v}`} />
          ))}
        </ListCard>
        <Sub>所有資料只存在這支手機。換手機或重新安裝前，請先匯出備份。</Sub>
        <Btn
          kind="outline"
          title="匯出備份檔"
          onPress={() => shareTextFile(`petpal-備份-${today()}.json`, JSON.stringify(store), 'application/json')}
        />
        <Btn kind="outline" title="從備份檔還原" onPress={importBackup} />
        {!web ? (
          <Btn
            kind="soft"
            title="清理未使用的照片與檔案"
            onPress={() => {
              const r = cleanupOrphans(store);
              toast(r.count ? `已刪除 ${r.count} 個沒用到的檔案，釋放 ${(r.bytes / 1048576).toFixed(1)} MB` : '沒有需要清理的檔案');
            }}
          />
        ) : null}
      </Section>

      <Section title="重新開始">
        <Card style={{ gap: 10 }}>
          <Btn
            kind="soft"
            title="載入範例資料"
            onPress={() =>
              confirm('載入範例資料？', '目前的資料會被範例資料取代。建議先匯出備份。', () => {
                replaceAll(sampleStore());
                nav.popToRoot();
                toast('已載入範例資料');
              }, '載入')
            }
          />
          <Btn
            kind="danger"
            title="清除所有資料"
            onPress={() =>
              confirm('清除所有資料？', '寵物、紀錄、日記和設定都會刪除，無法復原。', () => {
                replaceAll(emptyStore());
                toast('已清除所有資料與照片');
                nav.popToRoot();
              }, '清除')
            }
          />
        </Card>
      </Section>

      <Sub style={{ textAlign: 'center' }}>PetPal 1.0.0 · 測試版</Sub>
    </Screen>
  );
}
