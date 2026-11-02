import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Btn, Card, Chip, ChipRow, Segment, PetChips, Section, Sub, Row, Label, Field, Toggle, Empty } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet, memberName } from '../../lib/store';
import { KIND_LABEL, SEX_LABEL, adherence, entriesFor, entrySummary, medActiveOn, reminderLabel, REPEAT_LABEL } from '../../lib/domain';
import { addDays, addMonths, ageText, parseYmd, today } from '../../lib/date';
import { copyText, esc, imageDataUri, pdfShell, sharePdf } from '../../lib/files';
import type { Entry, Med } from '../../lib/types';
import { freqText } from '../../lib/health';

const RANGES = [
  { value: '3', label: '近 3 個月' },
  { value: '6', label: '近 6 個月' },
  { value: '12', label: '近 1 年' },
];
const SECS = ['基本資料', '主治醫院', '疫苗與預防', '完整疫苗歷史', '證件與保單到期', '體重紀錄', '體重趨勢圖', '用藥', '服藥率', '看診與用藥紀錄', '症狀紀錄'] as const;
type Sec = (typeof SECS)[number];
/** Sections that always show the current state, whatever range is picked. */
const NO_RANGE: Sec[] = ['基本資料', '主治醫院', '疫苗與預防', '完整疫苗歷史', '證件與保單到期', '服藥率'];
// 疫苗與預防 lists vaccines plus deworming/heartworm/flea prevention; other reminders (grooming, check-ups) are left out.

interface Block {
  title: string;
  rows: [string, string][];
  note?: string;
  svg?: string;
}

const fmt = (d: string) => d.slice(0, 10).replace(/-/g, '/');

