import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Screen, Card, Btn, Chip, ChipRow, Field, Segment, PetChips, Row, Badge, Banner, Empty, Sub, Label } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { mapsSearch, phoneHref } from '../../lib/domain';
import { openUrl, callPhone } from '../../lib/files';
import { useNav } from '../../nav';

type Cat = 'all' | 'vet' | 'shop' | 'groom' | 'park';
const CATS: { value: Cat; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'vet', label: '動物醫院' }, { value: 'shop', label: '用品店' }, { value: 'groom', label: '美容' }, { value: 'park', label: '狗狗公園' },
];
const FILTERS: Record<Cat, string[]> = {
  all: ['amenity=veterinary', 'shop=pet', 'shop=pet_grooming', 'leisure=dog_park'],
  vet: ['amenity=veterinary'],
  shop: ['shop=pet'],
  groom: ['shop=pet_grooming'],
  park: ['leisure=dog_park', 'leisure=park'],
};
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const FALLBACK = [
  ['附近動物醫院', '動物醫院'], ['24 小時急診', '24小時 動物醫院 急診'], ['寵物友善餐廳', '寵物友善餐廳'], ['寵物友善住宿', '寵物友善住宿'],
];

interface Place {
  id: string; name: string; lat: number; lon: number; dist: number; kind: string;
  addr: string; phone: string; hours: string; website: string; h24: boolean;
}

function haversine(a: number, b: number, c: number, d: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(c - a);
  const dLon = r(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const distText = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

function kindOf(t: any): string {
  if (t.amenity === 'veterinary') return '動物醫院';
  if (t.shop === 'pet_grooming') return '寵物美容';
  if (t.shop === 'pet') return '寵物用品';
  if (t.leisure === 'dog_park') return '狗狗公園';
  if (t.leisure === 'park') return '公園';
  return '地點';
}

async function fetchJson(url: string, ms: number, headers?: Record<string, string>): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Ask every Overpass mirror at once and use whichever answers first (public servers are often busy). */
function fetchOverpass(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let left = ENDPOINTS.length;
    const fail = () => {
      left -= 1;
      if (left === 0) reject(new Error('all overpass endpoints failed'));
    };
    ENDPOINTS.forEach((ep) =>
      fetchJson(`${ep}?data=${encodeURIComponent(query)}`, 25000)
        .then((j) => (j && Array.isArray(j.elements) ? resolve(j) : fail()))
        .catch(fail),
    );
  });
}

