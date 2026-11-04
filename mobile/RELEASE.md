# PetPal 上架指南（App Store／Google Play）

這份文件整理從現在到上架要做的事。標「你」的步驟需要本人操作（付款、身分驗證、簽約）；其他步驟可以交給開發協助完成。

> 費用、規定以 Apple、Google 官方頁面當下公告為準；下面是撰寫時（2026 年 11 月）的情況。

## 0. 時程建議（1–2 個月）

| 週 | 要做的事 |
|---|---|
| 第 1 週 | 你：申請兩個開發者帳號（Apple 審核可能要幾天）；開啟 GitHub Pages；填聯絡信箱 |
| 第 2 週 | 打包 Android 測試版，找 12 位測試者加入封閉測試（要連續 14 天） |
| 第 2–3 週 | 打包 iOS 版，用 TestFlight 自己和家人測試 |
| 第 3–4 週 | 準備截圖、說明文字、隱私表單 |
| 第 4–5 週 | 封閉測試滿 14 天後申請 Google Play 正式版；送 App Store 審核 |
| 預留 1–2 週 | 審核被退件時修改再送 |

## 1. 開發者帳號（你）

### Apple Developer Program
- 費用：每年 US$99。
- 網址：https://developer.apple.com/programs/enroll/
- 需要：Apple ID（開啟雙重認證）、真實姓名與地址。以個人身分申請時，App Store 上顯示的賣家名稱是你的本名；想顯示公司名稱要用公司身分申請（需要 D-U-N-S 編號，時間較長）。

### Google Play Console
- 費用：一次性 US$25。
- 網址：https://play.google.com/console/signup
- 需要：Google 帳號、身分證件驗證、手機號碼。
- **新的個人帳號必須先做封閉測試**：至少 12 位測試者加入，並連續 14 天，才能申請正式上架。建議一申請好帳號就開始找測試者（家人、朋友、粉專讀者都可以，需要 Android 手機和 Google 帳號）。

## 2. 上架前要填好的東西

- [x] **聯絡信箱**：已填入 mypetlifedaily@gmail.com（docs/privacy.html、docs/index.html、App 內隱私說明）。
- [x] **GitHub Pages 已開啟**（main 分支 `/docs`）：
  - 隱私權政策網址：`https://goingtang.github.io/petlife/privacy.html`
  - 支援網址（含常見問題）：`https://goingtang.github.io/petlife/`
- [ ] **商店文字**：見 `store-listing.md`（名稱、副標、簡短說明、完整說明、關鍵字、截圖腳本）。
- [ ] **App 名稱**：商店顯示名稱建議「PetPal 寵物生活」（App 圖示下方仍顯示 PetPal）。先到兩個商店搜尋確認沒有撞名。
- [ ] **Google 地圖金鑰（Android 地圖檢視）**：在 Google Cloud 啟用 Maps SDK for Android 建立金鑰，存成 EAS 環境變數（不要提交到 GitHub）。沒有金鑰時 Android 版地圖空白，清單檢視不受影響。

## 3. 打包（EAS Build）

在電腦上，`mobile` 資料夾裡：

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas init
```

Android 測試版（APK，可直接安裝到手機）：

```bash
eas build -p android --profile preview
```

正式版（Android 會產生 AAB、iOS 會產生 IPA，都在 Expo 雲端打包，不需要 Mac）：

```bash
eas build -p android --profile production
```

```bash
eas build -p ios --profile production
```

第一次打包 iOS 時，EAS 會請你登入 Apple 帳號並自動建立憑證。版本號由 EAS 遠端管理，每次 production 打包會自動加一。

> `eas init` 會建立 Expo 專案並給一組 projectId。因為這個專案有 `app.config.js`，EAS 可能無法自動寫回設定；如果它提示要手動加入，請把 `"extra": { "eas": { "projectId": "（EAS 給的 ID）" } }` 加到 `app.json` 的 `expo` 底下。

## 4. 送審（EAS Submit）

```bash
eas submit -p ios --latest
```

```bash
eas submit -p android --latest
```

- iOS：上傳後到 App Store Connect 的 TestFlight 先自己測，再送審。
- Android：
  1. **第一次的 AAB 要手動上傳**：在 Play Console 建立 App，到「測試 → 封閉測試」建立測試群組，把 `eas build` 產生的 .aab 檔上傳。
  2. 之後要用 `eas submit` 自動上傳，需要 Google 服務帳戶金鑰：Play Console →「設定 → API 存取權」連結 Google Cloud 專案、建立服務帳戶並授予「發布管理員」權限、下載 JSON 金鑰，放在 `mobile/` 外面或用 EAS 憑證管理（`eas credentials`），**不要提交到 GitHub**。
  3. `eas.json` 目前設定上傳到「內部測試」軌道（`"track": "internal"`）。封閉測試期間要上傳到封閉測試時，把它改成 `"alpha"`；正式上架時改成 `"production"`。

## 5. 隱私表單怎麼填

依據 `docs/privacy.html` 的內容（兩邊要一致）。

### App Store「App 隱私權」
- 開發者是否蒐集資料：**否（Data Not Collected）**。
  理由：本 App 沒有伺服器、沒有分析與廣告 SDK；附近地點的查詢是使用者主動操作、即時查詢且不保存，問 AI 是使用者確認後自行開啟外部服務。
- 隱私權政策網址：`https://goingtang.github.io/petlife/privacy.html`

