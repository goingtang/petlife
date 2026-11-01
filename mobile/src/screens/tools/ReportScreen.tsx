import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Btn, Card, Chip, ChipRow, Segment, PetChips, Section, Sub, Row, Label } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet, memberName } from '../../lib/store';
import { KIND_LABEL, SEX_LABEL, entriesFor, entrySummary, latestGrowth, medActiveOn, reminderLabel, REPEAT_LABEL } from '../../lib/domain';
import { addMonths, ageText, today } from '../../lib/date';
import { copyText, esc, imageDataUri, pdfShell, sharePdf } from '../../lib/files';

const RANGES = [
  { value: '3', label: '近 3 個月' },
  { value: '6', label: '近 6 個月' },
  { value: '12', label: '近 1 年' },
];
const SECS = ['基本資料', '疫苗與提醒', '體重紀錄', '用藥', '看診與用藥紀錄', '症狀紀錄'] as const;
type Sec = (typeof SECS)[number];

export default function ReportScreen(_: { params: any }) {
  const { store, petId, setPetId, toast } = useStore();
  const pet = usePet();
  const [range, setRange] = useState('6');
  const [on, setOn] = useState<Record<Sec, boolean>>(Object.fromEntries(SECS.map((k) => [k, true])) as Record<Sec, boolean>);
  const [busy, setBusy] = useState(false);
  const td = today();

  const blocks = useMemo(() => {
    if (!pet) return [];
    const from = addMonths(td, -Number(range));
    const inR = (at: string) => at.slice(0, 10) >= from;
    const out: { title: string; rows: [string, string][] }[] = [];
    if (on['基本資料']) {
      const g = latestGrowth(store, pet.id);
      out.push({
        title: '基本資料',
        rows: [
          ['名字', pet.name],
          ['種類／品種', `${KIND_LABEL[pet.kind]}${pet.breed ? ' · ' + pet.breed : ''}`],
          ['性別', `${SEX_LABEL[pet.sex]}${pet.neutered ? '（已結紮）' : ''}`],
          ['生日／年齡', pet.birthday ? `${pet.birthday.replace(/-/g, '/')}（${ageText(pet.birthday)}）` : '不詳'],
          ['晶片號碼', pet.chip || '未登記'],
          ['過敏', pet.allergy || '無'],
          ['目前體重', g ? `${g.weight} kg` : '尚未記錄'],
        ],
      });
    }
    if (on['疫苗與提醒']) {
      const rs = store.reminders.filter((r) => r.petId === pet.id).sort((a, b) => (a.date < b.date ? -1 : 1));
      out.push({
        title: '疫苗與提醒',
        rows: rs.map((r) => {
          const last = (r.history || []).slice(-1)[0];
          return [r.title, `${last ? '上次 ' + last.replace(/-/g, '/') + '；' : ''}${r.repeat === 'once' && r.doneOnce ? '已完成' : '下次 ' + r.date.replace(/-/g, '/') + '（' + reminderLabel(r) + '）'} · ${REPEAT_LABEL[r.repeat]}`];
        }),
      });
    }
    if (on['體重紀錄']) {
      const g = entriesFor(store, pet.id, 'growth').filter((e) => inR(e.at)).reverse();
      out.push({ title: '體重紀錄', rows: g.map((e) => [e.at.slice(0, 10).replace(/-/g, '/'), `${e.v.weight} kg · ${e.v.length} cm`]) });
    }
    if (on['用藥']) {
      const ms = store.meds.filter((m) => m.petId === pet.id && (medActiveOn(m, td) || (m.end ?? td) >= from));
      out.push({
        title: '用藥',
        rows: ms.map((m) => [m.name, `${[m.dose, m.times.join('/')].filter(Boolean).join(' · ')} · ${m.start.replace(/-/g, '/')} 起${m.end ? '，至 ' + m.end.replace(/-/g, '/') : '，長期'}`]),
      });
    }
    const H = entriesFor(store, pet.id, 'health').filter((e) => inR(e.at));
    if (on['看診與用藥紀錄']) {
      out.push({
        title: '看診與用藥紀錄',
        rows: H.filter((e) => e.v.hType === 'visit' || e.v.hType === 'med').map((e) => [e.at.slice(0, 10).replace(/-/g, '/'), entrySummary(e) + (e.v.note ? ' · ' + e.v.note : '')]),
      });
    }
    if (on['症狀紀錄']) {
      out.push({
        title: '症狀紀錄',
        rows: H.filter((e) => e.v.hType === 'symptom' || e.v.hType === 'poop').map((e) => [e.at.slice(0, 10).replace(/-/g, '/'), `${entrySummary(e)}（${memberName(store, e.who)}記錄）${e.v.note ? ' · ' + e.v.note : ''}`]),
      });
    }
    return out;
  }, [pet, store, range, on, td]);

  if (!pet) {
    return (
      <Screen title="健康報告" subtitle="一鍵整理給獸醫">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

  const title = `${pet.name} 健康報告`;
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? '';
  const footer = `產生日期 ${td.replace(/-/g, '/')} · 範圍 ${rangeLabel}`;

  const makePdf = async () => {
    setBusy(true);
    const img = await imageDataUri(pet.photo);
    const head = `<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px">${img ? `<img src="${img}" style="width:72px;height:72px;border-radius:36px;object-fit:cover"/>` : ''}<h1 style="flex:1">${esc(title)}</h1></div><p style="color:#7A685B;margin:0 0 8px">${esc(footer)}</p>`;
    const body =
      head +
      blocks
        .map((b) => `<h2>${esc(b.title)}</h2>${b.rows.length ? `<table>${b.rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>` : '<p style="color:#9C8B7E">沒有資料</p>'}`)
        .join('');
    await sharePdf(pdfShell(title, body), `${pet.name}-健康報告`);
    setBusy(false);
  };

  const copy = async () => {
    await copyText(`${title}\n${footer}\n` + blocks.map((b) => `\n【${b.title}】\n` + (b.rows.length ? b.rows.map(([k, v]) => `${k}  ${v}`).join('\n') : '沒有資料')).join('\n'));
    toast('已複製文字');
  };

  return (
    <Screen title="健康報告" subtitle="一鍵整理給獸醫">
      <PetChips value={petId} onChange={setPetId} />
      <Segment options={RANGES} value={range} onChange={setRange} />
      <View style={{ gap: 8 }}>
        <Label>包含內容</Label>
        <ChipRow wrap>
          {SECS.map((k) => (
            <Chip key={k} label={k} on={on[k]} onPress={() => setOn((s) => ({ ...s, [k]: !s[k] }))} />
          ))}
        </ChipRow>
      </View>

      <Section title="預覽">
        <Card style={{ gap: 14, backgroundColor: C.white }}>
          <Row style={{ justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: C.ink, paddingBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{title}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>PetPal</Text>
          </Row>
          {blocks.length ? (
            blocks.map((b) => (
              <View key={b.title} style={{ gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.accent }}>{b.title}</Text>
                {b.rows.length ? (
                  b.rows.map(([k, v], i) => (
                    <Row key={i} style={{ alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 12, color: C.sub, width: 92 }}>{k}</Text>
                      <Text style={{ fontSize: 12, color: C.ink, flex: 1 }}>{v}</Text>
                    </Row>
                  ))
                ) : (
                  <Text style={{ fontSize: 12, color: C.faint }}>沒有資料</Text>
                )}
              </View>
            ))
          ) : (
            <Sub>請至少選一個要包含的內容。</Sub>
          )}
          <Text style={{ fontSize: 11, color: C.faint }}>{footer}</Text>
        </Card>
      </Section>

      <Row>
        <Btn title={busy ? '產生中…' : '產生 PDF 分享'} style={{ flex: 1 }} onPress={makePdf} disabled={busy || !blocks.length} />
        <Btn kind="outline" title="複製文字" style={{ flex: 1 }} onPress={copy} disabled={!blocks.length} />
      </Row>
      <Sub>PDF 可以直接傳到 LINE、存到檔案，或在醫院用 AirDrop／Email 傳給獸醫。</Sub>
    </Screen>
  );
}