function weightSvg(all: { at: string; w: number }[]): string {
  const points = all.filter((p) => Number.isFinite(p.w) && p.w > 0);
  if (points.length < 2) return '';
  const W = 500;
  const H = 170;
  const t0 = parseYmd(points[0].at).getTime();
  const t1 = parseYmd(points[points.length - 1].at).getTime();
  const ws = points.map((p) => p.w);
  const lo = Math.min(...ws);
  const hi = Math.max(...ws);
  const pad = (hi - lo) * 0.2 || 0.2;
  const x = (at: string) => 40 + ((parseYmd(at).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 70);
  const y = (w: number) => 14 + (1 - (w - (lo - pad)) / (hi + pad - (lo - pad))) * (H - 44);
  const pts = points.map((p) => `${x(p.at).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
  const dots = points.map((p) => `<circle cx="${x(p.at).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="4" fill="#fff" stroke="#C4602F" stroke-width="2"/>`).join('');
  const labels = [points[0], points[points.length - 1]]
    .map((p, i) => `<text x="${x(p.at).toFixed(1)}" y="${H - 8}" font-size="11" fill="#7A685B" text-anchor="${i ? 'end' : 'start'}">${esc(fmt(p.at))} ${p.w}kg</text>`)
    .join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><line x1="30" y1="${H - 26}" x2="${W - 20}" y2="${H - 26}" stroke="#EADDCB"/><polyline points="${pts}" fill="none" stroke="#C4602F" stroke-width="3"/>${dots}${labels}</svg>`;
}

export default function ReportScreen(_: { params: any }) {
  const { store, update, petId, setPetId, toast } = useStore();
  const pet = usePet();
  const [mode, setMode] = useState<'full' | 'visit'>('full');
  const [range, setRange] = useState('6');
  const [on, setOn] = useState<Record<Sec, boolean>>(Object.fromEntries(SECS.map((k) => [k, true])) as Record<Sec, boolean>);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [questions, setQuestions] = useState('');
  // A different pet means different symptoms and questions.
  const [lastPet, setLastPet] = useState(petId);
  if (lastPet !== petId) {
    setLastPet(petId);
    setQuestions('');
    setPicked({});
  }
  const td = today();
  const hide = store.hideRecorder;
  const by = (e: Entry) => (hide ? '' : `（${memberName(store, e.who)}記錄）`);

  const recent14 = useMemo(
    () => (pet ? entriesFor(store, pet.id, 'health').filter((e) => e.at.slice(0, 10) >= addDays(td, -14)) : []),
    [pet, store, td],
  );

  const blocks = useMemo<Block[]>(() => {
    if (!pet) return [];
    const from = addMonths(td, -Number(range));
    const inR = (at: string) => at.slice(0, 10) >= from;
    const out: Block[] = [];
    const growthAll = entriesFor(store, pet.id, 'growth');
    const latest = growthAll[0];
    const basic: Block = {
      title: '基本資料',
      rows: [
        ['名字', pet.name],
        ['種類／品種', `${KIND_LABEL[pet.kind]}${pet.breed ? ' · ' + pet.breed : ''}`],
        ['性別', `${SEX_LABEL[pet.sex]}${pet.neutered ? '（已結紮）' : ''}`],
        ['生日／年齡', pet.birthday ? `${fmt(pet.birthday)}（${ageText(pet.birthday)}）` : '不詳'],
        ['晶片號碼', pet.chip || '未登記'],
        ['過敏', pet.allergy || '無'],
        ['目前體重', latest ? `${latest.v.weight} kg（${fmt(latest.at)}）` : '尚未記錄'],
      ],
    };
    const medRow = (m: Med): [string, string] => [m.name, `${[m.dose, freqText(m), m.times.join('/')].filter(Boolean).join(' · ')} · ${m.start.replace(/-/g, '/')} 起${m.end ? '，至 ' + m.end.replace(/-/g, '/') : '，長期'}`];
    const meds: Block = {
      title: '用藥',
      rows: store.meds.filter((m) => m.petId === pet.id && (medActiveOn(m, td) || (m.end ?? td) >= from)).map(medRow),
    };
    const currentMeds = store.meds.filter((m) => m.petId === pet.id && medActiveOn(m, td)).map(medRow);

    if (mode === 'visit') {
      out.push(basic);
      out.push({
        title: '目前症狀（近 14 天）',
        rows: recent14.filter((e) => picked[e.id] !== false).map((e) => [fmt(e.at), `${entrySummary(e)}${e.v.note ? ' · ' + e.v.note : ''}`]),
      });
      out.push({ title: '目前用藥', rows: currentMeds });
      const qs = questions.split('\n').map((q) => q.trim()).filter(Boolean);
      out.push({ title: '想問醫師的問題', rows: qs.map((q, i) => [`${i + 1}.`, q]) });
      return out;
    }

    if (on['基本資料']) out.push(basic);
    if (on['主治醫院']) {
      const v = store.vets[pet.id];
      out.push({ title: '主治醫院', rows: v?.name ? ([['醫院', v.name], ['醫師', v.doctor || '—'], ['電話', v.phone || '—'], ['地址', v.addr || '—']] as [string, string][]) : [] });
    }
    const rs = store.reminders.filter((r) => r.petId === pet.id).sort((a, b) => (a.date < b.date ? -1 : 1));
    const vaccines = rs.filter((r) => !r.docId && r.title.includes('疫苗'));
    const prevention = rs.filter((r) => !r.docId && !r.title.includes('疫苗') && /驅蟲|心絲蟲|除蚤|預防/.test(r.title));
    if (on['疫苗與預防']) {
      out.push({
        title: '疫苗與預防',
        rows: [...vaccines, ...prevention]
          .map((r) => {
            const last = (r.history || []).slice(-1)[0];
            return [r.title, `${last ? '上次 ' + fmt(last) + '；' : ''}${r.repeat === 'once' && r.doneOnce ? '已完成' : '下次 ' + fmt(r.date) + '（' + reminderLabel(r) + '）'} · ${REPEAT_LABEL[r.repeat]}`];
          }),
      });
    }
    if (on['完整疫苗歷史']) {
      const rows: [string, string][] = [];
      vaccines.forEach((r) => (r.history || []).forEach((h) => rows.push([fmt(h), r.title])));
      rows.sort((a, b) => (a[0] < b[0] ? 1 : -1));
      out.push({ title: '完整疫苗歷史', rows });
    }
    if (on['證件與保單到期']) {
      // Listed from the documents themselves, so expired ones and ones without a reminder are included.
      const docs = store.docs.filter((x) => x.petId === pet.id && x.exp).sort((a, b) => ((a.exp ?? '') < (b.exp ?? '') ? -1 : 1));
      out.push({
        title: '證件與保單到期',
        rows: docs.map((x) => {
          const left = Math.round((parseYmd(x.exp!).getTime() - parseYmd(td).getTime()) / 864e5);
          return [x.title, `${fmt(x.exp!)}（${left < 0 ? `已過期 ${-left} 天` : left === 0 ? '今天到期' : `${left} 天後到期`}）`];
        }),
      });
    }
    const g = growthAll.filter((e) => inR(e.at)).reverse();
    if (on['體重紀錄']) {
      out.push({ title: '體重紀錄', rows: g.map((e) => [fmt(e.at), [e.v?.weight ? `${e.v.weight} kg` : null, e.v?.length ? `${e.v.length} cm` : null].filter(Boolean).join(' · ') || '—']) });
    }
    if (on['體重趨勢圖']) {
      const svg = weightSvg(g.map((e) => ({ at: e.at.slice(0, 10), w: Number(e.v.weight) })));
      out.push({ title: '體重趨勢圖', rows: [], svg, note: svg ? undefined : '這段期間體重紀錄少於兩筆，無法畫圖。' });
    }
    if (on['用藥']) out.push(meds);
    if (on['服藥率']) {
      const a = adherence(store, pet.id);
      out.push({ title: '服藥率', rows: a.pct === null ? [] : [['近 7 天', `${a.pct}%（已服用 ${a.taken} / 應服 ${a.sched} 次）`]] });
    }
    const H = entriesFor(store, pet.id, 'health').filter((e) => inR(e.at));
    if (on['看診與用藥紀錄']) {
      out.push({
        title: '看診與用藥紀錄',
        rows: H.filter((e) => e.v.hType === 'visit' || e.v.hType === 'med').map((e) => [fmt(e.at), entrySummary(e) + (e.v.note ? ' · ' + e.v.note : '')]),
      });
    }
    if (on['症狀紀錄']) {
      out.push({
        title: '症狀紀錄',
        rows: H.filter((e) => e.v.hType === 'symptom' || e.v.hType === 'poop').map((e) => [fmt(e.at), `${entrySummary(e)}${by(e)}${e.v.note ? ' · ' + e.v.note : ''}`]),
      });
    }
    return out;
  }, [pet, store, range, on, td, mode, picked, questions, recent14, hide]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pet) {
    return (
      <Screen title="健康報告" subtitle="一鍵整理給獸醫">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

  const title = mode === 'visit' ? `${pet.name} 看診準備` : `${pet.name} 健康報告`;
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? '';
  const footer = mode === 'visit' ? `產生日期 ${fmt(td)}` : `產生日期 ${fmt(td)} · 紀錄範圍 ${rangeLabel}（基本資料、醫院、疫苗、證件與服藥率顯示目前狀態）`;

  const makePdf = async () => {
    setBusy(true);
    try {
      const img = await imageDataUri(pet.photo);
      const head = `<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px">${img ? `<img src="${img}" style="width:72px;height:72px;border-radius:36px;object-fit:cover"/>` : ''}<h1 style="flex:1">${esc(title)}</h1></div><p style="color:#7A685B;margin:0 0 8px">${esc(footer)}</p>`;
      const body =
        head +
        blocks
          .map(
            (b) =>
              `<h2>${esc(b.title)}</h2>${b.svg ?? ''}${
                b.rows.length ? `<table>${b.rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>` : b.svg ? '' : `<p style="color:#776557">${esc(b.note ?? '沒有資料')}</p>`
              }`,
          )
          .join('');
      const ok = await sharePdf(pdfShell(title, body), title.replace(' ', '-'));
      if (!ok) toast('PDF 沒有分享出去，可以再試一次或改用「複製文字」');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await copyText(`${title}\n${footer}\n` + blocks.filter((b) => !b.svg).map((b) => `\n【${b.title}】\n` + (b.rows.length ? b.rows.map(([k, v]) => `${k}  ${v}`).join('\n') : '沒有資料')).join('\n'));
    toast('已複製文字');
  };

  return (
    <Screen title="健康報告" subtitle="一鍵整理給獸醫">
      <PetChips value={petId} onChange={setPetId} />
      <Segment options={[{ value: 'full', label: '完整報告' }, { value: 'visit', label: '看診準備' }]} value={mode} onChange={setMode} />

      {mode === 'full' ? (
        <>
          <Segment options={RANGES} value={range} onChange={setRange} />
          <View style={{ gap: 8 }}>
            <Label>包含內容</Label>
            <ChipRow wrap>
              {SECS.map((k) => (
                <Chip key={k} label={k} on={on[k]} onPress={() => setOn((s) => ({ ...s, [k]: !s[k] }))} />
              ))}
            </ChipRow>
            <Sub>{NO_RANGE.join('、')}會顯示目前狀態，不受期間影響。</Sub>
          </View>
          <Toggle label="不顯示記錄者" hint="報告裡不列出是哪位家人記錄的" value={hide} onChange={(v) => update((d) => { d.hideRecorder = v; })} />
        </>
      ) : (
        <>
          <Section title="勾選要給醫師看的症狀（近 14 天）">
            {recent14.length ? (
              <ChipRow wrap>
                {recent14.map((e) => (
                  <Chip key={e.id} label={`${e.at.slice(5, 10).replace('-', '/')} ${entrySummary(e)}`} on={picked[e.id] !== false} onPress={() => setPicked((p) => ({ ...p, [e.id]: p[e.id] === false }))} />
                ))}
              </ChipRow>
            ) : (
              <Empty text="近 14 天沒有健康紀錄。可以先到「健康」記錄症狀。" />
            )}
          </Section>
          <Field label="想問醫師的問題（一行一個）" value={questions} onChangeText={setQuestions} multiline placeholder={'例如：吐的頻率要到多少才需要回診？\n藥膏要擦到什麼時候？'} />
        </>
      )}

      <Section title="預覽">
        <Card style={{ gap: 14, backgroundColor: C.white }}>
          <Row style={{ justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: C.ink, paddingBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink, flex: 1 }}>{title}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>PetPal</Text>
          </Row>
          {blocks.length ? (
            blocks.map((b) => (
              <View key={b.title} style={{ gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.accent }}>{b.title}</Text>
                {b.svg ? <Text style={{ fontSize: 12, color: C.sub }}>（PDF 中會顯示體重折線圖）</Text> : null}
                {b.rows.length ? (
                  b.rows.map(([k, v], i) => (
                    <Row key={i} style={{ alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 12, color: C.sub, width: 92 }}>{k}</Text>
                      <Text style={{ fontSize: 12, color: C.ink, flex: 1 }}>{v}</Text>
                    </Row>
                  ))
                ) : !b.svg ? (
                  <Text style={{ fontSize: 12, color: C.faint }}>{b.note ?? '沒有資料'}</Text>
                ) : null}
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
