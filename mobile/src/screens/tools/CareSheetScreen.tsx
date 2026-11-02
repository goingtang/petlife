import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Screen, Card, Btn, Field, DateField, PetChips, Row, Sub, Label, Toggle, Banner, Empty } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet, useDraft, memberName } from '../../lib/store';
import { tasksFor, latestGrowth, KIND_LABEL, SEX_LABEL } from '../../lib/domain';
import { addDays, ageText, daysBetween, today, weekday } from '../../lib/date';
import { shareText, sharePdf, pdfShell, esc, copyText, imageDataUri } from '../../lib/files';
import { CONTENT } from '../../data/content';
import type { Pet, Store } from '../../lib/types';

const SPI: Record<string, number> = { dog: 0, cat: 1, rabbit: 2, bird: 3, other: 0 };
const ACTIVITY: Record<string, string> = { dog: '每天至少散步 40 分鐘', cat: '每天逗貓 20 分鐘', rabbit: '每天放風 60 分鐘', bird: '每天放鳥 60 分鐘', other: '依平常習慣' };

interface Sec { title: string; rows: { k: string; v: string }[] }

function petSections(store: Store, pet: Pet, from: string, to: string): Sec[] {
  const g = latestGrowth(store, pet.id);
  const vet = store.vets[pet.id];
  const meds = store.meds.filter((m) => m.petId === pet.id && m.start <= to && (!m.end || m.end >= from));
  const contacts = store.contacts.filter((c) => c.petId === pet.id).sort((a, b) => Number(b.primary) - Number(a.primary));
  const toxic = CONTENT.toxic.filter((x) => x.lv[SPI[pet.kind] ?? 0] >= 3).slice(0, 8).map((x) => x.name);
  return [
    {
      title: '基本資料',
      rows: [
        { k: '品種', v: [pet.breed || KIND_LABEL[pet.kind], ageText(pet.birthday), SEX_LABEL[pet.sex] + (pet.neutered ? '（已結紮）' : '')].filter(Boolean).join(' · ') },
        { k: '體重', v: g ? `${g.weight} kg` : '未記錄' },
        { k: '晶片', v: pet.chip || '無' },
      ],
    },
    { title: '每日流程', rows: tasksFor(store, pet.id).map((t) => ({ k: t.time, v: t.title })) },
    { title: '用藥', rows: meds.length ? meds.flatMap((m) => m.times.map((t) => ({ k: t, v: `${m.name}${m.dose ? ' · ' + m.dose : ''}${m.end ? `（到 ${m.end.slice(5).replace('-', '/')}）` : ''}` }))) : [{ k: '', v: '期間內沒有用藥' }] },
    { title: '散步與活動', rows: [{ k: '', v: ACTIVITY[pet.kind] ?? ACTIVITY.other }] },
    { title: '過敏與禁忌', rows: [{ k: '過敏', v: pet.allergy || '無' }, { k: '絕對不能吃', v: toxic.join('、') }] },
    {
      title: '主治醫院與聯絡人',
      rows: [
        ...(vet?.name ? [{ k: '主治醫院', v: [vet.name, vet.phone, vet.addr, vet.hours].filter(Boolean).join(' · ') }] : []),
        ...contacts.map((c) => ({ k: c.rel, v: `${c.name} · ${c.phone}` })),
      ],
    },
  ].filter((s) => s.rows.length);
}

