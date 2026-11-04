import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Polygon, Text as SvgText } from 'react-native-svg';
import { useStore, usePet, memberName } from '../lib/store';
import { useNav, useBackHandler } from '../nav';
import { Badge, Btn, Card, Empty, ListCard, PetChips, Row, Screen, Section, Sub, Thumb } from '../ui/kit';
import { C } from '../ui/theme';
import { parseYmd, relTime, shortDate, today } from '../lib/date';
import { entriesFor, entrySummary, reminderState, reminderLabel, completeReminder, REPEAT_LABEL } from '../lib/domain';

const STATE_COLORS = {
  overdue: [C.dangerBg, C.danger],
  today: [C.dangerBg, C.danger],
  soon: [C.yellowBg, C.yellowInk],
  later: [C.sand, '#5E4E42'],
  done: [C.greenBg, C.greenDark],
} as const;

function WeightChart({ points }: { points: { at: string; w: number }[] }) {
  const W = 300;
  const H = 120;
  if (points.length < 2) return null;
  const t0 = parseYmd(points[0].at).getTime();
  const t1 = parseYmd(points[points.length - 1].at).getTime();
  const ws = points.map((p) => p.w);
  const lo = Math.min(...ws);
  const hi = Math.max(...ws);
  const pad = (hi - lo) * 0.2 || 0.2;
  const mn = lo - pad;
  const mx = hi + pad;
  const x = (at: string) => 12 + ((parseYmd(at).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 24);
  const y = (w: number) => 10 + (1 - (w - mn) / (mx - mn)) * (H - 34);
  const pts = points.map((p) => `${x(p.at).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
  const area = `${x(points[0].at)},${H - 24} ${pts} ${x(points[points.length - 1].at)},${H - 24}`;
  const labelIdx = points.length <= 6 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={0} y1={H - 24} x2={W} y2={H - 24} stroke={C.line} strokeWidth={1.5} />
      <Polygon points={area} fill={C.yellowBg} opacity={0.6} />
      <Polyline points={pts} fill="none" stroke={C.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={x(p.at)} cy={y(p.w)} r={i === points.length - 1 ? 6 : 4} fill={C.card} stroke={C.accent} strokeWidth={2.5} />
      ))}
      {labelIdx.map((i) => (
        <SvgText key={'l' + i} x={x(points[i].at)} y={H - 8} fontSize={10} fill={C.sub} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
          {shortDate(points[i].at)}
        </SvgText>
      ))}
    </Svg>
  );
}

export default function HealthScreen() {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [open, setOpen] = useState<string | null>(null);
  const [showGrowth, setShowGrowth] = useState(false);
  const [limit, setLimit] = useState(12);
  useBackHandler(open || showGrowth ? () => (setOpen(null), setShowGrowth(false), true) : null);

  if (!pet)
    return (
      <Screen root title="健康">
        <Empty text="先新增寵物，才能記錄健康資料" action={{ label: '新增寵物', onPress: () => nav.push('petEdit', {}) }} />
      </Screen>
    );

  const growth = entriesFor(store, pet.id, 'growth');
  const asc = [...growth].reverse();
  const td = today();
  const yearAgo = `${Number(td.slice(0, 4)) - 1}${td.slice(4)}`;
  const chartPts = asc.filter((g) => g.at.slice(0, 10) >= yearAgo).map((g) => ({ at: g.at.slice(0, 10), w: Number(g.v.weight) }));
  const latest = growth[0];
  const prev = growth[1];
  const delta = latest && prev ? Number(latest.v.weight) - Number(prev.v.weight) : 0;
  const pct = latest && prev && Number(prev.v.weight) ? (delta / Number(prev.v.weight)) * 100 : 0;
  const deltaColor = Math.abs(pct) >= 10 ? [C.dangerBg, C.danger] : Math.abs(pct) >= 5 ? [C.yellowBg, C.yellowInk] : [C.greenBg, C.greenDark];

  const rems = store.reminders
    .filter((r) => r.petId === pet.id)
    .sort((a, b) => {
      const sa = reminderState(a).state === 'done' ? 1 : 0;
      const sb = reminderState(b).state === 'done' ? 1 : 0;
      return sa - sb || (a.date < b.date ? -1 : 1);
    });
  const allHealth = entriesFor(store, pet.id, 'health');
  const health = allHealth.slice(0, limit);

  return (
    <Screen root title="健康">
      <PetChips value={petId} onChange={setPetId} />

      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Sub style={{ fontWeight: '500' }}>體重</Sub>
            <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 38, fontWeight: '700', color: C.ink }}>
              {latest ? Number(latest.v.weight) : '–'}
              <Text style={{ fontSize: 15, color: C.sub, fontWeight: '400' }}> kg</Text>
            </Text>
            {latest ? <Sub style={{ fontSize: 12 }}>{relTime(latest.at)} 記錄</Sub> : null}
          </View>
          {prev ? (
            <Badge
              text={`${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(2).replace(/\.?0+$/, '')} kg（${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%）`}
              bg={deltaColor[0]}
              fg={deltaColor[1]}
            />
          ) : null}
        </Row>
        {chartPts.length >= 2 ? <WeightChart points={chartPts} /> : <Sub>記錄兩次以上就會顯示體重變化圖。</Sub>}
        {Math.abs(pct) >= 10 ? <Sub style={{ color: C.danger }}>與上次相比變化超過 10%，建議諮詢獸醫。</Sub> : null}
        <Row gap={8}>
          <Btn kind="outline" title="記錄成長數據" onPress={() => nav.push('form', { form: 'growth', petId: pet.id })} style={{ flex: 1 }} />
          {growth.length ? <Btn kind="ghost" small title={showGrowth ? '收合' : '全部紀錄'} onPress={() => setShowGrowth(!showGrowth)} /> : null}
        </Row>
        {showGrowth
          ? growth.map((g) => (
              <Pressable key={g.id} onPress={() => nav.push('form', { form: 'growth', petId: pet.id, editId: g.id })} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.lineSoft }}>
                <Sub>{g.at.slice(0, 10).replace(/-/g, '/')}</Sub>
                <Text style={{ color: C.ink, fontSize: 14 }}>{entrySummary(g)} ›</Text>
              </Pressable>
            ))
          : null}
      </Card>

      <Row gap={8}>
        {[
          ['用藥打卡', 'meds', C.greenBg],
          ['健康報告', 'report', C.blueBg],
          ['文件夾', 'docs', C.yellowBg],
        ].map(([t, r, bg]) => (
          <Pressable key={r} onPress={() => nav.push(r)} style={{ flex: 1, minHeight: 56, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button">
            <Text style={{ fontWeight: '700', color: C.ink, fontSize: 14 }}>{t}</Text>
          </Pressable>
        ))}
      </Row>

      <Section title="疫苗與提醒" action={{ label: '＋ 提醒', onPress: () => nav.push('form', { form: 'reminder', petId: pet.id }) }}>
        {rems.length ? (
          <ListCard>
            {rems.map((r) => {
              const st = reminderState(r).state;
              const [bg, fg] = STATE_COLORS[st];
              const last = r.history?.length ? r.history[r.history.length - 1] : null;
              return (
                <Pressable key={r.id} onPress={() => nav.push('form', { form: 'reminder', petId: pet.id, editId: r.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 }} accessibilityRole="button" accessibilityLabel={`${r.title}，${reminderLabel(r)}`}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: st === 'done' ? C.faint : C.ink }}>{r.title}</Text>
                    <Sub style={{ fontSize: 12 }}>
                      {r.date.replace(/-/g, '/')} · {REPEAT_LABEL[r.repeat]}
                      {last ? ` · 上次完成 ${last.slice(0, 4) === td.slice(0, 4) ? shortDate(last) : last.replace(/-/g, '/')}` : ''}
                      {r.notify && st !== 'done' && store.notifyEnabled ? ' · 會通知' : ''}
                    </Sub>
                  </View>
                  <Badge text={reminderLabel(r)} bg={bg} fg={fg} />
                  {st !== 'done' ? (
                    <Btn
                      small
                      kind="outline"
                      title="完成"
                      onPress={() => {
                        const before = JSON.parse(JSON.stringify(r));
                        update((d) => {
                          const x = d.reminders.find((y) => y.id === r.id);
                          if (x) completeReminder(x);
                        });
                        toast(r.repeat === 'once' ? `已完成「${r.title}」` : `已完成，下次提醒已排好`, {
                          action: {
                            label: '復原',
                            onPress: () =>
                              update((d) => {
                                const i = d.reminders.findIndex((y) => y.id === r.id);
                                if (i >= 0) d.reminders[i] = before;
                              }),
                          },
                        });
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ListCard>
        ) : (
          <Empty text="還沒有提醒。可以加入疫苗、驅蟲或回診日期" action={{ label: '新增提醒', onPress: () => nav.push('form', { form: 'reminder', petId: pet.id }) }} />
        )}
      </Section>

      <Section title="健康與看診紀錄" action={{ label: '＋ 紀錄', onPress: () => nav.push('form', { form: 'health', petId: pet.id }) }}>
        {health.length ? (
          health.map((e) => {
            const isOpen = open === e.id;
            const docs: string[] = e.v.docs || [];
            return (
              <Card
                key={e.id}
                onPress={() => setOpen(isOpen ? null : e.id)}
                style={{ gap: 6, padding: 14 }}
                accessibilityLabel={`${entrySummary(e)}，${relTime(e.at)}，${memberName(store, e.who)}${docs.length ? `，${docs.length} 張附件` : ''}`}
                accessibilityHint={isOpen ? '收合詳細內容' : '展開詳細內容'}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.ink }}>{entrySummary(e)}</Text>
                  <Sub style={{ fontSize: 12 }}>{relTime(e.at)}</Sub>
                </Row>
                <Sub style={{ fontSize: 12 }}>
                  {memberName(store, e.who)}
                  {docs.length ? ` · ${docs.length} 張附件` : ''}
                  {e.v.note ? (isOpen ? ' · 收合' : ' · 查看備註') : ''}
                </Sub>
                {isOpen ? (
                  <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: C.line, borderStyle: 'dashed' }}>
                    {e.v.note ? <Text style={{ fontSize: 14, lineHeight: 22, color: C.body }}>{e.v.note}</Text> : null}
                    {docs.length ? (
                      <Row gap={6}>
                        {docs.map((u) => (
                          <Thumb key={u} uri={u} label="看診照片" style={{ width: 70, height: 70, borderRadius: 12 }} />
                        ))}
                      </Row>
                    ) : null}
                    <Btn small kind="outline" title="編輯" onPress={() => nav.push('form', { form: 'health', petId: pet.id, editId: e.id })} style={{ alignSelf: 'flex-start' }} />
                  </View>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Empty text="還沒有健康紀錄" action={{ label: '新增第一筆', onPress: () => nav.push('form', { form: 'health', petId: pet.id }) }} />
        )}
        {allHealth.length > health.length ? <Btn kind="ghost" small title={`顯示更多（還有 ${allHealth.length - health.length} 筆）`} onPress={() => setLimit((n) => n + 20)} /> : null}
      </Section>
    </Screen>
  );
}
