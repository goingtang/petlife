import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Screen, Card, Btn, Chip, ChipRow, Field, Segment, PetChips, Row, Badge, Banner, Empty, Sub, Label, confirm } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { mapsSearch } from '../../lib/domain';
import { openUrl, callPhone } from '../../lib/files';
import { useNav } from '../../nav';
import { uid } from '../../lib/seed';
import type { FavPlace } from '../../lib/types';
import MapPreview from './MapPreview';
import { haversine, samePlace, validCoord, phoneDigits } from '../../lib/life';

type Cat = 'all' | 'vet' | 'exotic' | 'shop' | 'groom' | 'dogpark' | 'park' | 'fav';
const CATS: { value: Cat; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'vet', label: '動物醫院' }, { value: 'exotic', label: '異寵醫院' }, { value: 'shop', label: '用品店' },
  { value: 'groom', label: '美容' }, { value: 'dogpark', label: '狗狗公園' }, { value: 'park', label: '公園' }, { value: 'fav', label: '收藏' },
];
const FILTERS: Record<Exclude<Cat, 'fav'>, string[]> = {
  all: ['amenity=veterinary', 'shop=pet', 'shop=pet_grooming', 'leisure=dog_park'],
  vet: ['amenity=veterinary'],
  exotic: ['amenity=veterinary'],
  shop: ['shop=pet'],
  groom: ['shop=pet_grooming'],
  dogpark: ['leisure=dog_park'],
  park: ['leisure=park'],
};
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const FALLBACK = [
  ['附近動物醫院', '動物醫院'], ['24 小時急診', '24小時 動物醫院 急診'], ['寵物友善餐廳', '寵物友善餐廳'], ['寵物友善住宿', '寵物友善住宿'],
];
// 「鳥松」is a district name (高雄市鳥松區), not a hint that a clinic treats birds.
const EXOTIC = /異寵|特寵|特殊寵物|兔|鳥|爬蟲|exotic/i;
const isExotic = (s: string) => EXOTIC.test(String(s || '').replace(/鳥松/g, ''));
/** Whole search, both sources: after this the user sees an error (or the last results). */
const TOTAL_CAP_MS = 50000;
/** Time budget for all Overpass mirrors together, so the Nominatim backup still has time. */
const OVERPASS_BUDGET_MS = 26000;
const PAGE = 20;
const UA = 'PetPal/1.0 (+https://github.com/goingtang/petlife)';

interface Place {
  id: string; name: string; lat: number; lon: number; dist: number; kind: string;
  addr: string; phone: string; hours: string; website: string; h24: boolean; exotic: boolean;
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

const DAY: Record<string, string> = { Mo: '一', Tu: '二', We: '三', Th: '四', Fr: '五', Sa: '六', Su: '日', PH: '國定假日' };
/** Make common OpenStreetMap opening_hours readable in Chinese. */
export function zhHours(s: string): string {
  if (!s) return '';
  if (s.trim() === '24/7') return '24 小時營業';
  return s
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (_, a, b) => `週${DAY[a]}至週${DAY[b]}`)
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => (d === 'PH' ? DAY.PH : `週${DAY[d]}`))
    .replace(/\boff\b/gi, '休息')
    .replace(/\bclosed\b/gi, '休息')
    .replace(/;\s*/g, '；')
    .replace(/,\s*/g, '、');
}
const is24 = (h: string) => /24\/7/.test(h) || /00:00\s*-\s*24:00/.test(h);

/** Nominatim's display_name ("名稱, 95, 信安街95巷, 景勤里, 大安區, 臺北市, 106, 臺灣") → "臺北市大安區景勤里信安街95巷95號". */
export function addrFromDisplay(display: string): string {
  const parts = String(display || '').split(',').map((s) => s.trim()).filter(Boolean);
  let arr = parts.slice(1);
  if (arr.length && /臺灣|台灣|Taiwan/i.test(arr[arr.length - 1])) arr = arr.slice(0, -1);
  if (arr.length && /^\d{3}(\d{2,3})?$/.test(arr[arr.length - 1])) arr = arr.slice(0, -1);
  let house = '';
  if (arr.length && /^\d+[\d\-之]*$/.test(arr[0])) house = arr.shift() as string;
  return arr.reverse().join('') + (house ? `${house}號` : '');
}

