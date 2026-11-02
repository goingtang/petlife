// One screen for every quick-log form: 餵食 / 健康 / 成長 / 提醒 / 日記 / 緊急聯絡人.
// params: { form, petId?, editId? }
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useStore, memberName } from '../lib/store';
import { useNav, useBackHandler } from '../nav';
import {
  Banner, Btn, Choice, DateField, Field, Label, PhotoGrid, Screen, Segment, Stepper, Sub, Toggle, confirm,
} from '../ui/kit';
import { today, hm, addDays } from '../lib/date';
import { latestGrowth, tasksFor, doneBy, primaryVetPhone, FOOD_LABEL } from '../lib/domain';
import { choosePhotos, callPhone, deleteFile, usePendingFiles } from '../lib/files';
import { uid } from '../lib/seed';
import type { Entry, JournalEntry, Reminder, Contact } from '../lib/types';

const TITLES: Record<string, string> = { feed: '餵食', health: '健康紀錄', growth: '成長紀錄', reminder: '提醒', diary: '日記', contact: '緊急聯絡人' };

const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));
const SIGNS = ['嘔吐', '腹瀉', '搔癢', '沒精神', '咳嗽', '打噴嚏', '食慾差', '跛腳', '眼睛分泌物'];
const MOODS = ['開心', '平靜', '黏人', '鬧脾氣', '不舒服'];
const ACTS = ['散步', '玩耍', '抱抱', '洗澡', '訓練', '點心', '梳毛', '一起午睡'];
const REM_PRESETS = ['狂犬病疫苗', '八合一疫苗', '三合一疫苗', '心絲蟲預防藥', '體內外驅蟲', '年度健康檢查', '回診', '剪指甲'];
const RELS = ['主治醫院', '家人', '保母', '鄰居', '其他'];

const slot = (t: string) => {
  const h = Number(t.slice(0, 2));
  return h < 11 ? 0 : h < 16 ? 1 : 2;
};
const FOOD_TASK_WORDS: Record<string, string[]> = { dry: ['乾糧'], wet: ['濕食', '罐'], hay: ['牧草'], veg: ['葉菜', '蔬菜'], water: ['水'] };