### Google Play「資料安全性」
建議用保守填法：
- **位置 → 大概位置**：會收集；僅暫時處理（不儲存）；用途「應用程式功能」；選填（使用者可以不用附近地點功能）。
- 其他資料類型（個人資訊、照片、健康資訊等）：**不收集**（只存在手機上，不會傳出）。
- 資料是否分享給第三方：否（使用者主動操作的傳輸屬於例外）。
- 傳輸是否加密：是（HTTPS）。
- 使用者能否要求刪除資料：可以，在 App 內「設定 → 清除所有資料」。
- 隱私權政策網址同上。

### Google Play 其他必填聲明（「政策 → 應用程式內容」）
- **健康應用程式聲明**：照實填寫。重點：本 App 記錄的是**寵物**的照護與健康資訊，不提供人類醫療或健康功能、不連接醫療器材、不是醫療器材軟體。問卷的選項以當下 Play Console 顯示為準；沒有完全符合的類別時，選最接近的「其他」並說明「寵物照護紀錄與提醒，非人類健康用途」。
- **政府應用程式**：否。
- **金融功能**：無（花費記帳只是使用者自己記錄的數字，沒有付款、借貸或投資功能）。
- **廣告**：本 App 不含廣告。
- **新聞應用程式**：否。
- **目標對象與內容**：18 歲以上（見第 8 節）。

### 權限說明
- 只有「使用期間」定位，沒有背景定位；不使用麥克風（`app.json` 已封鎖這兩個權限）。
- iOS 已宣告不使用非豁免加密，送審時不會再問出口合規問題。

## 6. 商店素材

| 項目 | App Store | Google Play |
|---|---|---|
| 圖示 | 1024×1024（從 `assets/icon.png` 自動產生） | 512×512 PNG |
| 截圖 | iPhone 6.9 吋（1320×2868 或 1290×2796），3–10 張 | 手機截圖至少 2 張 |
| 主視覺 | — | 1024×500 |
| 簡短說明 | 副標題 30 字內 | 80 字內 |
| 完整說明 | 4000 字內 | 4000 字內 |

截圖建議順序：今天頁（照護打卡）→ 健康與提醒 → 用藥打卡 → 緊急求助 → 有毒查詢 → 花費記帳。可以先載入「範例資料」再截圖，但**畫面上不要出現範例資料提示列與假電話**，也不要出現其他品牌名稱。

說明文字注意：
- 不要寫「診斷」「治療」「保證」等字；用「記錄」「提醒」「參考」。
- 不要提還沒有的功能（例如雲端同步、訂閱）。

## 7. 審核備註（給審核人員）

送 App Store 時，在「審核資訊 → 備註」貼上：

```
PetPal is a local-only pet care log. No account or login is required.
To see every feature with data, tap "使用範例資料" (Use sample data) on the first screen.
The sample phone numbers are fictional and dialing them is blocked in the app.
"附近地點" (Nearby places) first explains the use and asks for location only after the user taps "使用目前位置"; once allowed, it locates automatically when that screen is opened. Coordinates are rounded to ~100 m and sent to public OpenStreetMap-based services.
"症狀檢查 · 問 AI" (Symptom check) is rule-based and shows a one-time disclaimer; it does not diagnose.
"問 AI" only opens the user's chosen AI website after a confirmation dialog listing the data to be shared.
No data is sent to the developer; there is no backend.
```

## 8. 分級

- App Store：年齡分級問卷照實填寫（無暴力、無使用者互動內容、無賭博；含一般醫療／健康資訊，頻率為「偶爾」）。
- Google Play：在「內容分級」填 IARC 問卷；類別選「參考資料、新聞或教育」或「生活風格」。
- 「目標對象」選 18 歲以上（或 13 歲以上），避免適用兒童專屬政策。
- App Store 問卷「不受限制的網頁存取」：選「否」。App 只會用系統瀏覽器開啟固定網址（使用者選的 AI 網站、蝦皮搜尋、地圖），沒有內建可任意瀏覽的網頁瀏覽器。

## 9. 送審前檢查清單

- [ ] `npx tsc --noEmit`、`npm test`、`npx expo-doctor` 全部通過
- [ ] 用 preview 版 APK 在實機走過：新增寵物、打卡、用藥通知、附近地點、拍照、分享 PDF、備份（.zip 含照片）存到 Google 雲端硬碟後在另一台手機還原、點通知是否開到對的頁面、清除所有資料
- [ ] iOS 用 TestFlight 走過同樣流程
- [ ] 隱私權政策網址打得開，聯絡信箱已填
- [ ] App 內「設定」顯示的版本號正確，沒有「測試版」字樣
- [ ] 截圖與說明文字沒有範例電話、沒有誇大療效