// ---------- network (module level so throttling and cache survive re-renders and screen visits) ----------

let lastNominatim = 0;
const cache = new Map<string, { at: number; elements: any[] }>();
const CACHE_MS = 10 * 60 * 1000;
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    if (signal.aborted) return rej(new Error('aborted'));
    const onAbort = () => { clearTimeout(t); rej(new Error('aborted')); };
    const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); res(); }, ms);
    signal.addEventListener('abort', onAbort);
  });

async function fetchJson(url: string, ms: number, signal: AbortSignal, headers?: Record<string, string>): Promise<any> {
  if (signal.aborted) throw new Error('aborted');
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Try Overpass mirrors one at a time within OVERPASS_BUDGET_MS. A valid answer with no elements is a real
 * "nothing nearby" (returned as []); a server remark (timeout / overload) counts as a failure.
 */
async function fetchOverpass(query: string, signal: AbortSignal): Promise<any[]> {
  const deadline = Date.now() + OVERPASS_BUDGET_MS;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    if (signal.aborted) throw new Error('aborted');
    const left = deadline - Date.now();
    if (left < 2000) break;
    try {
      const j = await fetchJson(`${ENDPOINTS[i]}?data=${encodeURIComponent(query)}`, Math.min(i === 0 ? 10000 : 8000, left), signal);
      if (j && Array.isArray(j.elements) && !j.remark) return j.elements;
    } catch {
      // try the next mirror
    }
  }
  throw new Error('overpass failed');
}

// At most two requests per search (Nominatim usage policy: light use only).
const NOMINATIM_QUERIES: Record<Exclude<Cat, 'fav'>, string[]> = {
  all: ['q=動物醫院', 'q=寵物用品'],
  vet: ['amenity=veterinary', 'q=動物醫院'],
  exotic: ['q=異寵 動物醫院', 'q=動物醫院'],
  shop: ['q=寵物用品', 'q=寵物店'],
  groom: ['q=寵物美容'],
  dogpark: ['q=狗公園', 'q=寵物公園'],
  park: ['q=公園'],
};
const NOMINATIM_TYPES: Record<string, Record<string, string>> = {
  veterinary: { amenity: 'veterinary' }, pet: { shop: 'pet' }, pet_grooming: { shop: 'pet_grooming' }, dog_park: { leisure: 'dog_park' }, park: { leisure: 'park' },
};

/**
 * Backup source: OpenStreetMap's Nominatim. Never more than one request per 1.1 s across the whole app.
 * Returns [] when at least one request answered (nothing nearby); throws only when every request failed.
 */
async function fetchNominatim(cat: Exclude<Cat, 'fav'>, r: number, lat: number, lon: number, signal: AbortSignal): Promise<any[]> {
  const dLat = r / 111000;
  const dLon = r / (111000 * Math.cos((lat * Math.PI) / 180));
  const viewbox = `${lon - dLon},${lat + dLat},${lon + dLon},${lat - dLat}`;
  const headers = Platform.OS === 'web' ? undefined : { 'User-Agent': UA, 'Accept-Language': 'zh-TW' };
  const out: any[] = [];
  let answered = false;
  for (const q of NOMINATIM_QUERIES[cat]) {
    const wait = lastNominatim + 1100 - Date.now();
    if (wait > 0) await sleep(wait, signal);
    lastNominatim = Date.now();
    const [k, v] = q.split('=');
    const url = `https://nominatim.openstreetmap.org/search?${k}=${encodeURIComponent(v)}&format=jsonv2&viewbox=${viewbox}&bounded=1&limit=40&extratags=1&accept-language=zh-TW`;
    try {
      const arr = await fetchJson(url, 10000, signal, headers);
      answered = true;
      for (const x of Array.isArray(arr) ? arr : []) {
        const base = NOMINATIM_TYPES[x.type] ?? (/動物醫院|獸醫/.test(x.name || '') ? NOMINATIM_TYPES.veterinary : /寵物/.test(x.name || '') ? NOMINATIM_TYPES.pet : null);
        if (!base || !x.name || !validCoord(x.lat, x.lon)) continue;
        const e = x.extratags || {};
        out.push({ type: 'n', id: x.place_id, lat: Number(x.lat), lon: Number(x.lon), tags: { ...base, name: x.name, phone: e.phone || e['contact:phone'], opening_hours: e.opening_hours, website: e.website || e['contact:website'], 'addr:full': addrFromDisplay(x.display_name) } });
      }
    } catch (err) {
      if (signal.aborted) throw err;
    }
  }
  if (!answered) throw new Error('nominatim failed');
  return out;
}

