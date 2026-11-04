import React, { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { useStore, useDraft, sampleStore, emptyStore, migrate } from '../lib/store';
import { useNav } from '../nav';
import { Banner, Btn, Card, Field, KV, ListCard, Screen, Section, Sub, Toggle, confirm } from '../ui/kit';
import { askPermission, syncNotifications, testNotification } from '../lib/notify';
import { wipeAll } from '../lib/persist';
import { cleanupOrphans, shareFile, shareTextFile } from '../lib/files';
import { LARGE_BACKUP_BYTES, backupFilesBytes, openBackup, writeBackupZip } from '../lib/backup';
import { clearPlacesCache } from './tools/PlacesScreen';
import { resetDoseMemory } from '../lib/doses';
import { today } from '../lib/date';

export default function SettingsScreen() {
  const { store, update, replace, toast, afterSave, getStore } = useStore();
  /**
   * Swap in a whole new data set, then delete photos/files the old data used and the new one doesn't.
   * The clean-up looks at the data as it is when the save lands (photos added since then are kept).
   */
  const replaceAll = (next: typeof store) => {
    replace(next);
    afterSave(() => cleanupOrphans(getStore()));
  };
  const nav = useNav();
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone, flushPhone] = useDraft(store.ownerPhone, (v) =>
    update((d) => {
      d.ownerPhone = v.trim();
    }),
  );
  const web = Platform.OS === 'web';
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const build = Application.nativeBuildVersion;

  const backupName = (ext: string) => `petpal-備份-${today()}.${ext}`;
  const markBackedUp = () =>
    update((d) => {
      d.lastBackupAt = new Date().toISOString();
    });

  /** Make the zip (data + photos/documents) and open the share sheet (Google 雲端硬碟、存到檔案…). */
  const shareZip = async (withFiles: boolean) => {
    setBusy(true);
    try {
      const uri = await writeBackupZip(store, backupName('zip'), withFiles);
      if (uri && (await shareFile(uri, 'application/zip', '儲存 PetPal 備份'))) {
        markBackedUp();
        toast(withFiles ? '備份已建立（含照片與文件）' : '備份已建立（只有資料，不含照片）');
      }
    } catch {
      Alert.alert('備份沒有完成', '可能是手機空間不足。可以先清理未使用的照片，或改用「只備份資料」。', [
        { text: '取消', style: 'cancel' },
        { text: '只備份資料', onPress: () => shareZip(false) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = () => {
    if (web) {
      shareTextFile(backupName('json'), JSON.stringify(store), 'application/json');
      markBackedUp();
      return;
    }
    const bytes = backupFilesBytes(store);
    const mb = bytes / 1048576;
    const privacy = '備份檔包含寵物、健康紀錄、日記、照片、文件和家人與醫院的電話。請只存到自己的雲端硬碟或傳給自己，不要分享到群組。';
    if (bytes > LARGE_BACKUP_BYTES)
      Alert.alert('照片與文件很多', `照片與文件共約 ${Math.round(mb)} MB，建立備份需要一些時間和手機空間。${privacy}`, [
        { text: '取消', style: 'cancel' },
        { text: '只備份資料', onPress: () => shareZip(false) },
        { text: '全部備份', onPress: () => shareZip(true) },
      ]);
    else
      Alert.alert('匯出完整備份', `${privacy}${mb >= 1 ? `\n\n照片與文件約 ${mb.toFixed(0)} MB。` : ''}`, [
        { text: '取消', style: 'cancel' },
        { text: '匯出', onPress: () => shareZip(true) },
      ]);
  };

  /** Erase everything: data file and its copies, photos, exports, scheduled notifications. */
  const eraseEverything = async () => {
    flushPhone(); // typing in this screen must not land in the new, empty data
    await syncNotifications({ ...store, notifyEnabled: false }, true); // cancels everything this app scheduled
    // Delete the files first, then save the empty data: nothing is queued for "after the next save",
    // so a failed save can never wipe files the user adds later.
    await wipeAll();
    clearPlacesCache();
    resetDoseMemory();
    replace(emptyStore());
    nav.popToRoot();
    nav.setTab('today');
    toast('已清除所有資料與照片');
  };

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
      const n = await syncNotifications({ ...store, notifyEnabled: true }, true);
      setCount(n);
      toast(`已開啟通知，排定 ${n} 則提醒`);
    } else {
      setCount(0);
      toast('已關閉通知');
    }
  };

  const importBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const opened = await openBackup(res.assets[0].uri);
      const data = opened.data;
      if (!data || !Array.isArray(data.pets)) throw new Error('bad');
      const what = opened.fileCount ? `備份內有 ${data.pets.length} 隻寵物和 ${opened.fileCount} 個照片／文件。` : `備份內有 ${data.pets.length} 隻寵物（這個備份不含照片）。`;
      confirm('用備份取代目前資料？', `${what}目前這支手機上的資料會被取代，備份之後才新增的紀錄和照片會被移除。`, async () => {
        try {
          setBusy(true);
          const r = await opened.restore();
          replaceAll({ ...migrate(r.data), onboarded: true });
          nav.popToRoot();
          toast(r.restoredFiles ? `已還原備份與 ${r.restoredFiles} 個照片／文件` : '已還原備份');
        } catch {
          toast('還原沒有完成，請確認手機空間後再試一次');
        } finally {
          setBusy(false);
        }
      }, '還原');
    } catch {
      toast('這個檔案不是 PetPal 備份');
    }
  };

  const lastBackup = (() => {
    if (!store.lastBackupAt) return '還沒有備份過';
    const days = Math.floor((Date.now() - new Date(store.lastBackupAt).getTime()) / 86400000);
    return days <= 0 ? '上次備份：今天' : `上次備份：${days} 天前`;
  })();

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
        <Sub>
          所有資料只存在這支手機。換手機或重新安裝前，請先匯出備份{web ? '（網頁預覽的備份只有資料，不含照片）' : '（含照片與文件）'}，存到 Google 雲端硬碟或「檔案」App。服藥打卡紀錄保留 90 天。
        </Sub>
        <Sub style={{ fontWeight: '700' }}>{lastBackup}</Sub>
        <Btn kind="outline" title={busy ? '處理中…' : '匯出備份檔'} disabled={busy} onPress={exportBackup} />
        <Btn kind="outline" title="從備份檔還原" disabled={busy} onPress={importBackup} />
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
              confirm('清除所有資料？', '寵物、紀錄、日記、照片、文件、設定和已排定的通知都會從這支手機刪除，無法復原。', eraseEverything, '清除')
            }
          />
        </Card>
      </Section>

      <Section title="關於">
        <Card onPress={() => nav.push('privacy')} style={{ gap: 4 }}>
          <Sub style={{ fontWeight: '700' }}>隱私權政策</Sub>
          <Sub>資料怎麼存、哪些功能會連網、如何刪除</Sub>
        </Card>
      </Section>

      <Sub style={{ textAlign: 'center' }}>PetPal {version}{build ? `（${build}）` : ''}</Sub>
    </Screen>
  );
}
