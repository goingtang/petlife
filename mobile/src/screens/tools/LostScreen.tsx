import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Btn, Banner, PetChips, Section, Field, Sub, P, Row, Label, Card, DateField, TimeField, Toggle, confirm, Thumb } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet, initialOf } from '../../lib/store';
import { useBackHandler, useNav } from '../../nav';
import type { LostInfo, Pet, Store, Sighting } from '../../lib/types';
import { KIND_LABEL, SEX_LABEL, mapsSearch, money } from '../../lib/domain';
import { ageText, hm, today } from '../../lib/date';
import { callPhone, choosePhotos, esc, imageDataUri, openUrl, sharePdf, shareText, usePendingFiles } from '../../lib/files';
import { uid } from '../../lib/seed';

function petLine(pet: Pet) {
  return [KIND_LABEL[pet.kind], pet.breed, SEX_LABEL[pet.sex] || '', ageText(pet.birthday)].filter(Boolean).join(' · ');
}

/** "NT$3,000", or '' when no reward (empty or 0). */
function rewardText(r?: string) {
  const n = Number((r || '').replace(/[^0-9]/g, ''));
  return n > 0 ? money(n) : '';
}

function when(L: LostInfo) {
  return [L.since ? L.since.replace(/-/g, '/') : '', L.sinceTime || ''].filter(Boolean).join(' ');
}

function lostText(pet: Pet, L: LostInfo) {
  const reward = rewardText(L.reward);
  return [
    `【協尋走失寵物】${pet.name}`,
    petLine(pet),
    `走失時間：${when(L) || '不詳'}`,
    `最後出現地點：${L.place}`,
    L.time ? `補充說明：${L.time}` : '',
    L.features ? `特徵：${L.features}` : '',
    pet.chip ? `晶片號碼：${pet.chip}` : '',
    reward ? `酬謝金：${reward}` : '',
    `看到請聯絡：${L.phone}`,
    ...(L.sightings.length
      ? ['', '目擊回報：', ...[...L.sightings].sort((a, b) => (a.at < b.at ? 1 : -1)).map((s) => `・${s.at.replace('T', ' ').replace(/-/g, '/')} ${s.place}${s.note ? '（' + s.note + '）' : ''}`)]
      : []),
    '麻煩大家幫忙分享，謝謝！',
  ]
    .filter((x) => x !== '')
    .join('\n');
}

