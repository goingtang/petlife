import React from 'react';
import { Text, View } from 'react-native';
import { Screen, Card, Btn, Field, DateField, PetChips, Row, Empty, Sub, Label } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { tasksFor, medActiveOn } from '../../lib/domain';
import { today, addDays } from '../../lib/date';
import { shareText, sharePdf, pdfShell, esc, copyText } from '../../lib/files';
import { CONTENT } from '../../data/content';

const SPECIES: Record<string, number> = { dog: 0, cat: 1, rabbit: 2, bird: 3 };

export default function CareSheetScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  if (!pet) return <Screen title="照顧須知"><Empty text="先新增一隻寵物，就能產生給保母的照顧須知。" /></Screen>;

  const cs = store.care[pet.id] ?? { from: today(), to: addDays(today(), 3), notes: '' };
  const setC = (k: 'from' | 'to' | 'notes', v: string) =>
    update((d) => { d.care[pet.id] = { ...(d.care[pet.id] ?? cs), [k]: v }; });

  const from = cs.from || today();
  const to = cs.to || from;
  const meds = store.meds.filter((m) => m.petId === pet.id && m.start <= to && (!m.end || m.end >= from));
  const act = pet.kind === 'dog' ? '每天至少 40 分鐘散步' : pet.kind === 'cat' ? '每天逗貓 20 分鐘' : pet.kind === 'rabbit' ? '每天放風 60 分鐘' : '依平常習慣';
  const si = SPECIES[pet.kind];
  const toxic = si === undefined ? [] : CONTENT.toxic.filter((x) => x.lv[si] >= 3).slice(0, 6).map((x) => x.name);
  const vet = store.vets[pet.id];
  const contacts = store.contacts.filter((c) => c.petId === pet.id).sort((a, b) => Number(b.primary) - Number(a.primary));

  const sections: { title: string; rows: { k: string; v: string }[] }[] = [
    { title: '每日流程', rows: tasksFor(store, pet.id).map((t) => ({ k: t.time, v: t.title })) },
    { title: '用藥', rows: meds.length ? meds.map((m) => ({ k: m.times.join(' / '), v: m.name + (m.dose ? ' · ' + m.dose : '') })) : [{ k: '', v: '目前沒有用藥' }] },
    { title: '散步與活動', rows: [{ k: '', v: act }] },
    { title: '過敏與禁忌', rows: [{ k: '過敏', v: pet.allergy || '無' }, ...(toxic.length ? [{ k: '絕對不能吃', v: toxic.join('、') }] : [])] },
    {
      title: '醫院與緊急聯絡',
      rows: [
        ...(vet?.name ? [{ k: '主治醫院', v: [vet.name, vet.phone, vet.hours].filter(Boolean).join(' · ') }] : []),
        ...contacts.map((c) => ({ k: c.rel, v: `${c.name} · ${c.phone}` })),
      ],
    },
  ];
  if (cs.notes.trim()) sections.push({ title: '家中注意事項', rows: [{ k: '', v: cs.notes.trim() }] });
  const heading = `${pet.name}的照顧須知`;
  const period = `${from.replace(/-/g, '/')} – ${to.replace(/-/g, '/')}`;
  const intro = '謝謝你幫忙照顧！有任何狀況請先打給我。';
  const text = `${heading}\n${period}\n\n${intro}\n` + sections.map((x) => `\n【${x.title}】\n` + (x.rows.length ? x.rows.map((r) => (r.k ? r.k + '  ' : '') + r.v).join('\n') : '—')).join('\n');
  const html = pdfShell(heading, `<h1>${esc(heading)}</h1><p>${esc(period)}</p><p>${esc(intro)}</p>` +
    sections.map((x) => `<h2>${esc(x.title)}</h2><table>${(x.rows.length ? x.rows : [{ k: '', v: '—' }]).map((r) => `<tr><td class="k">${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`).join('')}</table>`).join(''));

  return (
    <Screen title="照顧須知" subtitle="給保母或寄宿的分享頁">
      <PetChips value={petId} onChange={setPetId} />
      <Card style={{ gap: 12 }}>
        <Label>照顧期間</Label>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><DateField label="開始" value={from} onChange={(v) => setC('from', v)} /></View>
          <View style={{ flex: 1 }}><DateField label="結束" value={to} onChange={(v) => setC('to', v)} /></View>
        </Row>
        <Field label="家中注意事項" multiline value={cs.notes} placeholder="例如：鑰匙在信箱、怕打雷要開音樂、不能上床" onChangeText={(t) => setC('notes', t)} />
      </Card>

      <Label>保母看到的內容</Label>
      <Card style={{ gap: 14, backgroundColor: '#fff' }}>
        <View>
          <Text style={{ fontSize: 21, fontWeight: '700', color: C.ink }}>{heading}</Text>
          <Sub>{period}</Sub>
        </View>
        <Text style={{ fontSize: 14, lineHeight: 21, color: C.body }}>{intro}</Text>
        {sections.map((sec) => (
          <View key={sec.title} style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>{sec.title}</Text>
            {sec.rows.length ? sec.rows.map((r, i) => (
              <Row key={i} style={{ alignItems: 'flex-start', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.lineSoft }}>
                {r.k ? <Text style={{ minWidth: 56, fontSize: 13, fontWeight: '600', color: C.sub }}>{r.k}</Text> : null}
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: C.ink }}>{r.v}</Text>
              </Row>
            )) : <Sub>尚未設定</Sub>}
          </View>
        ))}
      </Card>

      <Btn title="分享文字（LINE 等）" onPress={() => shareText(text, heading)} />
      <Row>
        <Btn kind="outline" title="產生 PDF" style={{ flex: 1 }} onPress={() => sharePdf(html, `${pet.name}-照顧須知`)} />
        <Btn kind="outline" title="複製文字" style={{ flex: 1 }} onPress={() => { copyText(text); toast('已複製照顧須知'); }} />
      </Row>
    </Screen>
  );
}