export default function CareSheetScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const [combined, setCombined] = useState(false);
  const key = combined ? 'all' : pet?.id ?? 'all';
  const sheet = store.care[key] ?? { from: today(), to: addDays(today(), 3), notes: '' };
  const from = sheet.from || today();
  const to = sheet.to || addDays(from, 3);
  const badRange = to < from;

  const setSheet = (patch: Partial<typeof sheet>) =>
    update((d) => {
      d.care[key] = { ...{ from, to, notes: sheet.notes }, ...(d.care[key] || {}), ...patch };
    });
  const [notes, setNotes] = useDraft(sheet.notes, (v) => setSheet({ notes: v }));
  const [phone, setPhone] = useDraft(store.ownerPhone, (v) => update((d) => { d.ownerPhone = v.trim(); }));

  if (!pet)
    return (
      <Screen title="照顧須知">
        <Empty text="請先新增寵物" />
      </Screen>
    );

  const pets = combined ? store.pets : [pet];
  const heading = combined ? `${store.pets.map((p) => p.name).join('、')}的照顧須知` : `${pet.name}的照顧須知`;
  const period = `${from.replace(/-/g, '/')} – ${to.replace(/-/g, '/')}`;
  const owner = memberName(store, store.ownerId);
  const er = store.erVet;
  const general: Sec[] = [
    { title: '聯絡飼主', rows: [{ k: owner, v: store.ownerPhone || '（尚未填寫電話）' }] },
    ...(er ? [{ title: '夜間／假日急診', rows: [{ k: er.name, v: [er.phone, er.addr].filter(Boolean).join(' · ') }] }] : []),
    ...(notes.trim() ? [{ title: '家中注意事項', rows: [{ k: '', v: notes.trim() }] }] : []),
  ];
  const all = pets.map((p) => ({ pet: p, secs: petSections(store, p, from, to) }));

  const plain = [
    heading,
    period,
    '',
    '謝謝你幫忙照顧！有任何狀況請先打給我。',
    ...general.map((s) => `\n【${s.title}】\n` + s.rows.map((r) => (r.k ? r.k + '  ' : '') + r.v).join('\n')),
    ...all.flatMap(({ pet: p, secs }) => [`\n=== ${p.name} ===`, ...secs.map((s) => `【${s.title}】\n` + s.rows.map((r) => (r.k ? r.k + '  ' : '') + r.v).join('\n'))]),
    '\n— PetPal',
  ].join('\n');

  const makePdf = async () => {
    if (badRange) return toast('結束日期不能早於開始日期');
    const days = Math.min(31, daysBetween(from, to) + 1);
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
    const table = (rows: Sec['rows']) => `<table>${rows.map((r) => `<tr><td class="k">${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`).join('')}</table>`;
    let body = `<h1>${esc(heading)}</h1><p>${esc(period)}</p><p>謝謝你幫忙照顧！有任何狀況請先打給我。</p>`;
    body += general.map((s) => `<h2>${esc(s.title)}</h2>${table(s.rows)}`).join('');
    for (const { pet: p, secs } of all) {
      const img = await imageDataUri(p.photo);
      body += `<div style="page-break-before:always"></div><h1>${esc(p.name)}</h1>`;
      if (img) body += `<img src="${img}" style="width:180px;height:180px;object-fit:cover;border-radius:16px">`;
      body += secs.map((s) => `<h2>${esc(s.title)}</h2>${table(s.rows)}`).join('');
      const tasks = tasksFor(store, p.id);
      if (tasks.length) {
        body += `<h2>保母每日勾選表</h2><table><tr><td class="k">項目</td>${dates.map((d) => `<td style="text-align:center">${d.slice(5).replace('-', '/')}<br>${weekday(d)}</td>`).join('')}</tr>`;
        body += tasks.map((t) => `<tr><td class="k">${esc(t.time)} ${esc(t.title)}</td>${dates.map(() => '<td style="text-align:center">☐</td>').join('')}</tr>`).join('');
        body += '</table>';
      }
    }
    await sharePdf(pdfShell(heading, body), heading);
  };

  return (
    <Screen title="照顧須知" subtitle="給保母或寄宿的說明，可分享文字或 PDF">
      <Toggle label="多隻寵物合併成一份" value={combined} onChange={setCombined} />
      {!combined ? <PetChips value={petId} onChange={setPetId} /> : null}

      <Card style={{ gap: 10 }}>
        <Label>照顧期間</Label>
        <Row gap={8}>
          <View style={{ flex: 1 }}><DateField label="開始" value={from} onChange={(v) => v && setSheet({ from: v })} /></View>
          <View style={{ flex: 1 }}><DateField label="結束" value={to} onChange={(v) => v && setSheet({ to: v })} error={badRange ? '結束日期不能早於開始日期' : null} /></View>
        </Row>
        <Field label="家中注意事項" value={notes} onChangeText={setNotes} multiline placeholder="例如：鑰匙在信箱、怕打雷要開音樂、不能上床" />
        {!store.ownerPhone ? (
          <Field label="你的電話（讓保母聯絡你）" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="例如：0912-345-678" />
        ) : null}
      </Card>
      {!er ? <Banner kind="info" text="還沒設定夜間／假日急診醫院，主治醫院休診時保母會不知道去哪裡。可以在「緊急求助」設定。" /> : null}

      <Label>保母看到的內容</Label>
      <Card style={{ gap: 14, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: C.ink }}>{heading}</Text>
        <Sub>{period}</Sub>
        <Text style={{ fontSize: 14, lineHeight: 22, color: C.body }}>謝謝你幫忙照顧！有任何狀況請先打給我。</Text>
        {general.map((s) => <SecView key={s.title} s={s} />)}
        {all.map(({ pet: p, secs }) => (
          <View key={p.id} style={{ gap: 12, borderTopWidth: 1.5, borderTopColor: C.line, paddingTop: 12 }}>
            <Row>
              {p.photo ? <Image source={{ uri: p.photo }} style={{ width: 48, height: 48, borderRadius: 24 }} /> : <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.color }} />}
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{p.name}</Text>
            </Row>
            {secs.map((s) => <SecView key={s.title} s={s} />)}
          </View>
        ))}
      </Card>

      <Row gap={8}>
        <Btn title="分享文字" style={{ flex: 1 }} disabled={badRange} onPress={() => shareText(plain, heading)} />
        <Btn kind="outline" title="產生 PDF" style={{ flex: 1 }} disabled={badRange} onPress={makePdf} />
      </Row>
      <Btn kind="ghost" title="複製文字" onPress={() => { copyText(plain); toast('已複製照顧須知'); }} />
      <Sub>PDF 內含每隻寵物的照片和保母每日勾選表，可以印出來放在家裡。</Sub>
    </Screen>
  );
}

function SecView({ s }: { s: Sec }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>{s.title}</Text>
      {s.rows.map((r, i) => (
        <Row key={i} gap={10} style={{ alignItems: 'flex-start', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.lineSoft }}>
          {r.k ? <Text style={{ minWidth: 56, fontSize: 13, color: C.sub, fontWeight: '600' }}>{r.k}</Text> : null}
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: C.ink }}>{r.v}</Text>
        </Row>
      ))}
    </View>
  );
}