async function posterPdf(pet: Pet, L: LostInfo, bw: boolean) {
  const img = await imageDataUri(L.photo || pet.photo, 1000);
  const reward = rewardText(L.reward);
  const row = (k: string, v: string) => (v ? `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>` : '');
  const accent = bw ? '#000' : '#A0442A';
  const bg = bw ? '#fff' : /^#[0-9a-fA-F]{6}$/.test(pet.color) ? pet.color : '#EADDCB';
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:10mm}html,body{height:auto}
  body{font-family:-apple-system,'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif;margin:0;color:#000}
  .top{${bw ? 'border:6px solid #000;color:#000' : 'background:#A0442A;color:#fff'};text-align:center;font-size:46px;font-weight:800;padding:14px 0;letter-spacing:4px}
  .ph{margin:14px auto 0;width:78%;height:320px;border-radius:24px;background:${bg} center/cover no-repeat;${img ? `background-image:url('${img}');` : ''}${bw ? 'filter:grayscale(1);border:2px solid #000;' : ''}display:flex;align-items:center;justify-content:center;font-size:140px;font-weight:700}
  h1{text-align:center;font-size:44px;margin:10px 0 2px}.sub{text-align:center;font-size:18px;color:#333;margin:0 0 8px}
  table{width:82%;margin:0 auto;border-collapse:collapse;font-size:18px;page-break-inside:avoid}td{padding:5px 8px;border-bottom:1px solid ${bw ? '#999' : '#EADDCB'};vertical-align:top}td.k{color:${accent};font-weight:700;width:30%}
  .tel{margin-top:14px;page-break-inside:avoid;${bw ? 'border:6px solid #000;color:#000' : 'background:#A0442A;color:#fff'};text-align:center;font-size:32px;font-weight:800;padding:12px 0}
  </style></head><body>
  <div class="top">協尋走失寵物</div>
  <div class="ph">${img ? '' : esc(initialOf(pet.name))}</div>
  <h1>${esc(pet.name)}</h1><p class="sub">${esc(petLine(pet))}</p>
  <table>${row('走失時間', when(L))}${row('最後出現', L.place)}${row('補充說明', L.time)}${row('特徵', L.features)}${row('晶片號碼', pet.chip)}${row('酬謝金', reward)}</table>
  <div class="tel">看到請聯絡 ${esc(L.phone)}</div>
  </body></html>`;
  return sharePdf(html, `${pet.name}-協尋海報${bw ? '-黑白' : ''}`);
}

/** Default phone for the poster: the owner's own number, else the pet's primary family contact (never a vet or pet sitter). */
export function defaultPhone(store: Store, petId: string): string {
  const own = (store.ownerPhone || '').trim();
  if (own) return own;
  const ok = (c: Store['contacts'][number]) => c.petId === petId && !!c.phone.trim() && !/醫院|獸醫/.test(c.rel + c.name) && !/保母/.test(c.rel);
  const c = store.contacts.find((x) => ok(x) && x.primary) ?? store.contacts.find((x) => ok(x) && x.rel === '家人') ?? store.contacts.find(ok);
  return c?.phone.trim() ?? '';
}

function LostForm({ pet, store, initial, onSave, onCancel, dirtyRef }: { pet: Pet; store: Store; initial?: LostInfo; onSave: (info: LostInfo) => void; onCancel?: () => void; dirtyRef?: React.MutableRefObject<(() => boolean) | null> }) {
  const { afterSave } = useStore();
  const files = usePendingFiles();
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo ?? pet.photo);
  const [since, setSince] = useState(initial?.since ?? today());
  const [sinceTime, setSinceTime] = useState(initial?.sinceTime ?? hm());
  const [place, setPlace] = useState(initial?.place ?? '');
  const [time, setTime] = useState(initial?.time ?? '');
  const [features, setFeatures] = useState(initial?.features ?? '');
  const [reward, setReward] = useState(initial?.reward && initial.reward !== '0' ? initial.reward : '');
  const [phone, setPhone] = useState(initial?.phone ?? defaultPhone(store, pet.id));
  const [tried, setTried] = useState(false);
  const startPhoto = useRef(photo).current;
  const startPhone = useRef(phone).current;
  if (dirtyRef)
    dirtyRef.current = () =>
      photo !== startPhoto ||
      place.trim() !== (initial?.place ?? '') ||
      time.trim() !== (initial?.time ?? '') ||
      features.trim() !== (initial?.features ?? '') ||
      reward.replace(/[^0-9]/g, '') !== (initial?.reward && initial.reward !== '0' ? initial.reward.replace(/[^0-9]/g, '') : '') ||
      phone.trim() !== startPhone.trim() ||
      (!!initial && (since !== initial.since || sinceTime !== (initial.sinceTime ?? sinceTime)));
  useEffect(() => () => {
    if (dirtyRef) dirtyRef.current = null;
  }, [dirtyRef]);

  const replacePhoto = (u: string) => {
    files.added(u);
    if (photo && photo !== pet.photo) files.removed(photo);
    setPhoto(u);
  };

  const submit = () => {
    if (!place.trim() || !phone.trim()) {
      setTried(true);
      return;
    }
    const r = reward.replace(/[^0-9]/g, '');
    const info: LostInfo = {
      active: true,
      place: place.trim(),
      time: time.trim(),
      features: features.trim(),
      reward: r && Number(r) > 0 ? r : '',
      phone: phone.trim(),
      photo,
      since,
      sinceTime,
      sightings: initial?.sightings ?? [],
    };
    files.commit(afterSave);
    onSave(info);
  };

  return (
    <Card style={{ gap: 14 }}>
      <Label>寵物照片</Label>
      <Row>
        {photo ? (
          <Thumb uri={photo} label="協尋照片" style={{ width: 72, height: 72, borderRadius: 18 }} />
        ) : (
          <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: pet.color, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26, color: C.ink }}>{initialOf(pet.name)}</Text>
          </View>
        )}
        <Btn small kind="soft" title={photo ? '換一張照片' : '加入照片'} onPress={() => choosePhotos(1, (u) => u[0] && replacePhoto(u[0]))} />
      </Row>
      <Row gap={8} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <DateField label="走失日期" value={since} onChange={(x) => x && setSince(x)} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="大約時間" value={sinceTime} onChange={setSinceTime} />
        </View>
      </Row>
      <Field label="最後出現地點" required value={place} onChangeText={setPlace} placeholder="例如：大安森林公園東門" error={tried && !place.trim() ? '請填寫最後出現地點' : null} />
      <Field label="補充說明" value={time} onChangeText={setTime} placeholder="例如：散步時掙脫牽繩往公園方向跑" />
      <Field label="特徵" value={features} onChangeText={setFeatures} placeholder="例如：紅色項圈、右耳有缺口、怕生" />
      <Field label="酬謝金（元）" value={reward} onChangeText={setReward} keyboardType="numeric" placeholder="可不填" />
      <Field label="聯絡電話" required value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0912-345-678" error={tried && !phone.trim() ? '請填寫聯絡電話' : null} />
      <Btn title={initial ? '儲存變更' : '開始協尋並產生海報'} onPress={submit} style={{ backgroundColor: C.danger }} />
      {onCancel ? <Btn kind="outline" title="取消" onPress={() => { files.discard(); onCancel(); }} /> : null}
    </Card>
  );
}

function SightingForm({ onSave, onCancel }: { onSave: (s: Sighting) => void; onCancel: () => void }) {
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(hm());
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  return (
    <Card style={{ gap: 12 }}>
      <Row gap={8} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <DateField label="日期" value={date} onChange={(x) => x && setDate(x)} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="時間" value={time} onChange={setTime} />
        </View>
      </Row>
      <Field label="地點" required value={place} onChangeText={setPlace} placeholder="例如：信義路四段全家門口" error={tried && !place.trim() ? '請填寫地點' : null} />
      <Field label="備註" value={note} onChangeText={setNote} placeholder="例如：往巷子裡跑、看起來有受傷" />
      <Row gap={8}>
        <Btn
          title="加入目擊紀錄"
          style={{ flex: 1 }}
          onPress={() => {
            if (!place.trim()) return setTried(true);
            onSave({ id: uid('sg'), at: `${date}T${time}`, place: place.trim(), note: note.trim() });
          }}
        />
        <Btn kind="outline" title="取消" onPress={onCancel} />
      </Row>
    </Card>
  );
}

export default function LostScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const [editing, setEditing] = useState(false);
  const [addSighting, setAddSighting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bw, setBw] = useState(false);
  const scrollRef = useRef<any>(null);
  const nav = useNav();
  const formDirty = useRef<(() => boolean) | null>(null);
  const isDirty = () => !!formDirty.current?.();

  useBackHandler(() => {
    if (addSighting) {
      setAddSighting(false);
      return true;
    }
    if (isDirty()) {
      confirm('放棄未儲存的內容？', '剛才填寫的協尋資料不會保存。', () => {
        formDirty.current = null;
        if (editing) setEditing(false);
        else nav.pop();
      }, '放棄');
      return true;
    }
    if (editing) {
      setEditing(false);
      return true;
    }
    return false;
  });

  if (!pet) {
    return (
      <Screen title="走失協尋" subtitle="協尋海報與分享">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }
  const L = store.lost[pet.id];
  const active = !!L?.active;

  const makePoster = async (info: LostInfo) => {
    setBusy(true);
    try {
      const ok = await posterPdf(pet, info, bw);
      if (!ok) toast('海報沒有產生，請再試一次');
    } finally {
      setBusy(false);
    }
  };

  const tips = (
    <Section title="走失時可以做的事">
      <Card style={{ gap: 10 }}>
        {[
          '在最後出現地點附近來回找，牠可能躲在車底、樓梯間或草叢，晚上安靜時呼喚效果較好。',
          '打電話通知附近動物醫院、收容所，提供照片和特徵。',
          '把協尋海報傳到社區、里長、LINE 群組，並在附近張貼。',
          '要印海報：把 PDF 上傳到 7-11 ibon 或全家 FamiPort 的雲端列印，取得列印代碼後到門市印出。黑白版比較省錢。',
        ].map((t, i) => (
          <P key={i} style={{ fontSize: 14 }}>{`${i + 1}. ${t}`}</P>
        ))}
        <Btn small kind="outline" title="寵物登記管理資訊網（更新晶片聯絡資料）" onPress={() => openUrl('https://www.pet.gov.tw')} />
        <Btn small kind="outline" title="找附近的動物保護處、收容所" onPress={() => openUrl(mapsSearch('動物保護處 收容所'))} />
        <Btn small kind="outline" title="撥打 1959 動物保護專線" onPress={() => callPhone('1959')} accessibilityLabel="撥打 1959 動物保護專線" />
        <Sub style={{ fontSize: 12 }}>1959 是農業部的全國動物保護專線，可詢問各縣市收容所與動保處的聯絡方式。</Sub>
      </Card>
    </Section>
  );

  const onFound = () =>
    confirm(`確定已經找到${pet.name}了？`, '協尋會結束，資料會保留在這支手機。', () => {
      update((d) => {
        d.lost[pet.id] = { ...d.lost[pet.id], active: false };
      });
      setEditing(false);
      setAddSighting(false);
      toast('太好了！已結束協尋');
    }, '已找到');

  return (
    <Screen title="走失協尋" subtitle="協尋海報與分享" scrollRef={scrollRef}>
      <PetChips value={petId} onChange={(id) => { setPetId(id); setEditing(false); setAddSighting(false); }} />
      {active && L ? (
        editing ? (
          <LostForm
            key={'edit' + pet.id}
            pet={pet}
            store={store}
            initial={L}
            dirtyRef={formDirty}
            onCancel={() => setEditing(false)}
            onSave={(info) => {
              update((d) => {
                d.lost[pet.id] = info;
              });
              setEditing(false);
              toast('已更新協尋資料');
            }}
          />
        ) : (
          <>
            <View style={{ backgroundColor: C.danger, borderRadius: 22, padding: 16, gap: 6 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>協尋中 · {L.place}</Text>
              {when(L) ? <Text style={{ color: '#fff', fontSize: 13 }}>走失時間 {when(L)}</Text> : null}
              <Text style={{ color: '#fff', fontSize: 13 }}>聯絡電話 {L.phone}</Text>
              {rewardText(L.reward) ? <Text style={{ color: '#fff', fontSize: 13 }}>酬謝金 {rewardText(L.reward)}</Text> : null}
            </View>
            <Toggle label="黑白列印版海報" hint="適合到便利商店印黑白，比較省錢" value={bw} onChange={setBw} />
            <Btn title={busy ? '正在產生海報…' : '分享協尋海報（PDF）'} disabled={busy} onPress={() => makePoster(L)} />
            <Btn kind="outline" title="分享協尋文字" onPress={() => shareText(lostText(pet, L), `${pet.name} 協尋`)} />
            <Row gap={8}>
              <Btn kind="outline" title="在地圖查看" style={{ flex: 1 }} onPress={() => openUrl(mapsSearch(L.place))} />
              <Btn kind="outline" title="編輯" style={{ flex: 1 }} onPress={() => { setEditing(true); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} />
            </Row>

            <Section title="目擊紀錄" action={addSighting ? undefined : { label: '＋ 新增', onPress: () => setAddSighting(true) }}>
              {addSighting ? (
                <SightingForm
                  onCancel={() => setAddSighting(false)}
                  onSave={(s) => {
                    update((d) => {
                      d.lost[pet.id].sightings = [...(d.lost[pet.id].sightings || []), s];
                    });
                    setAddSighting(false);
                    toast('已加入目擊紀錄，分享文字會一起附上');
                  }}
                />
              ) : null}
              {L.sightings.length ? (
                [...L.sightings]
                  .sort((a, b) => (a.at < b.at ? 1 : -1))
                  .map((s) => (
                    <Card key={s.id} style={{ gap: 6, padding: 14 }}>
                      <Text style={{ fontSize: 13, color: C.sub }}>{s.at.replace('T', ' ').replace(/-/g, '/')}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{s.place}</Text>
                      {s.note ? <Sub>{s.note}</Sub> : null}
                      <Row gap={8}>
                        <Btn small kind="outline" title="地圖" onPress={() => openUrl(mapsSearch(s.place))} />
                        <Btn
                          small
                          kind="ghost"
                          title="刪除"
                          textStyle={{ color: C.danger }}
                          onPress={() =>
                            confirm('刪除這筆目擊紀錄？', '', () =>
                              update((d) => {
                                d.lost[pet.id].sightings = d.lost[pet.id].sightings.filter((x) => x.id !== s.id);
                              }),
                            )
                          }
                        />
                      </Row>
                    </Card>
                  ))
              ) : !addSighting ? (
                <Sub>有人通報看到{pet.name}時，記下時間和地點，方便縮小搜尋範圍。</Sub>
              ) : null}
            </Section>

            <Btn kind="dark" title={`已找到${pet.name}`} onPress={onFound} />
          </>
        )
      ) : (
        <>
          <Banner kind="ok" text={`${pet.name} 平安在家`} />
          <Sub>萬一走失，填好下面的資料就能立刻產生協尋海報，傳到 LINE 群組或印出來張貼。</Sub>
          <LostForm
            key={'new' + pet.id}
            pet={pet}
            store={store}
            dirtyRef={formDirty}
            onSave={(info) => {
              update((d) => {
                d.lost[pet.id] = info;
              });
              toast('已開始協尋');
              makePoster(info);
            }}
          />
          {busy ? <Sub>正在產生海報…</Sub> : null}
        </>
      )}

      {tips}
    </Screen>
  );
}