function toPlaces(elements: any[], pos: { lat: number; lon: number }): Place[] {
  const seen = new Set<string>();
  const list: Place[] = [];
  for (const el of elements) {
    const t = el.tags || {};
    const name = t.name || t['name:zh'];
    const lat = Number(el.lat ?? el.center?.lat);
    const lon = Number(el.lon ?? el.center?.lon);
    if (!name || !validCoord(lat, lon)) continue;
    const key = `${name}|${Math.round(lat * 1e3)}|${Math.round(lon * 1e3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const addr = t['addr:full'] || [t['addr:city'], t['addr:district'], t['addr:street'], t['addr:housenumber'] ? String(t['addr:housenumber']).replace(/號?$/, '號') : ''].filter(Boolean).join('');
    const hours = t.opening_hours || '';
    list.push({
      id: `${el.type}${el.id}`, name, lat, lon, dist: haversine(pos.lat, pos.lon, lat, lon), kind: kindOf(t),
      addr, phone: t.phone || t['contact:phone'] || '', hours, website: t.website || t['contact:website'] || '',
      h24: is24(hours), exotic: isExotic(name) || isExotic(t.description) || isExotic(t['veterinary:speciality']),
    });
  }
  return list.sort((a, b) => a.dist - b.dist).slice(0, 60);
}

type Phase = 'idle' | 'locating' | 'denied' | 'searching' | 'done' | 'error';

export default function PlacesScreen(_: { params: any }) {
  const { store, update, toast, petId, setPetId } = useStore();
  const pet = usePet();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('all');
  const [radius, setRadius] = useState<'1000' | '3000' | '5000'>('3000');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [places, setPlaces] = useState<Place[]>([]);
  const [stale, setStale] = useState(false);
  const alive = useRef(true);
  const seq = useRef(0);
  const ctl = useRef<AbortController | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => () => { alive.current = false; ctl.current?.abort(); }, []);
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
      if (!loc) return setPhase('error');
      setPos({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    } catch {
      if (alive.current) setPhase('error');
    }
  }, []);

  // Coming back from the phone's Settings after allowing location: try again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' || phaseRef.current !== 'denied') return;
      // Only check (never prompt) here; re-locate once the user has allowed location in Settings.
      Location.getForegroundPermissionsAsync().then((perm) => { if (perm.granted && alive.current) locate(); }).catch(() => {});
    });
    return () => sub.remove();
  }, [locate]);

  const search = useCallback(async () => {
    if (!pos || cat === 'fav') return;
    ctl.current?.abort();
    const mine = ++seq.current;
    const c = new AbortController();
    ctl.current = c;
    const cap = setTimeout(() => c.abort(), TOTAL_CAP_MS);
    const r = Number(radius);
    const key = `${cat}|${r}|${pos.lat.toFixed(3)}|${pos.lon.toFixed(3)}`;
    const hit = cache.get(key);
    const filterCat = (list: Place[]) => (cat === 'exotic' ? list.filter((p) => p.exotic) : list);
    if (hit) {
      setPlaces(filterCat(toPlaces(hit.elements, pos)));
      setStale(Date.now() - hit.at > CACHE_MS);
      setPhase('done');
      if (Date.now() - hit.at < CACHE_MS) {
        clearTimeout(cap);
        return;
      }
    } else setPhase('searching');
    const body = FILTERS[cat].map((f) => {
      const [k, v] = f.split('=');
      return `nwr["${k}"="${v}"](around:${r},${pos.lat},${pos.lon});`;
    }).join('');
    const query = `[out:json][timeout:25];(${body});out center tags 200;`;
    try {
      let elements: any[];
      try {
        elements = await fetchOverpass(query, c.signal);
      } catch (e) {
        if (c.signal.aborted) throw e;
        elements = await fetchNominatim(cat, r, pos.lat, pos.lon, c.signal);
      }
      if (!alive.current || mine !== seq.current) return; // a newer search has started
      cache.set(key, { at: Date.now(), elements });
      setPlaces(filterCat(toPlaces(elements, pos)));
      setStale(false);
      setPhase('done');
    } catch {
      if (!alive.current || mine !== seq.current) return;
      if (hit) setStale(true);
      else setPhase('error');
    } finally {
      clearTimeout(cap);
    }
  }, [pos, cat, radius]);

  // Leaving the search (e.g. to 收藏) stops any request still running.
  useEffect(() => {
    if (cat !== 'fav') return;
    ctl.current?.abort();
    seq.current++;
    if (phaseRef.current === 'searching') setPhase('idle');
  }, [cat]);

  useEffect(() => { locate(); }, [locate]);
  useEffect(() => { if (pos) search(); }, [pos, search]);

  const km = Number(radius) / 1000;
  const isFav = (p: { name: string; lat: number; lon: number }) => store.favPlaces.some((f) => samePlace(f, p));
  const lastTap = useRef(new Map<string, number>());
  /** Ignore a second tap on the same button within 600 ms (double taps would toggle twice or add twice). */
  const once = (key: string) => {
    const now = Date.now();
    if (now - (lastTap.current.get(key) ?? 0) < 600) return false;
    lastTap.current.set(key, now);
    return true;
  };
  const toggleFav = (p: Place | FavPlace) => {
    if (!once('fav:' + p.id)) return;
    const on = isFav(p);
    update((d) => {
      if (on) d.favPlaces = d.favPlaces.filter((f) => !samePlace(f, p));
      else if (!d.favPlaces.some((f) => samePlace(f, p))) d.favPlaces.push({ id: uid('fp'), name: p.name, lat: p.lat, lon: p.lon, addr: p.addr, phone: p.phone, kind: p.kind });
    });
    toast(on ? '已取消收藏' : '已收藏，沒有網路也能看到');
  };
  const navTo = (p: { name: string; addr: string; lat: number; lon: number }) =>
    openUrl(p.addr ? mapsSearch(`${p.name} ${p.addr}`) : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`);
  const setAsVet = (p: { name: string; phone: string; addr: string; hours?: string }) => {
    if (!pet) return;
    const cur = store.vets[pet.id];
    const apply = () => {
      update((d) => {
        const old = d.vets[pet.id];
        const same = !!old?.name && old.name === p.name;
        d.vets[pet.id] = {
          ...(old ?? {}),
          name: p.name,
          // Keep what the user typed for their own doctor; keep old hours/phone only for the same clinic or when OSM has none.
          doctor: same ? old?.doctor ?? '' : '',
          phone: p.phone || (same ? old?.phone ?? '' : ''),
          addr: p.addr || (same ? old?.addr ?? '' : ''),
          hours: p.hours ? zhHours(p.hours) : same ? old?.hours ?? '' : '',
        };
      });
      toast(`已設為${pet.name}的主治醫院${p.phone ? '' : '，記得補上電話'}`);
    };
    if (cur?.name) confirm(`改用「${p.name}」當主治醫院？`, `目前是「${cur.name}」${cur.doctor ? `（${cur.doctor}）` : ''}。原本的資料會被取代。`, apply, '改用');
    else apply();
  };
  const addContact = (p: { id: string; name: string; phone: string; kind: string }) => {
    if (!pet || !p.phone || !once('contact:' + p.id)) return;
    const phone = p.phone.split(/[;,]/)[0].trim();
    const digits = phoneDigits(phone);
    if (store.contacts.some((c) => c.petId === pet.id && phoneDigits(c.phone) === digits)) {
      toast(`${pet.name}的聯絡人已經有這個電話`);
      return;
    }
    const isVet = p.kind === '動物醫院';
    const hasMainVet = store.contacts.some((c) => c.petId === pet.id && c.rel === '主治醫院');
    update((d) => { d.contacts.push({ id: uid('c'), petId: pet.id, name: p.name, rel: isVet && !hasMainVet ? '主治醫院' : '其他', phone, primary: false }); });
    toast(`已加入${pet.name}的聯絡人`);
  };

  const shown: (Place | (FavPlace & { dist: number; hours: string; website: string; h24: boolean; exotic: boolean }))[] = useMemo(
    () =>
      cat === 'fav'
        ? store.favPlaces.map((f) => ({ ...f, dist: pos ? haversine(pos.lat, pos.lon, f.lat, f.lon) : NaN, hours: '', website: '', h24: false, exotic: false }))
        : places,
    [cat, store.favPlaces, places, pos],
  );
  const mapPlaces = useMemo(() => shown.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon })), [shown]);
  const [limit, setLimit] = useState(PAGE);
  const listKey = `${cat}|${radius}|${places.length}`;
  const [seenKey, setSeenKey] = useState(listKey);
  if (seenKey !== listKey) {
    setSeenKey(listKey);
    setLimit(PAGE);
  }
  const isMap = view === 'map' && !!pos && Platform.OS !== 'web';

  const controls = (
    <>
      <ChipRow>
        {CATS.map((c) => <Chip key={c.value} label={c.value === 'fav' ? `收藏（${store.favPlaces.length}）` : c.label} on={cat === c.value} onPress={() => setCat(c.value)} />)}
      </ChipRow>
      {cat !== 'fav' ? (
        <Segment options={[{ value: '1000', label: '1 公里' }, { value: '3000', label: '3 公里' }, { value: '5000', label: '5 公里' }]} value={radius} onChange={setRadius} />
      ) : null}
      <Segment options={[{ value: 'list', label: '清單' }, { value: 'map', label: '地圖' }]} value={view} onChange={setView} />
    </>
  );

  // Map view: no ScrollView, so dragging the map never fights page scrolling.
  if (isMap && pos) {
    return (
      <Screen title="找醫院與友善地點" scroll={false}>
        {controls}
        <Sub>
          {cat === 'fav' ? `收藏的地點 ${shown.length} 筆` : phase === 'searching' ? '正在搜尋附近地點…' : `半徑 ${Number(radius) / 1000} 公里 · ${shown.length} 筆${stale ? ' · 上次結果' : ''}`}
          　藍點是你的位置，點紅色標記看名稱。
        </Sub>
        <MapPreview center={pos} places={mapPlaces} style={{ flex: 1, height: undefined, minHeight: 240 }} />
      </Screen>
    );
  }

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
                {vet.phone ? <Btn small kind="outline" title="撥打" style={{ flex: 1 }} onPress={() => callPhone(vet.phone)} /> : null}
              </Row>
            </Card>
          ) : (
            <Card style={{ gap: 10 }}>
              <Sub>還沒有設定{pet.name}的主治醫院。可以從下方搜尋結果按「設為主治醫院」，或手動輸入。</Sub>
              <Btn small kind="outline" title="手動設定主治醫院" onPress={() => nav.push('vetEdit', { petId: pet.id })} />
            </Card>
          )}
        </View>
      ) : null}

      {controls}

      {phase === 'denied' && cat !== 'fav' ? (
        <Card style={{ gap: 10, backgroundColor: C.yellowBg, borderWidth: 0 }}>
          <Text style={{ fontSize: 14, color: '#5E4512', lineHeight: 21 }}>需要定位權限才能找附近的地點。請到手機設定允許定位，回到 App 後會自動重新搜尋；也可以用下方的 Google 地圖搜尋。</Text>
          <Row gap={8}>
            <Btn small kind="dark" title="開啟設定" onPress={() => Linking.openSettings().catch(() => {})} />
            <Btn small kind="outline" title="重試" onPress={locate} />
          </Row>
        </Card>
      ) : null}

      {(phase === 'locating' || phase === 'searching' || phase === 'idle') && cat !== 'fav' ? (
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <ActivityIndicator color={C.accent} />
          <Sub>{phase === 'searching' ? '正在搜尋附近地點…（最多約 50 秒）' : '正在取得你的位置…'}</Sub>
          {phase === 'searching' ? <Btn small kind="ghost" title="停止" onPress={() => { ctl.current?.abort(); setPhase('error'); }} /> : null}
        </Card>
      ) : null}

      {phase === 'error' && cat !== 'fav' ? (
        <Banner kind="danger" text="暫時無法取得位置或附近地點。地圖資料伺服器可能忙碌，請稍後再試，或用下方 Google 地圖搜尋。" action={{ label: '重試', onPress: () => (pos ? search() : locate()) }} />
      ) : null}

      {(phase === 'done' || cat === 'fav') ? (
        <View style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Sub style={{ flex: 1 }}>
              {cat === 'fav' ? `收藏的地點 ${shown.length} 筆` : `目前位置附近 · 半徑 ${km} 公里 · 共 ${shown.length} 筆${stale ? ' · 上次結果' : ''}`}
            </Sub>
            {cat !== 'fav' ? <Btn small kind="soft" title="重新定位" onPress={locate} /> : null}
          </Row>
          {view === 'map' && pos ? <MapPreview center={pos} places={mapPlaces} /> : null}
          {shown.length ? shown.slice(0, limit).map((p) => {
            const fav = isFav(p);
            return (
              <Card key={p.id} style={{ gap: 8 }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{p.name}</Text>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>
                      <Badge text={p.kind} />
                      {p.h24 ? <Badge text="24 小時" bg={C.dangerBg} fg={C.danger} /> : null}
                      {p.exotic ? <Badge text="異寵" bg={C.purpleBg} fg="#5B3F60" /> : null}
                    </Row>
                  </View>
                  {isFinite(p.dist) ? <Text style={{ fontSize: 15, fontWeight: '600', color: C.sub }}>{distText(p.dist)}</Text> : null}
                  <Pressable onPress={() => toggleFav(p)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={fav ? '取消收藏' : '收藏'} accessibilityState={{ selected: fav }}>
                    <Text style={{ fontSize: 22, color: fav ? C.danger : C.sub }}>{fav ? '♥' : '♡'}</Text>
                  </Pressable>
                </Row>
                {p.addr ? <Sub>{p.addr}</Sub> : null}
                {p.hours ? <Sub>營業時間 {zhHours(p.hours)}</Sub> : null}
                {p.phone ? <Sub>電話 {p.phone}</Sub> : null}
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  <Btn small kind="dark" title="導航" onPress={() => navTo(p)} />
                  {p.phone ? <Btn small kind="outline" title="撥打" onPress={() => callPhone(p.phone.split(/[;,]/)[0])} /> : null}
                  {p.website ? <Btn small kind="ghost" title="網站" onPress={() => openUrl(p.website)} /> : null}
                  {pet && p.kind === '動物醫院' && store.vets[pet.id]?.name !== p.name ? <Btn small kind="soft" title="設為主治醫院" onPress={() => setAsVet(p)} /> : null}
                  {pet && p.phone ? <Btn small kind="ghost" title="加入聯絡人" onPress={() => addContact(p)} /> : null}
                </Row>
              </Card>
            );
          }) : (
            <Empty text={cat === 'fav' ? '還沒有收藏的地點。在搜尋結果按愛心就能收藏，沒有網路時也能查看。' : `半徑 ${km} 公里內沒有找到資料。可以改成更大的範圍，或用下方 Google 地圖搜尋。`} />
          )}
          {shown.length > limit ? <Btn kind="soft" title={`顯示更多（還有 ${shown.length - limit} 筆）`} onPress={() => setLimit((n) => n + PAGE)} /> : null}
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