// Backup source: OpenStreetMap's own search service (Nominatim). One request per second, per its usage policy.
const NOMINATIM_QUERIES: Record<Cat, string[]> = {
  all: ['amenity=veterinary', 'q=動物醫院', 'q=寵物用品', 'q=寵物美容'],
  vet: ['amenity=veterinary', 'q=動物醫院'],
  shop: ['q=寵物用品', 'q=寵物店'],
  groom: ['q=寵物美容'],
  park: ['q=狗公園', 'q=寵物公園'],
};
const NOMINATIM_TYPES: Record<string, Record<string, string>> = {
  veterinary: { amenity: 'veterinary' },
  pet: { shop: 'pet' },
  pet_grooming: { shop: 'pet_grooming' },
  dog_park: { leisure: 'dog_park' },
  park: { leisure: 'park' },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchNominatim(cat: Cat, r: number, lat: number, lon: number): Promise<any[]> {
  const dLat = r / 111000;
  const dLon = r / (111000 * Math.cos((lat * Math.PI) / 180));
  const viewbox = `${lon - dLon},${lat + dLat},${lon + dLon},${lat - dLat}`;
  const out: any[] = [];
  const qs = NOMINATIM_QUERIES[cat];
  for (let i = 0; i < qs.length; i++) {
    if (i) await sleep(1100);
    const [k, v] = qs[i].split('=');
    const url = `https://nominatim.openstreetmap.org/search?${k}=${encodeURIComponent(v)}&format=jsonv2&viewbox=${viewbox}&bounded=1&limit=40&extratags=1&accept-language=zh-TW`;
    try {
      const arr = await fetchJson(url, 15000, { 'Accept-Language': 'zh-TW' });
      for (const x of Array.isArray(arr) ? arr : []) {
        const base = NOMINATIM_TYPES[x.type] ?? (/動物醫院|獸醫/.test(x.name || '') ? NOMINATIM_TYPES.veterinary : /寵物/.test(x.name || '') ? NOMINATIM_TYPES.pet : null);
        if (!base || !x.name) continue;
        const e = x.extratags || {};
        // display_name is "名稱, 路, 里, 區, 市, 郵遞區號, 臺灣" → "市區里路"
        const addr = String(x.display_name || '').split(',').map((s: string) => s.trim()).slice(1, 5).reverse().filter((s: string) => !/^\d+$/.test(s)).join('');
        out.push({ type: 'n', id: x.place_id, lat: Number(x.lat), lon: Number(x.lon), tags: { ...base, name: x.name, phone: e.phone || e['contact:phone'], opening_hours: e.opening_hours, website: e.website || e['contact:website'], 'addr:full': addr } });
      }
    } catch {
      // try the next query
    }
  }
  if (!out.length) throw new Error('nominatim empty');
  return out;
}

type Phase = 'idle' | 'locating' | 'denied' | 'searching' | 'done' | 'error';

export default function PlacesScreen(_: { params: any }) {
  const { store, petId, setPetId } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('all');
  const [radius, setRadius] = useState<'1000' | '3000' | '5000'>('3000');
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [places, setPlaces] = useState<Place[]>([]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const vet = pet ? store.vets[pet.id] : undefined;

  const locate = useCallback(async () => {
    setPhase('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (alive.current) setPhase('denied');
        return;
      }
      let loc: Location.LocationObject | null = null;
      try {
        loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((_r, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
        ]);
      } catch {
        loc = await Location.getLastKnownPositionAsync();
      }
      if (!alive.current) return;
      if (!loc) {
        setPhase('error');
        return;
      }
      setPos({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    } catch {
      if (alive.current) setPhase('error');
    }
  }, []);

  const search = useCallback(async () => {
    if (!pos) return;
    setPhase('searching');
    const r = Number(radius);
    const body = FILTERS[cat].map((f) => {
      const [k, v] = f.split('=');
      return `nwr["${k}"="${v}"](around:${r},${pos.lat},${pos.lon});`;
    }).join('');
    const query = `[out:json][timeout:25];(${body});out center tags 60;`;
    try {
      let elements: any[];
      try {
        elements = (await fetchOverpass(query)).elements;
      } catch {
        elements = await fetchNominatim(cat, r, pos.lat, pos.lon);
      }
      const seen = new Set<string>();
      const list: Place[] = [];
      for (const el of elements) {
        const t = el.tags || {};
        const name = t.name || t['name:zh'];
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (!name || lat == null || lon == null) continue;
        const key = `${name}|${Math.round(lat * 1e4)}|${Math.round(lon * 1e4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const addr = t['addr:full'] || [t['addr:city'], t['addr:district'], t['addr:street'], t['addr:housenumber'] ? t['addr:housenumber'] + '號' : ''].filter(Boolean).join('');
        const hours = t.opening_hours || '';
        list.push({
          id: `${el.type}${el.id}`, name, lat, lon, dist: haversine(pos.lat, pos.lon, lat, lon), kind: kindOf(t),
          addr, phone: t.phone || t['contact:phone'] || '', hours, website: t.website || t['contact:website'] || '',
          h24: hours === '24/7' || /24/.test(name),
        });
      }
      list.sort((a, b) => a.dist - b.dist);
      if (!alive.current) return;
      setPlaces(list);
      setPhase('done');
    } catch {
      if (alive.current) setPhase('error');
    }
  }, [pos, cat, radius]);

  useEffect(() => { locate(); }, [locate]);
  useEffect(() => { if (pos) search(); }, [pos, search]);

  const km = Number(radius) / 1000;

  return (
    <Screen title="找醫院與友善地點" subtitle="依你目前的位置，找附近的動物醫院、用品店與公園">
      {pet ? (
        <View style={{ gap: 10 }}>
          <Label>主治醫院</Label>
          <PetChips value={petId} onChange={setPetId} />
          {vet?.name ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{vet.name}</Text>
              {vet.addr ? <Sub>{vet.addr}</Sub> : null}
              {vet.phone ? <Sub>電話 {vet.phone}{vet.hours ? ' · ' + vet.hours : ''}</Sub> : null}
              <Row>
                <Btn small kind="dark" title="導航" style={{ flex: 1 }} onPress={() => openUrl(mapsSearch(`${vet.name} ${vet.addr}`.trim()))} />
                {vet.phone ? <Btn small kind="outline" title="撥打" style={{ flex: 1 }} onPress={() => openUrl(phoneHref(vet.phone), '無法撥打電話')} /> : null}
              </Row>
            </Card>
          ) : (
            <Card style={{ gap: 10 }}>
              <Sub>還沒有設定{pet.name}的主治醫院。設定後可一鍵導航和撥打。</Sub>
              <Btn small kind="outline" title="設定主治醫院" onPress={() => nav.push('vetEdit', { petId: pet.id })} />
            </Card>
          )}
        </View>
      ) : null}

      <ChipRow>
        {CATS.map((c) => <Chip key={c.value} label={c.label} on={cat === c.value} onPress={() => setCat(c.value)} />)}
      </ChipRow>
      <Segment options={[{ value: '1000', label: '1 公里' }, { value: '3000', label: '3 公里' }, { value: '5000', label: '5 公里' }]} value={radius} onChange={setRadius} />

      {phase === 'denied' ? (
        <Banner kind="warn" text="需要定位權限才能找附近的地點。請到手機設定允許定位，或使用下方的 Google 地圖搜尋。" action={{ label: '開啟設定', onPress: () => Linking.openSettings().catch(() => {}) }} />
      ) : null}

      {phase === 'locating' || phase === 'searching' || phase === 'idle' ? (
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <ActivityIndicator color={C.accent} />
          <Sub>{phase === 'searching' ? '正在搜尋附近地點…' : '正在取得你的位置…'}</Sub>
        </Card>
      ) : null}

      {phase === 'error' ? (
        <Banner kind="danger" text="暫時無法取得位置或附近地點，請確認網路與定位後再試一次。" action={{ label: '重試', onPress: () => (pos ? search() : locate()) }} />
      ) : null}

      {phase === 'done' ? (
        <View style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Sub style={{ flex: 1 }}>目前位置附近 · 半徑 {km} 公里 · 共 {places.length} 筆</Sub>
            <Btn small kind="soft" title="重新定位" onPress={locate} />
          </Row>
          {places.length ? places.map((p) => (
            <Card key={p.id} style={{ gap: 8 }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{p.name}</Text>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Badge text={p.kind} />
                    {p.h24 ? <Badge text="24 小時" bg={C.dangerBg} fg={C.danger} /> : null}
                  </Row>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: C.sub }}>{distText(p.dist)}</Text>
              </Row>
              {p.addr ? <Sub>{p.addr}</Sub> : null}
              {p.hours ? <Sub>營業時間 {p.hours}</Sub> : null}
              {p.phone ? <Sub>電話 {p.phone}</Sub> : null}
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                <Btn small kind="dark" title="導航" onPress={() => openUrl(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`)} />
                {p.phone ? <Btn small kind="outline" title="撥打" onPress={() => callPhone(p.phone.split(/[;,]/)[0])} /> : null}
                {p.website ? <Btn small kind="ghost" title="網站" onPress={() => openUrl(p.website)} /> : null}
              </Row>
            </Card>
          )) : (
            <Empty text={`半徑 ${km} 公里內沒有找到資料。可以改成更大的範圍，或用下方 Google 地圖搜尋。`} />
          )}
        </View>
      ) : null}

      <Sub>地點資料來自 OpenStreetMap，可能不完整；營業時間請以店家公告為準。</Sub>

      <Label>用 Google 地圖搜尋</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FALLBACK.map(([label, query]) => (
          <Btn key={label} small kind="soft" title={label} onPress={() => openUrl(mapsSearch(query))} />
        ))}
      </View>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field value={q} onChangeText={setQ} placeholder="自訂搜尋，例如：可帶狗的咖啡廳" /></View>
        <Btn title="搜尋" disabled={!q.trim()} onPress={() => openUrl(mapsSearch(q.trim()))} />
      </Row>
    </Screen>
  );
}