export default function FormScreen({ params }: { params: any }) {
  const { store, update, toast, afterSave } = useStore();
  const nav = useNav();
  const form: string = params.form;
  const editId: string | undefined = params.editId;
  const petId: string = params.petId ?? store.pets[0]?.id ?? '';
  const pet = store.pets.find((p) => p.id === petId);

  const existingEntry = editId ? store.entries.find((e) => e.id === editId) : undefined;
  const existingRem = editId ? store.reminders.find((r) => r.id === editId) : undefined;
  const existingJ = editId ? store.journal.find((j) => j.id === editId) : undefined;
  const existingC = editId ? store.contacts.find((c) => c.id === editId) : undefined;

  const init = useMemo(() => {
    const g = latestGrowth(store, petId);
    const ev = existingEntry?.v ?? {};
    switch (form) {
      case 'feed':
        return { food: ev.food ?? (pet?.kind === 'rabbit' ? 'hay' : 'dry'), amount: ev.amount ?? 1, appetite: ev.appetite ?? 'normal', note: ev.note ?? '' };
      case 'health':
        return { hType: ev.hType ?? 'symptom', signs: ev.signs ?? [], severity: ev.severity ?? 'mild', medName: ev.medName ?? '', clinic: ev.clinic ?? (store.vets[petId]?.name || ''), stool: ev.stool ?? 'normal', docs: ev.docs ?? [], note: ev.note ?? '' };
      case 'growth':
        return { weight: ev.weight ?? g?.weight ?? 1, length: ev.length ?? g?.length ?? 20, body: ev.body ?? 'ideal' };
      case 'reminder':
        return existingRem ? { ...existingRem } : { title: '', date: addDays(today(), 7), repeat: 'once', notify: true };
      case 'diary':
        return existingJ
          ? { ...existingJ }
          : { petId, mood: '開心', acts: [] as string[], title: '', body: '', photos: [] as string[], private: false };
      case 'contact':
        return existingC ? { ...existingC } : { name: '', rel: '主治醫院', phone: '', primary: !store.contacts.some((c) => c.petId === petId) };
    }
    return {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [v, setV] = useState<any>(init);
  const [date, setDate] = useState<string>(existingEntry ? existingEntry.at.slice(0, 10) : today());
  const [initDate] = useState(date);
  const [alsoMed, setAlsoMed] = useState(false);
  const pf = usePendingFiles();
  const dirty = JSON.stringify(v) !== JSON.stringify(init) || date !== initDate;
  useBackHandler(
    dirty
      ? () => {
          confirm('放棄未儲存的內容？', '剛才填的資料不會保存。', () => nav.pop(), '放棄');
          return true;
        }
      : null,
  );
  const addPhotos = (key: 'docs' | 'photos', max: number) =>
    choosePhotos(max - v[key].length, (u) => {
      pf.added(u);
      set(key, [...v[key], ...u].slice(0, max));
    });
  const removePhoto = (key: 'docs' | 'photos', i: number) => {
    pf.removed(v[key][i]);
    set(key, v[key].filter((_: string, j: number) => j !== i));
  };
  const [tried, setTried] = useState(false);
  const [dupOk, setDupOk] = useState(false);
  const set = (k: string, x: any) => {
    setV((o: any) => ({ ...o, [k]: x }));
    setDupOk(false);
  };

  if (!pet && form !== 'diary') {
    return (
      <Screen title={TITLES[form]}>
        <Sub>請先新增寵物。</Sub>
        <Btn title="新增寵物" onPress={() => nav.replace('petEdit', {})} />
      </Screen>
    );
  }

  // ---------- validation ----------
  const errors: Record<string, string | null> = {};
  if (form === 'health') {
    if (v.hType === 'symptom' && !v.signs.length) errors.signs = '請至少選一項';
    if (v.hType === 'med' && !v.medName.trim()) errors.medName = '請填寫藥品名稱';
    if (v.hType === 'visit' && !v.clinic.trim()) errors.clinic = '請填寫醫院';
  }
  if (form === 'reminder' && !v.title.trim()) errors.title = '請填寫提醒事項';
  if (form === 'reminder' && !v.date) errors.date = '請選擇日期';
  if (form === 'diary' && !v.title.trim()) errors.title = '請填寫標題';
  if (form === 'contact') {
    if (!v.name.trim()) errors.name = '請填寫姓名或名稱';
    if (!v.phone.trim()) errors.phone = '請填寫電話';
    else if (!/^[0-9+\-\s()#]{6,}$/.test(v.phone.trim())) errors.phone = '電話格式不正確';
  }
  const err = (k: string) => (tried ? errors[k] ?? null : null);
  const hasErr = Object.values(errors).some(Boolean);

  // Duplicate feeding guard: same food in the same part of the day already logged.
  const nowT = hm();
  const dup =
    form === 'feed' && !editId && !dupOk && date === today() && !['water', 'treat'].includes(v.food)
      ? store.entries
          .filter((e) => e.petId === petId && e.form === 'feed' && e.v.food === v.food && e.at.startsWith(date) && slot(e.at.slice(11, 16)) === slot(nowT))
          .sort((a, b) => (a.at < b.at ? 1 : -1))[0]
      : undefined;

  // Editing keeps the original time when the date is unchanged; new entries today use the current time.
  const entryAt = () => (existingEntry && existingEntry.at.startsWith(date) ? existingEntry.at : date === today() ? `${date}T${nowT}` : `${date}T12:00`);

  const submit = () => {
    setTried(true);
    if (hasErr) return;
    if (dup) return; // the warning card asks for confirmation first

    if (form === 'feed' || form === 'health' || form === 'growth') {
      const clean: any = { ...v };
      if (form === 'feed') {
        clean.note = v.note.trim();
        if (v.food === 'water') delete clean.appetite;
      }
      if (form === 'health') {
        const keep: Record<string, string[]> = { symptom: ['signs', 'severity'], med: ['medName'], visit: ['clinic', 'docs'], poop: ['stool'] };
        for (const k of ['signs', 'severity', 'medName', 'clinic', 'docs', 'stool']) if (!keep[v.hType].includes(k)) delete clean[k];
        clean.note = v.note.trim();
        if (clean.medName) clean.medName = clean.medName.trim();
        if (clean.clinic) clean.clinic = clean.clinic.trim();
      }
      update((d) => {
        if (existingEntry) {
          const e = d.entries.find((x) => x.id === existingEntry.id);
          if (e) {
            e.v = clean;
            e.at = entryAt();
          }
        } else {
          const e: Entry = { id: uid('e'), petId, form: form as Entry['form'], at: entryAt(), who: d.me, v: clean };
          d.entries.push(e);
          if (form === 'health' && v.hType === 'med' && alsoMed) {
            d.meds.push({ id: uid('m'), petId, name: clean.medName, dose: '', times: ['08:00'], start: date, end: null, notify: true, freq: 'daily', count: null, refillAt: 0 });
          }
          if (form === 'feed' && date === today()) {
            const words = FOOD_TASK_WORDS[v.food] ?? [];
            const t = tasksFor(d, petId).find((x) => !doneBy(d, x.id) && slot(x.time) === slot(nowT) && words.some((w) => x.title.includes(w)));
            if (t) d.taskDone[date] = { ...(d.taskDone[date] || {}), [t.id]: d.me };
          }
        }
      });
      pf.commit(afterSave);
      toast(existingEntry ? '已更新' : alsoMed && v.hType === 'med' && form === 'health' ? '已記錄，並加入用藥打卡（每天 08:00，可到用藥打卡修改）' : '已記錄');
      nav.pop();
      return;
    }
    if (form === 'reminder') {
      update((d) => {
        if (existingRem) {
          const r = d.reminders.find((x) => x.id === existingRem.id);
          if (r) Object.assign(r, { title: v.title.trim(), date: v.date, repeat: v.repeat, notify: v.notify, doneOnce: v.date >= today() ? false : r.doneOnce });
        } else {
          const r: Reminder = { id: uid('r'), petId, title: v.title.trim(), date: v.date, repeat: v.repeat, notify: v.notify, history: [] };
          d.reminders.push(r);
        }
      });
      toast(v.notify && !store.notifyEnabled ? '提醒已建立。到「設定」開啟通知才會跳出提醒' : '提醒已建立');
      nav.pop();
      return;
    }
    if (form === 'diary') {
      update((d) => {
        if (existingJ) {
          const j = d.journal.find((x) => x.id === existingJ.id);
          if (j) Object.assign(j, { petId: v.petId, mood: v.mood, acts: v.acts, title: v.title.trim(), body: v.body.trim(), photos: v.photos, private: v.private });
        } else {
          const j: JournalEntry = { id: uid('j'), petId: v.petId, at: `${today()}T${hm()}`, author: d.me, mood: v.mood, acts: v.acts, title: v.title.trim(), body: v.body.trim(), photos: v.photos, private: v.private };
          d.journal.push(j);
        }
      });
      pf.commit(afterSave);
      toast(existingJ ? '日記已更新' : '日記已儲存');
      nav.pop();
      return;
    }
    if (form === 'contact') {
      update((d) => {
        if (v.primary) d.contacts.forEach((c) => c.petId === petId && (c.primary = false));
        if (existingC) {
          const c = d.contacts.find((x) => x.id === existingC.id);
          if (c) Object.assign(c, { name: v.name.trim(), rel: v.rel, phone: v.phone.trim(), primary: v.primary });
        } else {
          const c: Contact = { id: uid('c'), petId, name: v.name.trim(), rel: v.rel, phone: v.phone.trim(), primary: v.primary };
          d.contacts.push(c);
        }
      });
      toast('聯絡人已儲存');
      nav.pop();
    }
  };

  const remove = () =>
    confirm('確定刪除？', '刪除後無法復原。', () => {
      const files: string[] = [...(existingEntry?.v?.docs || []), ...(existingJ?.photos || [])];
      update((d) => {
        if (existingEntry) d.entries = d.entries.filter((x) => x.id !== existingEntry.id);
        if (existingRem) d.reminders = d.reminders.filter((x) => x.id !== existingRem.id);
        if (existingJ) d.journal = d.journal.filter((x) => x.id !== existingJ.id);
        if (existingC) d.contacts = d.contacts.filter((x) => x.id !== existingC.id);
      });
      afterSave(() => files.forEach((u) => deleteFile(u)));
      toast('已刪除');
      nav.pop();
    });

  const vet = primaryVetPhone(store, petId);
  const title = (editId ? '編輯' : '') + TITLES[form];
  const subtitle = form === 'diary' ? undefined : pet ? `幫${pet.name}記錄` : undefined;

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      footer={
        <View style={{ gap: 8 }}>
          <Btn title={form === 'feed' || form === 'health' ? '儲存' : '儲存'} onPress={submit} />
          {editId ? <Btn kind="danger" title="刪除" onPress={remove} /> : null}
        </View>
      }
    >
      {(form === 'feed' || form === 'health' || form === 'growth') && (
        <DateField label="日期" value={date} onChange={(x) => x && setDate(x)} max={today()} />
      )}

      {form === 'feed' && (
        <>
          <View style={{ gap: 8 }}>
            <Label>種類</Label>
            <Choice options={opts(FOOD_LABEL)} value={v.food} onChange={(x) => { set('food', x); set('amount', x === 'water' ? 200 : 1); }} />
          </View>
          {v.food === 'water' ? (
            <Stepper label="份量" value={v.amount} onChange={(x) => set('amount', x)} step={50} min={50} unit="ml" />
          ) : (
            <Stepper label="份量" value={v.amount} onChange={(x) => set('amount', x)} step={0.5} min={0.5} decimals={1} unit="份" />
          )}
          {v.food !== 'water' && (
            <View style={{ gap: 8 }}>
              <Label>食慾</Label>
              <Segment options={[{ value: 'good', label: '很好' }, { value: 'normal', label: '普通' }, { value: 'poor', label: '不太吃' }]} value={v.appetite} onChange={(x) => set('appetite', x)} />
            </View>
          )}
          <Field label="備註" value={v.note} onChangeText={(t) => set('note', t)} placeholder="例如：剩下一半" />
          {dup ? (
            <Banner
              kind="danger"
              text={`${memberName(store, dup.who)} ${dup.at.slice(11, 16)} 已經餵過${FOOD_LABEL[v.food]}了。確定還要再記一次嗎？重複餵食容易造成肥胖或腸胃不適。`}
              action={{ label: '仍要記錄', onPress: () => setDupOk(true) }}
            />
          ) : null}
        </>
      )}

      {form === 'health' && (
        <>
          <Segment options={[{ value: 'symptom', label: '症狀' }, { value: 'med', label: '用藥' }, { value: 'visit', label: '看診' }, { value: 'poop', label: '排便' }]} value={v.hType} onChange={(x) => set('hType', x)} />
          {v.hType === 'symptom' && (
            <>
              <View style={{ gap: 8 }}>
                <Label>觀察到的狀況</Label>
                <Choice multi options={SIGNS.map((x) => ({ value: x, label: x }))} value={v.signs} onChange={(x) => set('signs', x)} />
                {err('signs') ? <Sub style={{ color: '#A0442A' }}>{err('signs')}</Sub> : null}
              </View>
              <View style={{ gap: 8 }}>
                <Label>嚴重程度</Label>
                <Segment options={[{ value: 'mild', label: '輕微' }, { value: 'moderate', label: '中等' }, { value: 'severe', label: '嚴重' }]} value={v.severity} onChange={(x) => set('severity', x)} />
              </View>
              {v.severity === 'severe' ? (
                <Banner
                  kind="danger"
                  text="症狀嚴重時請直接聯絡醫院，不要只做紀錄。"
                  action={vet ? { label: `撥打 ${vet.name}`, onPress: () => callPhone(vet.phone) } : { label: '緊急求助', onPress: () => nav.push('sos') }}
                />
              ) : null}
            </>
          )}
          {v.hType === 'med' && (
            <>
              <Field label="藥品名稱" required value={v.medName} onChangeText={(t) => set('medName', t)} placeholder="例如：外用藥膏" error={err('medName')} />
              {!editId ? <Toggle label="同時加入用藥打卡" hint="每天提醒與打卡；時間、天數之後可在用藥打卡修改" value={alsoMed} onChange={setAlsoMed} /> : null}
            </>
          )}
          {v.hType === 'visit' && (
            <>
              <Field label="醫院" required value={v.clinic} onChangeText={(t) => set('clinic', t)} placeholder="例如：安心動物醫院" error={err('clinic')} />
              <View style={{ gap: 8 }}>
                <Label>收據／診斷書照片（最多 4 張）</Label>
                <PhotoGrid photos={v.docs} max={4} onRemove={(i) => removePhoto('docs', i)} onAdd={() => addPhotos('docs', 4)} />
              </View>
            </>
          )}
          {v.hType === 'poop' && (
            <View style={{ gap: 8 }}>
              <Label>狀態</Label>
              <Segment options={[{ value: 'normal', label: '正常' }, { value: 'soft', label: '偏軟' }, { value: 'hard', label: '偏硬' }]} value={v.stool} onChange={(x) => set('stool', x)} />
            </View>
          )}
          <Field label="備註" value={v.note} onChangeText={(t) => set('note', t)} multiline placeholder="醫師的說明、觀察到的細節…" />
        </>
      )}

      {form === 'growth' && (
        <>
          <Stepper label="體重" value={v.weight} onChange={(x) => set('weight', x)} step={pet?.kind === 'dog' ? 0.1 : 0.05} min={0.05} decimals={2} unit="kg" />
          <Stepper label="身長" value={v.length} onChange={(x) => set('length', x)} step={0.5} min={1} decimals={1} unit="cm" />
          <View style={{ gap: 8 }}>
            <Label>體態</Label>
            <Segment options={[{ value: 'thin', label: '偏瘦' }, { value: 'ideal', label: '理想' }, { value: 'chubby', label: '偏胖' }]} value={v.body} onChange={(x) => set('body', x)} />
          </View>
          <Sub>小技巧：先抱著{pet?.name}一起量，再減去自己的體重。每月固定同一天測量最準。</Sub>
        </>
      )}

      {form === 'reminder' && (
        <>
          <Field label="提醒事項" required value={v.title} onChangeText={(t) => set('title', t)} placeholder="例如：狂犬病疫苗" error={err('title')} />
          <Choice options={REM_PRESETS.map((x) => ({ value: x, label: x }))} value={v.title} onChange={(x) => set('title', x)} />
          <DateField label="日期" value={v.date} onChange={(x) => set('date', x)} error={err('date')} />
          <View style={{ gap: 8 }}>
            <Label>重複</Label>
            <Segment options={[{ value: 'once', label: '不重複' }, { value: 'monthly', label: '每月' }, { value: 'yearly', label: '每年' }]} value={v.repeat} onChange={(x) => set('repeat', x)} />
          </View>
          <Toggle label="手機通知提醒" hint="前一天晚上 8 點和當天早上 9 點各提醒一次" value={v.notify} onChange={(x) => set('notify', x)} />
        </>
      )}

      {form === 'diary' && (
        <>
          <View style={{ gap: 8 }}>
            <Label>寵物</Label>
            <Choice options={store.pets.map((p) => ({ value: p.id, label: p.name }))} value={v.petId} onChange={(x) => set('petId', x)} />
          </View>
          <View style={{ gap: 8 }}>
            <Label>照片（最多 4 張）</Label>
            <PhotoGrid photos={v.photos} max={4} onRemove={(i) => removePhoto('photos', i)} onAdd={() => addPhotos('photos', 4)} />
          </View>
          <View style={{ gap: 8 }}>
            <Label>今天的心情</Label>
            <Choice options={MOODS.map((x) => ({ value: x, label: x }))} value={v.mood} onChange={(x) => set('mood', x)} />
          </View>
          <View style={{ gap: 8 }}>
            <Label>今天一起做了什麼</Label>
            <Choice multi options={ACTS.map((x) => ({ value: x, label: x }))} value={v.acts} onChange={(x) => set('acts', x)} />
          </View>
          <Field label="標題" required value={v.title} onChangeText={(t) => set('title', t)} placeholder="例如：第一次去海邊" error={err('title')} />
          <Field label="今天發生了什麼？" value={v.body} onChangeText={(t) => set('body', t)} multiline placeholder="記下想留住的小事…" />
          <Toggle label="只有我看得到" hint="私密日記不會出現在其他家人的畫面" value={v.private} onChange={(x) => set('private', x)} />
        </>
      )}

      {form === 'contact' && (
        <>
          <Field label="姓名／名稱" required value={v.name} onChangeText={(t) => set('name', t)} placeholder="例如：王醫師" error={err('name')} />
          <View style={{ gap: 8 }}>
            <Label>關係</Label>
            <Choice options={RELS.map((x) => ({ value: x, label: x }))} value={v.rel} onChange={(x) => set('rel', x)} />
          </View>
          <Field label="電話" required value={v.phone} onChangeText={(t) => set('phone', t)} keyboardType="phone-pad" placeholder="例如：0912-345-678" error={err('phone')} />
          <Toggle label="設為第一聯絡人" value={v.primary} onChange={(x) => set('primary', x)} />
        </>
      )}
    </Screen>
  );
}
