import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Screen, Btn, Card, Chip, ChipRow, Choice, Field, DateField, Toggle, Badge, PetChips, Sub, Row, Label, Empty, confirm } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import type { Doc } from '../../lib/types';
import { daysBetween, today } from '../../lib/date';
import { deleteFile, pickDocument, pickPhotos, shareFile } from '../../lib/files';
import { uid } from '../../lib/seed';

const CATS = ['疫苗證明', '檢驗報告', '證件', '保險', '收據'];

const isPdf = (d: { mime: string; fileName: string; fileUri: string | null }) => /pdf/i.test(d.mime) || /\.pdf$/i.test(d.fileName) || /\.pdf$/i.test(d.fileUri ?? '');

function expBadge(d: Doc): { text: string; bg: string; fg: string } | null {
  if (!d.exp) return null;
  const n = daysBetween(today(), d.exp);
  if (n < 0) return { text: '已過期', bg: C.danger, fg: '#fff' };
  if (n <= 30) return { text: '30 天內到期', bg: C.yellowBg, fg: C.yellowInk };
  return null;
}

type Picked = { uri: string; name: string; mime: string };

async function pickSource(kind: 'camera' | 'library' | 'pdf'): Promise<Picked | null> {
  if (kind === 'pdf') return pickDocument();
  const u = await pickPhotos({ camera: kind === 'camera', max: 1 });
  return u[0] ? { uri: u[0], name: '', mime: 'image/jpeg' } : null;
}

function Thumb({ d, size = 56 }: { d: Doc; size?: number }) {
  if (d.fileUri && !isPdf(d)) return <Image source={{ uri: d.fileUri }} style={{ width: size, height: size * 1.2, borderRadius: 10, backgroundColor: C.sand }} />;
  return (
    <View style={{ width: size, height: size * 1.2, borderRadius: 10, backgroundColor: C.sand2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: C.sub }}>{d.fileUri ? 'PDF' : '無檔案'}</Text>
    </View>
  );
}

function DocForm({ petId, onDone }: { petId: string; onDone: () => void }) {
  const { update, toast } = useStore();
  const [file, setFile] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState(CATS[0]);
  const [date, setDate] = useState(today());
  const [exp, setExp] = useState('');
  const [remind, setRemind] = useState(true);
  const [tried, setTried] = useState(false);

  const choose = async (k: 'camera' | 'library' | 'pdf') => {
    const p = await pickSource(k);
    if (!p) return;
    setFile(p);
    if (!title && p.name) setTitle(p.name.replace(/\.[^.]+$/, ''));
  };

  const save = () => {
    if (!title.trim()) {
      setTried(true);
      return;
    }
    const d: Doc = { id: uid('d'), petId, cat, title: title.trim(), date, exp: exp || null, fileUri: file?.uri ?? null, fileName: file?.name ?? '', mime: file?.mime ?? '' };
    update((s) => {
      s.docs.push(d);
      if (remind && exp && exp >= today()) s.reminders.push({ id: uid('r'), petId, title: `${d.title} 到期`, date: exp, repeat: 'once', notify: true, history: [] });
    });
    toast(remind && exp ? '已儲存，並建立到期提醒' : '文件已儲存');
    onDone();
  };

  return (
    <Card style={{ gap: 14 }}>
      <Label>檔案</Label>
      <Row>
        <Btn small kind="soft" title="拍照" style={{ flex: 1 }} onPress={() => choose('camera')} />
        <Btn small kind="soft" title="相簿" style={{ flex: 1 }} onPress={() => choose('library')} />
        <Btn small kind="soft" title="選擇 PDF" style={{ flex: 1 }} onPress={() => choose('pdf')} />
      </Row>
      {file ? (
        <Row>
          {/pdf/i.test(file.mime) || /\.pdf$/i.test(file.name) ? (
            <Badge text={`PDF · ${file.name || '文件'}`} />
          ) : (
            <Image source={{ uri: file.uri }} style={{ width: 72, height: 86, borderRadius: 10 }} />
          )}
          <Btn small kind="ghost" title="移除" onPress={() => setFile(null)} />
        </Row>
      ) : (
        <Sub>可以先不附檔，之後再補上。</Sub>
      )}
      <Field label="文件名稱" required value={title} onChangeText={setTitle} placeholder="例如：狂犬病注射證明" error={tried && !title.trim() ? '請填寫文件名稱' : null} />
      <View style={{ gap: 8 }}>
        <Label>分類</Label>
        <Choice options={CATS.map((c) => ({ value: c, label: c }))} value={cat} onChange={setCat} />
      </View>
      <DateField label="日期" value={date} onChange={(v) => v && setDate(v)} />
      <DateField label="到期日（選填）" value={exp} onChange={setExp} optional />
      {exp ? <Toggle label="到期前提醒我" value={remind} onChange={setRemind} hint="會在「健康」的提醒清單加入一筆" /> : null}
      <Row>
        <Btn kind="outline" title="取消" style={{ flex: 1 }} onPress={onDone} />
        <Btn title="儲存" style={{ flex: 1 }} onPress={save} />
      </Row>
    </Card>
  );
}

