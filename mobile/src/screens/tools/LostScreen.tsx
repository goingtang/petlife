import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Screen, Btn, Banner, PetChips, Section, Field, Sub, P, Row, Label, Card } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import type { LostInfo, Pet, Store } from '../../lib/types';
import { KIND_LABEL, SEX_LABEL, mapsSearch, money } from '../../lib/domain';
import { ageText, today } from '../../lib/date';
import { choosePhotos, esc, imageDataUri, openUrl, sharePdf, shareText } from '../../lib/files';

function petLine(pet: Pet) {
  return [KIND_LABEL[pet.kind], pet.breed, SEX_LABEL[pet.sex], ageText(pet.birthday)].filter(Boolean).join(' · ');
}

function lostText(pet: Pet, L: LostInfo) {
  return [
    `【協尋走失寵物】${pet.name}`,
    petLine(pet),
    `最後出現地點：${L.place}${L.time ? '（' + L.time + '）' : ''}`,
    L.features ? `特徵：${L.features}` : '',
    pet.chip ? `晶片號碼：${pet.chip}` : '',
    L.reward ? `酬謝金：${money(Number(L.reward))}` : '',
    `看到請聯絡：${L.phone}`,
    '麻煩大家幫忙分享，謝謝！',
  ]
    .filter(Boolean)
    .join('\n');
}

