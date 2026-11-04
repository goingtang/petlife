import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useStore, usePet, memberName, memberColor } from '../lib/store';
import { useNav } from '../nav';
import { Avatar, Badge, Banner, Btn, Card, Chip, ChipRow, Empty, ListCard, P, Progress, Row, Screen, Section, Sub } from '../ui/kit';
import { C } from '../ui/theme';
import { dateLabel, greeting, today, relTime, ageText, shortDate, hm } from '../lib/date';
import { tasksFor, doneBy, entriesFor, entrySummary, reminderState, reminderLabel, completeReminder, KIND_LABEL, SEX_LABEL, backupNudge, weeklyPick } from '../lib/domain';
import type { Reminder } from '../lib/types';
import { allArticles } from '../data/content-articles';
import { applyDose, doseProgress, doseToast, dosesDue, nextDose } from '../lib/doses';
import { askPermission } from '../lib/notify';

export default function TodayScreen() {
  const { store, update, toast, setPetId } = useStore();
  const pet = usePet();
  const nav = useNav();
  const td = today();
  // Re-render once a minute so 下一件事 and 已過時間 follow the clock while the screen stays open.
  const [now, setNow] = useState(hm());
  useEffect(() => {
    // First tick on the next whole minute, then every minute, so 已過時間 flips right on time.
    let iv: ReturnType<typeof setInterval> | undefined;
    const to = setTimeout(() => {
      setNow(hm());
      iv = setInterval(() => setNow(hm()), 60_000);
    }, 60_000 - (Date.now() % 60_000) + 50);
    return () => {
      clearTimeout(to);
      if (iv) clearInterval(iv);
    };
  }, []);
  const [notifyHidden, setNotifyHidden] = useState(false);

  const header = (
    <Row style={{ justifyContent: 'space-between' }}>
      <Sub style={{ fontWeight: '500' }}>{dateLabel()}</Sub>
      <Row gap={6}>
        <Pressable onPress={() => nav.push('sos')} style={{ minHeight: 44, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 22, backgroundColor: C.danger, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="緊急求助">
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>SOS 緊急</Text>
        </Pressable>
      </Row>
    </Row>
  );

  if (!pet) {
    return (
      <Screen root>
        {header}
        <Text style={{ fontSize: 25, fontWeight: '700', color: C.ink, lineHeight: 34 }}>{greeting()}！先新增你的第一隻寵物吧</Text>
        <Card style={{ gap: 12, alignItems: 'flex-start' }}>
          <P>建立寵物檔案後，就能記錄餵食、健康、疫苗提醒和每日照護。</P>
          <Btn title="＋ 新增寵物" onPress={() => nav.push('petEdit', {})} />
        </Card>
      </Screen>
    );
  }

  const tasks = tasksFor(store, pet.id);
  const done = (id: string) => doneBy(store, id, td);
  const doneCount = tasks.filter((t) => done(t.id)).length;
  // 下一件事 follows the clock: the earliest task whose time has passed comes first (overdue), else the next one coming up.
  const pending = tasks.filter((t) => !done(t.id));
  const next = pending.find((t) => t.time <= now) ?? pending.find((t) => t.time > now) ?? pending[0];
  const nextLate = !!next && next.time <= now;
  const setDone = (id: string, who: string | null) =>
    update((d) => {
      const day = { ...(d.taskDone[td] || {}) };
      if (who) day[id] = who;
      else delete day[id];
      d.taskDone[td] = day;
    }, { soon: true });
  const markDone = (id: string, title: string) => {
    setDone(id, store.me);
    toast(`已完成「${title}」`, { action: { label: '復原', onPress: () => setDone(id, null) } });
  };
  const toggle = (id: string, title: string) => {
    const who = done(id);
    if (who && who !== store.me) {
      toast(`${memberName(store, who)} 已經完成了，不用再做`);
      return;
    }
    if (!who) return markDone(id, title);
    setDone(id, null);
    toast(`已取消「${title}」的完成`, { action: { label: '復原', onPress: () => setDone(id, who) } });
  };

  const rems = store.reminders
    .filter((r) => r.petId === pet.id && reminderState(r).state !== 'done')
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const rem = rems[0];
  const finishRem = (r: Reminder) => {
    const before: Reminder = JSON.parse(JSON.stringify(r));
    update((d) => {
      const x = d.reminders.find((y) => y.id === r.id);
      if (x) completeReminder(x);
    }, { soon: true });
    toast(r.repeat === 'once' ? `已完成「${r.title}」` : `已完成，下次「${r.title}」已排好`, {
      action: {
        label: '復原',
        onPress: () =>
          update((d) => {
            const i = d.reminders.findIndex((y) => y.id === r.id);
            if (i >= 0) d.reminders[i] = before;
          }),
      },
    });
  };

  const { total: doseTotal, done: doseDone } = doseProgress(store, pet.id, td);

  const dose = nextDose(store, pet.id, td, now);
  const doseYesterday = !!dose && dose.day !== td;
  const doseLate = !!dose && (doseYesterday || dose.t <= now);
  const takeDose = (m: { id: string; name: string }, t: string, day: string) => {
    update((d) => applyDose(d, day, m.id, t, 'taken'), { soon: true });
    toast(doseToast(m.name, t), { action: { label: '復原', onPress: () => update((d) => applyDose(d, day, m.id, t, null), { soon: true }) } });
  };

  // One tip a week for this kind of pet ('other' gets the reptile / fish / small-mammal and general articles).
  const tips = allArticles().filter((a) => !a.kinds?.length || a.kinds.includes(pet.kind));
  const tip = weeklyPick(tips, td) ?? allArticles()[0];
  const nudge = backupNudge(store, td);
  const notifyIntroAt: string | null = store.notifyIntroAt ?? null;
  const showNotifyIntro = Platform.OS !== 'web' && !store.notifyEnabled && !store.sample && !notifyIntroAt && !notifyHidden;
  const closeNotifyIntro = () => {
    setNotifyHidden(true);
    update((d) => {
      d.notifyIntroAt = td;
    });
  };
  const enableNotify = async () => {
    const ok = await askPermission();
    if (ok) {
      update((d) => {
        d.notifyEnabled = true;
        d.notifyIntroAt = td;
      });
      setNotifyHidden(true);
      toast('已開啟通知，到時間會提醒你');
    } else {
      toast('沒有取得通知權限，可以稍後到「設定」開啟');
      closeNotifyIntro();
    }
  };
  const recent = entriesFor(store, pet.id).slice(0, 4);
  const sub = [pet.breed || KIND_LABEL[pet.kind], ageText(pet.birthday), SEX_LABEL[pet.sex] || ''].filter(Boolean).join(' · ');

  return (
    <Screen root>
      {header}
      {store.sample ? (
        <Banner kind="warn" text="目前顯示的是範例資料，電話與醫院都是虛構的。開始使用前請到設定清除範例資料。" action={{ label: '前往設定', onPress: () => nav.push('settings') }} />
      ) : null}
      {!store.sample && nudge ? (
        <Banner
          kind="warn"
          text={nudge === 'never' ? '資料只存在這支手機。建議定期匯出備份（含照片），換手機或手機遺失時才能還原。' : '已經超過 30 天沒有備份了。匯出一份備份（含照片），換手機時才能還原。'}
          action={{ label: '前往備份', onPress: () => nav.push('settings') }}
          onClose={() => update((d) => { d.backupNudgeAt = td; })}
        />
      ) : null}
      <Row style={{ alignItems: 'flex-end' }}>
        <Text style={{ flex: 1, fontSize: 24, fontWeight: '700', color: C.ink, lineHeight: 32 }}>
          {greeting()}，今天也好好照顧{pet.name}吧
        </Text>
        <Pressable onPress={() => nav.push('members')} style={{ alignItems: 'flex-end', gap: 4 }} accessibilityRole="button" accessibilityLabel="家人成員">
          <Row gap={0} style={{ paddingLeft: 8 }}>
            {store.members.slice(0, 4).map((m) => (
              <View key={m.id} style={{ marginLeft: -8, borderWidth: 2, borderColor: C.bg, borderRadius: 17 }}>
                <Avatar name={m.name} color={m.color} size={30} />
              </View>
            ))}
          </Row>
          <Sub style={{ fontSize: 12 }}>{store.members.length > 1 ? `${store.members.length} 人共同照顧` : '家人成員'}</Sub>
        </Pressable>
      </Row>

      <ChipRow>
        {store.pets.map((p) => (
          <Chip key={p.id} label={p.name} on={p.id === pet.id} onPress={() => setPetId(p.id)} style={{ paddingLeft: 5 }} leading={<Avatar name={p.name} color={p.color} size={28} photo={p.photo} textColor={C.ink} />} />
        ))}
        <Chip label="＋ 新增" onPress={() => nav.push('petEdit', {})} style={{ borderStyle: 'dashed' }} />
      </ChipRow>

      <Pressable
        onPress={() => nav.push('profile', { petId: pet.id })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 16, borderRadius: 24, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line }}
        accessibilityRole="button"
        accessibilityLabel={`${pet.name} 的檔案`}
      >
        <Avatar name={pet.name} color={pet.color} size={52} photo={pet.photo} textColor={C.ink} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: '700', color: C.ink }}>{pet.name}</Text>
          <Sub numberOfLines={1}>{sub}</Sub>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.accentDark }}>檔案 ›</Text>
      </Pressable>

      <View style={{ backgroundColor: C.ink, borderRadius: 24, padding: 16, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: nextLate ? '#F6B8A0' : C.yellow, fontSize: 12, fontWeight: '700' }}>{nextLate ? '下一件事 · 已過時間' : '下一件事'}</Text>
          <Text style={{ color: C.bg, fontSize: 19, fontWeight: '700' }}>{next ? next.title : tasks.length ? '今天的照護都完成了' : '還沒有設定每日照護'}</Text>
          {next ? <Text style={{ color: '#D8C8B4', fontSize: 13 }}>{next.time} · 輪到{memberName(store, next.who)}</Text> : null}
        </View>
        {next ? (
          <Btn small title="完成打卡" onPress={() => markDone(next.id, next.title)} style={{ backgroundColor: C.yellow, minHeight: 46, borderRadius: 23 }} textStyle={{ color: C.ink, fontSize: 15 }} />
        ) : !tasks.length ? (
          <Btn small title="設定" onPress={() => nav.push('tasks', { petId: pet.id })} style={{ backgroundColor: C.yellow }} textStyle={{ color: C.ink }} />
        ) : null}
      </View>
      {tasks.length ? (
        <Row>
          <View style={{ flex: 1 }}>
            <Progress pct={(doneCount / tasks.length) * 100} />
          </View>
          <Text style={{ fontWeight: '700', color: C.ink }}>
            {doneCount}/{tasks.length}
          </Text>
        </Row>
      ) : null}

      {showNotifyIntro ? (
        <Card style={{ gap: 10, backgroundColor: C.blueBg, borderWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>要開啟提醒通知嗎？</Text>
          <P style={{ fontSize: 14 }}>到時間會在手機上提醒你餵藥、照護項目，疫苗與驅蟲到期前一晚也會通知。通知只在這支手機上排定，不會傳到網路。</P>
          <Row gap={8}>
            <Btn small title="開啟通知" onPress={enableNotify} style={{ flex: 1 }} />
            <Btn small kind="soft" title="之後再說" onPress={closeNotifyIntro} style={{ flex: 1 }} />
          </Row>
        </Card>
      ) : null}

      <Section title="今日照護" action={{ label: '＋ 記錄', kind: 'primary', onPress: () => nav.push('logPicker') }}>
        {tasks.length ? (
          <ListCard>
            {tasks.map((t) => {
              const who = done(t.id);
              const w = who || t.who;
              return (
                <Pressable key={t.id} onPress={() => toggle(t.id, t.title)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 }} accessibilityRole="checkbox" accessibilityState={{ checked: !!who }} accessibilityLabel={t.title}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: who ? C.green : '#CDBBA6', backgroundColor: who ? C.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {who ? <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: who ? C.faint : C.ink, textDecorationLine: who ? 'line-through' : 'none' }}>{t.title}</Text>
                    <Sub style={{ fontSize: 12, color: !who && t.time <= now ? C.danger : C.sub }}>
                      {who ? `${memberName(store, who)}已完成` : `${t.time}${t.time <= now ? ' · 已過時間' : ''} · 輪到${memberName(store, t.who)}`}
                    </Sub>
                  </View>
                  <Avatar name={memberName(store, w)} color={memberColor(store, w)} size={26} />
                </Pressable>
              );
            })}
          </ListCard>
        ) : (
          <Empty text="還沒有設定每日照護項目" action={{ label: '設定照護項目', onPress: () => nav.push('tasks', { petId: pet.id }) }} />
        )}
        {tasks.length ? <Btn small kind="ghost" title="編輯照護項目與輪值" onPress={() => nav.push('tasks', { petId: pet.id })} style={{ alignSelf: 'flex-start' }} /> : null}
      </Section>

      {rem ? (
        <Card style={{ backgroundColor: reminderState(rem).state === 'overdue' ? C.dangerBg : C.yellowBg, borderWidth: 0, gap: 12 }}>
          <Pressable onPress={() => nav.push('form', { form: 'reminder', petId: pet.id, editId: rem.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }} accessibilityRole="button" accessibilityLabel={`${rem.title}，${reminderLabel(rem)}，點一下修改`}>
            <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{shortDate(rem.date)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: reminderState(rem).state === 'overdue' ? C.danger : '#8A6416' }}>{reminderLabel(rem)}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{rem.title}</Text>
            </View>
          </Pressable>
          <Row gap={8}>
            <Btn small title="完成" onPress={() => finishRem(rem)} style={{ flex: 1 }} />
            <Btn small kind="soft" title="全部提醒" onPress={() => nav.setTab('health')} style={{ flex: 1 }} />
          </Row>
        </Card>
      ) : null}

      {doseTotal ? (
        <Card style={{ gap: 10 }}>
          <Pressable onPress={() => nav.push('meds')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityRole="button" accessibilityLabel={`今天的用藥，已完成 ${doseDone} / ${doseTotal}，點一下看全部`}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>今天的用藥</Text>
              <Sub numberOfLines={1}>{[...new Set(dosesDue(store, pet.id, td).map(({ m }) => m.name))].join('、')}</Sub>
            </View>
            <Badge text={`${doseDone}/${doseTotal}`} bg={doseDone === doseTotal ? C.greenBg : C.yellowBg} fg={doseDone === doseTotal ? C.greenDark : C.yellowInk} />
          </Pressable>
          {dose ? (
            <Row style={{ borderTopWidth: 1.5, borderTopColor: C.lineSoft, paddingTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{dose.t} {dose.m.name}</Text>
                <Sub style={{ fontSize: 12, color: doseLate ? C.danger : C.sub }}>{[dose.m.dose, doseYesterday ? '昨晚的劑量' : doseLate ? '已過時間' : '下一次'].filter(Boolean).join(' · ')}</Sub>
              </View>
              <Btn small title="打卡" style={{ backgroundColor: C.greenDark }} onPress={() => takeDose(dose.m, dose.t, dose.day)} accessibilityLabel={`${dose.t} ${dose.m.name} 打卡`} />
            </Row>
          ) : null}
        </Card>
      ) : null}

      <Card onPress={() => nav.push('article', { id: tip.id })} style={{ backgroundColor: C.greenBg, borderWidth: 0, gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.greenDark }}>新手小知識</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{tip.title}</Text>
        <P style={{ fontSize: 13 }}>{tip.lead}</P>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.greenDark }}>閱讀全文 ›</Text>
      </Card>

      <Section title="最近紀錄">
        {recent.length ? (
          recent.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => (e.form === 'activity' ? nav.setTab('act') : nav.push('form', { form: e.form, petId: pet.id, editId: e.id }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, padding: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line }}
              accessibilityRole="button"
              accessibilityLabel={`${relTime(e.at)} ${entrySummary(e)}，點一下編輯`}
            >
              <Text style={{ width: 70, fontSize: 13, color: C.sub }}>{relTime(e.at)}</Text>
              <Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{entrySummary(e)}</Text>
              <Sub style={{ fontSize: 12 }}>{memberName(store, e.who)}</Sub>
            </Pressable>
          ))
        ) : (
          <Empty text="還沒有紀錄，按「＋ 記錄」新增第一筆" />
        )}
      </Section>
    </Screen>
  );
}