function DocDetail({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const { update, toast } = useStore();
  const pdf = isPdf(doc);
  const attach = async (k: 'camera' | 'library' | 'pdf') => {
    const p = await pickSource(k);
    if (!p) return;
    update((s) => {
      const x = s.docs.find((y) => y.id === doc.id);
      if (x) {
        x.fileUri = p.uri;
        x.fileName = p.name;
        x.mime = p.mime;
      }
    });
    toast('已附加檔案');
  };
  const b = expBadge(doc);
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{doc.title}</Text>
        <Sub>{[doc.cat, doc.date.replace(/-/g, '/'), doc.exp ? `到期 ${doc.exp.replace(/-/g, '/')}` : ''].filter(Boolean).join(' · ')}</Sub>
        {b ? <Badge text={b.text} bg={b.bg} fg={b.fg} /> : null}
      </Card>
      {doc.fileUri ? (
        pdf ? (
          <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: C.sub }}>PDF</Text>
            <Sub>{doc.fileName || doc.title}</Sub>
            <Btn title="開啟／分享" onPress={() => shareFile(doc.fileUri!, 'application/pdf', doc.title)} />
          </Card>
        ) : (
          <>
            <Image source={{ uri: doc.fileUri }} resizeMode="contain" style={{ width: '100%', height: 420, borderRadius: 16, backgroundColor: C.sand }} />
            <Btn kind="outline" title="分享" onPress={() => shareFile(doc.fileUri!, 'image/jpeg', doc.title)} />
          </>
        )
      ) : (
        <Card style={{ gap: 10 }}>
          <Sub>尚未附檔</Sub>
          <Row>
            <Btn small kind="soft" title="拍照" style={{ flex: 1 }} onPress={() => attach('camera')} />
            <Btn small kind="soft" title="相簿" style={{ flex: 1 }} onPress={() => attach('library')} />
            <Btn small kind="soft" title="PDF" style={{ flex: 1 }} onPress={() => attach('pdf')} />
          </Row>
        </Card>
      )}
      <Row>
        <Btn kind="outline" title="返回列表" style={{ flex: 1 }} onPress={onClose} />
        <Btn
          kind="danger"
          title="刪除"
          style={{ flex: 1 }}
          onPress={() =>
            confirm('刪除文件', `確定刪除「${doc.title}」嗎？檔案也會一起刪除。`, () => {
              deleteFile(doc.fileUri);
              update((s) => {
                s.docs = s.docs.filter((x) => x.id !== doc.id);
              });
              toast('已刪除');
              onClose();
            })
          }
        />
      </Row>
    </View>
  );
}

export default function DocsScreen(_: { params: any }) {
  const { store, petId, setPetId } = useStore();
  const pet = usePet();
  const [cat, setCat] = useState('全部');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!pet) {
    return (
      <Screen title="文件夾" subtitle="證明、報告、保單">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

  const open = openId ? store.docs.find((d) => d.id === openId) : null;
  if (open) {
    return (
      <Screen title="文件" subtitle={pet.name}>
        <DocDetail doc={open} onClose={() => setOpenId(null)} />
      </Screen>
    );
  }

  const list = store.docs.filter((d) => d.petId === pet.id && (cat === '全部' || d.cat === cat)).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Screen title="文件夾" subtitle="證明、報告、保單">
      <PetChips value={petId} onChange={(id) => { setPetId(id); setAdding(false); }} />
      <ChipRow>
        {['全部', ...CATS].map((c) => (
          <Chip key={c} label={c} on={cat === c} onPress={() => setCat(c)} />
        ))}
      </ChipRow>
      {adding ? (
        <DocForm petId={pet.id} onDone={() => setAdding(false)} />
      ) : (
        <Btn kind="outline" title="＋ 新增文件" onPress={() => setAdding(true)} style={{ borderStyle: 'dashed' }} />
      )}
      {list.length ? (
        list.map((d) => {
          const b = expBadge(d);
          return (
            <Card key={d.id} onPress={() => setOpenId(d.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Thumb d={d} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{d.title}</Text>
                <Sub>{[d.cat, d.date.replace(/-/g, '/'), d.exp ? `到期 ${d.exp.replace(/-/g, '/')}` : ''].filter(Boolean).join(' · ')}</Sub>
              </View>
              {b ? <Badge text={b.text} bg={b.bg} fg={b.fg} /> : null}
            </Card>
          );
        })
      ) : (
        <Card>
          <Empty text={cat === '全部' ? `${pet.name}還沒有文件。把疫苗證明、保單拍下來存在這裡，看診時就不用翻抽屜。` : `沒有「${cat}」的文件`} />
        </Card>
      )}
    </Screen>
  );
}