async function posterPdf(pet: Pet, L: LostInfo) {
  const img = await imageDataUri(L.photo || pet.photo);
  const row = (k: string, v: string) => (v ? `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>` : '');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif;margin:0;color:#3B2F28}
  .top{background:#A0442A;color:#fff;text-align:center;font-size:54px;font-weight:800;padding:26px 0;letter-spacing:4px}
  .ph{margin:24px auto 0;width:82%;height:380px;border-radius:24px;background:${pet.color} center/cover no-repeat;${img ? `background-image:url('${img}');` : ''}display:flex;align-items:center;justify-content:center;font-size:160px;font-weight:700}
  h1{text-align:center;font-size:52px;margin:18px 0 4px}.sub{text-align:center;font-size:20px;color:#5E4E42;margin:0 0 16px}
  table{width:82%;margin:0 auto;border-collapse:collapse;font-size:20px}td{padding:8px;border-bottom:1px solid #EADDCB;vertical-align:top}td.k{color:#A0442A;font-weight:700;width:30%}
  .tel{margin-top:22px;background:#A0442A;color:#fff;text-align:center;font-size:36px;font-weight:800;padding:20px 0}
  </style></head><body>
  <div class="top">協尋走失寵物</div>
  <div class="ph">${img ? '' : esc(pet.name.slice(0, 1))}</div>
  <h1>${esc(pet.name)}</h1><p class="sub">${esc(petLine(pet))}</p>
  <table>${row('最後出現', L.place + (L.time ? '（' + L.time + '）' : ''))}${row('特徵', L.features)}${row('晶片號碼', pet.chip)}${row('酬謝金', L.reward ? money(Number(L.reward)) : '')}</table>
  <div class="tel">看到請聯絡 ${esc(L.phone)}</div>
  </body></html>`;
  await sharePdf(html, `${pet.name}-協尋海報`);
}

function LostForm({ pet, store }: { pet: Pet; store: Store }) {
  const { update, toast } = useStore();
  const primary = store.contacts.find((c) => c.petId === pet.id && c.primary && c.rel !== '主治醫院') ?? store.contacts.find((c) => c.petId === pet.id && c.rel === '家人');
  const [photo, setPhoto] = useState<string | undefined>(pet.photo);
  const [place, setPlace] = useState('');
  const [time, setTime] = useState('');
  const [features, setFeatures] = useState('');
  const [reward, setReward] = useState('');
  const [phone, setPhone] = useState(primary?.phone ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!place.trim() || !phone.trim()) {
      setTried(true);
      return;
    }
    const info: LostInfo = { active: true, place: place.trim(), time: time.trim(), features: features.trim(), reward: reward.replace(/[^0-9]/g, ''), phone: phone.trim(), photo, since: today() };
    update((d) => {
      d.lost[pet.id] = info;
    });
    toast('已開始協尋');
    setBusy(true);
    await posterPdf(pet, info);
    setBusy(false);
  };

  return (
    <Card style={{ gap: 14 }}>
      <Label>寵物照片</Label>
      <Row>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: 72, height: 72, borderRadius: 18 }} />
        ) : (
          <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: pet.color, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26, color: C.ink }}>{pet.name.slice(0, 1)}</Text>
          </View>
        )}
        <Btn small kind="soft" title={photo ? '換一張照片' : '加入照片'} onPress={() => choosePhotos(1, (u) => u[0] && setPhoto(u[0]))} />
      </Row>
      <Field label="最後出現地點" required value={place} onChangeText={setPlace} placeholder="例如：大安森林公園東門" error={tried && !place.trim() ? '請填寫最後出現地點' : null} />
      <Field label="時間" value={time} onChangeText={setTime} placeholder="例如：今天下午 3 點左右" />
      <Field label="特徵" value={features} onChangeText={setFeatures} placeholder="例如：紅色項圈、右耳有缺口、怕生" />
      <Field label="酬謝金（元）" value={reward} onChangeText={setReward} keyboardType="numeric" placeholder="可不填" />
      <Field label="聯絡電話" required value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0912-345-678" error={tried && !phone.trim() ? '請填寫聯絡電話' : null} />
      <Btn title={busy ? '正在產生海報…' : '開始協尋並產生海報'} onPress={submit} disabled={busy} style={{ backgroundColor: C.danger }} />
    </Card>
  );
}

export default function LostScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();

  if (!pet) {
    return (
      <Screen title="走失協尋" subtitle="協尋海報與分享">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }
  const L = store.lost[pet.id];
  const active = !!L?.active;

  return (
    <Screen title="走失協尋" subtitle="協尋海報與分享">
      <PetChips value={petId} onChange={setPetId} />
      {active && L ? (
        <>
          <View style={{ backgroundColor: C.danger, borderRadius: 22, padding: 16, gap: 8 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>協尋中 · {L.place}</Text>
            <Text style={{ color: '#fff', fontSize: 13 }}>{L.since ? `從 ${L.since.replace(/-/g, '/')} 開始` : ''}{L.time ? ` · 最後出現 ${L.time}` : ''}</Text>
            <Text style={{ color: '#fff', fontSize: 13 }}>聯絡電話 {L.phone}</Text>
          </View>
          <Btn title="重新分享海報（PDF）" onPress={() => posterPdf(pet, L)} />
          <Btn kind="outline" title="分享文字到 LINE 群組" onPress={() => shareText(lostText(pet, L), `${pet.name} 協尋`)} />
          <Btn kind="outline" title="在地圖查看地點" onPress={() => openUrl(mapsSearch(L.place))} />
          <Btn
            kind="dark"
            title={`已找到${pet.name}`}
            onPress={() => {
              update((d) => {
                d.lost[pet.id] = { ...d.lost[pet.id], active: false };
              });
              toast('太好了！已結束協尋');
            }}
          />
        </>
      ) : (
        <>
          <Banner kind="ok" text={`${pet.name} 平安在家`} />
          <Sub>萬一走失，填好下面的資料就能立刻產生協尋海報，傳到 LINE 群組或印出來張貼。</Sub>
          <LostForm key={pet.id} pet={pet} store={store} />
        </>
      )}

      <Section title="走失時可以做的事">
        <Card style={{ gap: 8 }}>
          {[
            '在最後出現地點附近來回找，牠可能躲在車底或樓梯間。',
            '打電話通知附近動物醫院、收容所，提供照片和特徵。',
            '把協尋海報傳到社區、里長、LINE 群組，並在附近張貼。',
            '到寵物登記管理資訊網確認晶片資料與聯絡電話是最新的。',
          ].map((t, i) => (
            <P key={i} style={{ fontSize: 14 }}>{`${i + 1}. ${t}`}</P>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
