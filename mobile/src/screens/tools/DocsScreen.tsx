import React, { useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, Text, View } from 'react-native';
import { Screen, Btn, Card, Chip, ChipRow, Choice, Field, DateField, Toggle, Badge, PetChips, Sub, Row, Label, Empty, Banner, confirm } from '../../ui/kit';
import { C } from '../../ui/theme';
import { useStore, usePet } from '../../lib/store';
import { useBackHandler } from '../../nav';
import type { Doc, Store } from '../../lib/types';
import { addMonths, daysBetween, today } from '../../lib/date';
import { deleteFile, esc, imageDataUri, mimeOf, pdfShell, pickDocument, pickPhotos, sharePdf, shareFile, usePendingFiles } from '../../lib/files';
import { uid } from '../../lib/seed';

const CATS = ['疫苗證明', '檢驗報告', '證件', '保險', '收據'];
/** Categories that usually expire a year after the document date. */
const YEARLY = ['疫苗證明', '保險'];

const pdfLike = (uri: string | null, mime = '', name = '') => /pdf/i.test(mime) || /\.pdf$/i.test(name) || /\.pdf$/i.test(uri ?? '');
const isPdf = (d: Doc) => pdfLike(d.fileUri, d.mime, d.fileName);
const imagesOf = (d: Doc) => [...(d.fileUri && !isPdf(d) ? [d.fileUri] : []), ...(d.pages || [])];

function expBadge(d: Doc): { text: string; bg: string; fg: string } | null {
  if (!d.exp) return null;
  const n = daysBetween(today(), d.exp);
  if (n < 0) return { text: '已過期', bg: C.danger, fg: '#fff' };
  if (n <= 30) return { text: `${n} 天後到期`, bg: C.yellowBg, fg: C.yellowInk };
  return null;
}

type Picked = { uri: string; name: string; mime: string };

async function pickSource(kind: 'camera' | 'library' | 'pdf'): Promise<Picked | null> {
  if (kind === 'pdf') return pickDocument();
  const u = await pickPhotos({ camera: kind === 'camera', max: 1 });
  return u[0] ? { uri: u[0], name: '', mime: 'image/jpeg' } : null;
}

function Thumb({ d, size = 56 }: { d: Doc; size?: number }) {
  const imgs = imagesOf(d);
  if (imgs[0])
    return (
      <View>
        <Image source={{ uri: imgs[0] }} style={{ width: size, height: size * 1.2, borderRadius: 10, backgroundColor: C.sand }} />
        {imgs.length > 1 ? (
          <View style={{ position: 'absolute', right: 2, bottom: 2, backgroundColor: 'rgba(59,47,40,.8)', borderRadius: 8, paddingHorizontal: 5 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{imgs.length} 頁</Text>
          </View>
        ) : null}
      </View>
    );
  return (
    <View style={{ width: size, height: size * 1.2, borderRadius: 10, backgroundColor: C.sand2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.sub }}>{d.fileUri ? 'PDF' : '無檔案'}</Text>
    </View>
  );
}

/**
 * Keep the expiry reminder linked to a document in step with it.
 * Only the title, date and pet follow the document; the user's own changes to the reminder
 * (notice days, notify on/off) are kept. An expired document keeps its existing reminder history.
 */
function syncReminder(s: Store, doc: Doc, remind: boolean) {
  const existing = s.reminders.find((r) => r.docId === doc.id);
  if (!remind || !doc.exp) {
    if (existing) s.reminders = s.reminders.filter((r) => r.docId !== doc.id);
    return;
  }
  if (existing) {
    if (existing.date !== doc.exp) existing.doneOnce = false;
    existing.title = `${doc.title} 到期`;
    existing.date = doc.exp;
    existing.petId = doc.petId;
    return;
  }
  if (doc.exp < today()) return; // already expired: nothing left to remind
  s.reminders.push({ id: uid('r'), petId: doc.petId, title: `${doc.title} 到期`, date: doc.exp, repeat: 'once', notify: true, history: [], docId: doc.id, lead: [30, 7, 1] });
}

const MAX_PAGES = 30;

function DocForm({ petId, doc, onDone, dirty }: { petId: string; doc: Doc | null; onDone: () => void; dirty: React.MutableRefObject<boolean> }) {
  const { store, update, toast, afterSave } = useStore();
  const files = usePendingFiles();
  const [file, setFile] = useState<Picked | null>(doc?.fileUri ? { uri: doc.fileUri, name: doc.fileName, mime: doc.mime } : null);
  const [pages, setPages] = useState<string[]>(doc?.pages ?? []);
  const [title, setTitle] = useState(doc?.title ?? '');
  const [cat, setCat] = useState(doc?.cat ?? CATS[0]);
  const [date, setDate] = useState(doc?.date ?? today());
  const [exp, setExp] = useState(doc?.exp ?? (YEARLY.includes(CATS[0]) ? addMonths(today(), 12) : ''));
  const [expTouched, setExpTouched] = useState(!!doc);
  const [remind, setRemind] = useState(doc ? store.reminders.some((r) => r.docId === doc.id) : true);
  const [tried, setTried] = useState(false);
  const touch = () => {
    dirty.current = true;
  };

  const autoExp = (c: string, d: string) => {
    if (expTouched) return;
    setExp(YEARLY.includes(c) ? addMonths(d, 12) : '');
  };

  const choose = async (k: 'camera' | 'library' | 'pdf') => {
    if (k === 'pdf' && pages.length) {
      const ok = await new Promise<boolean>((res) => {
        if (Platform.OS === 'web') return res(window.confirm(`改用 PDF？PDF 只能放一個檔案，已加入的 ${pages.length} 頁照片會移除。`));
        Alert.alert('改用 PDF？', `PDF 只能放一個檔案，已加入的 ${pages.length} 頁照片會移除。`, [
          { text: '取消', style: 'cancel', onPress: () => res(false) },
          { text: '改用 PDF', style: 'destructive', onPress: () => res(true) },
        ], { cancelable: true, onDismiss: () => res(false) });
      });
      if (!ok) return;
    }
    const p = await pickSource(k);
    if (!p) return;
    touch();
    files.added(p.uri);
    if (file) files.removed(file.uri);
    setFile(p);
    if (pdfLike(p.uri, p.mime, p.name) && pages.length) {
      pages.forEach((u) => files.removed(u));
      setPages([]);
    }
    if (!title && p.name) setTitle(p.name.replace(/\.[^.]+$/, ''));
  };

  const addPage = async (camera: boolean) => {
    const u = await pickPhotos({ camera, max: 1 });
    if (!u[0]) return;
    touch();
    files.added(u[0]);
    setPages((cur) => [...cur, u[0]]);
  };

  const save = () => {
    if (!title.trim()) {
      setTried(true);
      return;
    }
    const d: Doc = {
      id: doc?.id ?? uid('d'),
      petId,
      cat,
      title: title.trim(),
      date,
      exp: exp || null,
      fileUri: file?.uri ?? null,
      fileName: file?.name ?? '',
      mime: file?.mime ?? '',
      pages,
    };
    update((s) => {
      const i = s.docs.findIndex((x) => x.id === d.id);
      if (i >= 0) s.docs[i] = d;
      else s.docs.push(d);
      syncReminder(s, d, remind && !!d.exp);
    });
    files.commit(afterSave);
    dirty.current = false;
    toast(remind && exp && exp >= today() ? '已儲存，到期前 30 天、7 天和前一天會提醒' : '文件已儲存');
    onDone();
  };

  const firstIsPdf = file ? pdfLike(file.uri, file.mime, file.name) : false;

  return (
    <Card style={{ gap: 14 }}>
      <Label>檔案</Label>
      <Row>
        <Btn small kind="soft" title="拍照" style={{ flex: 1 }} onPress={() => choose('camera')} />
        <Btn small kind="soft" title="相簿" style={{ flex: 1 }} onPress={() => choose('library')} />
        <Btn small kind="soft" title="選擇 PDF" style={{ flex: 1 }} onPress={() => choose('pdf')} />
      </Row>
      {file ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {firstIsPdf ? (
              <Badge text={`PDF · ${file.name || '文件'}`} />
            ) : (
              <Pressable
                onPress={() =>
                  confirm('移除第 1 頁？', pages.length ? '第 2 頁會變成第 1 頁。' : '', () => {
                    touch();
                    files.removed(file.uri);
                    if (pages.length) {
                      setFile({ uri: pages[0], name: '', mime: 'image/jpeg' });
                      setPages((cur) => cur.slice(1));
                    } else setFile(null);
                  }, '移除')
                }
                accessibilityRole="button"
                accessibilityLabel="第 1 頁，點一下移除"
              >
                <Image source={{ uri: file.uri }} style={{ width: 72, height: 86, borderRadius: 10 }} />
              </Pressable>
            )}
            {pages.map((u, i) => (
              <Pressable
                key={u}
                onPress={() =>
                  confirm(`移除第 ${i + 2} 頁？`, '', () => {
                    touch();
                    files.removed(u);
                    setPages((cur) => cur.filter((x) => x !== u));
                  }, '移除')
                }
                accessibilityRole="button"
                accessibilityLabel={`第 ${i + 2} 頁，點一下移除`}
              >
                <Image source={{ uri: u }} style={{ width: 72, height: 86, borderRadius: 10 }} />
              </Pressable>
            ))}
          </View>
          <Row>
            {!firstIsPdf ? <Btn small kind="outline" title="＋ 拍下一頁" onPress={() => addPage(true)} /> : null}
            {!firstIsPdf ? <Btn small kind="outline" title="＋ 相簿加頁" onPress={() => addPage(false)} /> : null}
            <Btn
              small
              kind="ghost"
              title="移除檔案"
              onPress={() => {
                touch();
                files.removed(file.uri);
                pages.forEach((u) => files.removed(u));
                setFile(null);
                setPages([]);
              }}
            />
          </Row>
          {!firstIsPdf ? <Sub>多頁的檢驗報告或正反面的證件，可以一頁一頁加進來。點縮圖可移除該頁。</Sub> : null}
        </View>
      ) : (
        <Sub>可以先不附檔，之後再補上。</Sub>
      )}
      <Field label="文件名稱" required value={title} onChangeText={(t) => { touch(); setTitle(t); }} placeholder="例如：狂犬病注射證明" error={tried && !title.trim() ? '請填寫文件名稱' : null} />
      <View style={{ gap: 8 }}>
        <Label>分類</Label>
        <Choice options={CATS.map((c) => ({ value: c, label: c }))} value={cat} onChange={(c: string) => { touch(); setCat(c); autoExp(c, date); }} />
      </View>
      <DateField label="日期" value={date} onChange={(v) => { if (!v) return; touch(); setDate(v); autoExp(cat, v); }} />
      <DateField label="到期日（選填）" value={exp} onChange={(v) => { touch(); setExp(v); setExpTouched(true); }} optional />
      {!expTouched && YEARLY.includes(cat) ? <Sub>{cat}通常一年後到期，已幫你預填，可以修改。</Sub> : null}
      {exp ? <Toggle label="到期前提醒我" value={remind} onChange={(v) => { touch(); setRemind(v); }} hint="到期前 30 天、7 天和前一天各提醒一次" /> : null}
      <Row>
        <Btn kind="outline" title="取消" style={{ flex: 1 }} onPress={() => { files.discard(); dirty.current = false; onDone(); }} />
        <Btn title="儲存" style={{ flex: 1 }} onPress={save} />
      </Row>
    </Card>
  );
}

function DocDetail({ doc, onClose, onEdit }: { doc: Doc; onClose: () => void; onEdit: () => void }) {
  const { update, toast } = useStore();
  const pdf = isPdf(doc);
  const imgs = imagesOf(doc);
  const b = expBadge(doc);
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{doc.title}</Text>
        <Sub>{[doc.cat, doc.date.replace(/-/g, '/'), doc.exp ? `到期 ${doc.exp.replace(/-/g, '/')}` : ''].filter(Boolean).join(' · ')}</Sub>
        {b ? <Badge text={b.text} bg={b.bg} fg={b.fg} /> : null}
      </Card>
      {pdf && doc.fileUri ? (
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: C.sub }}>PDF</Text>
          <Sub>{doc.fileName || doc.title}</Sub>
          <Btn title="開啟／分享" onPress={() => shareFile(doc.fileUri!, 'application/pdf', doc.title)} />
        </Card>
      ) : null}
      {imgs.map((u, i) => (
        <View key={u} style={{ gap: 6 }}>
          {imgs.length > 1 ? <Sub>第 {i + 1} 頁，共 {imgs.length} 頁</Sub> : null}
          <Image source={{ uri: u }} resizeMode="contain" style={{ width: '100%', height: 420, borderRadius: 16, backgroundColor: C.sand }} />
          <Btn small kind="outline" title={imgs.length > 1 ? `分享第 ${i + 1} 頁` : '分享'} onPress={() => shareFile(u, mimeOf(u), doc.title)} style={{ alignSelf: 'flex-start' }} />
        </View>
      ))}
      {!doc.fileUri && !imgs.length ? (
        <Card style={{ gap: 10 }}>
          <Sub>尚未附檔</Sub>
          <Btn small kind="outline" title="編輯並附加檔案" onPress={onEdit} />
        </Card>
      ) : null}
      <Row>
        <Btn kind="outline" title="編輯" style={{ flex: 1 }} onPress={onEdit} />
        <Btn
          kind="danger"
          title="刪除"
          style={{ flex: 1 }}
          onPress={() =>
            confirm('刪除文件', `確定刪除「${doc.title}」嗎？檔案和到期提醒也會一起刪除。`, () => {
              deleteFile(doc.fileUri);
              (doc.pages || []).forEach((u) => deleteFile(u));
              update((s) => {
                s.docs = s.docs.filter((x) => x.id !== doc.id);
                s.reminders = s.reminders.filter((r) => r.docId !== doc.id);
              });
              toast('已刪除');
              onClose();
            })
          }
        />
      </Row>
      <Btn kind="ghost" title="返回列表" onPress={onClose} />
    </View>
  );
}

export default function DocsScreen(_: { params: any }) {
  const { store, petId, setPetId, toast } = useStore();
  const pet = usePet();
  const [cat, setCat] = useState('全部');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Doc | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const scrollRef = useRef<any>(null);

  const closeForm = () => {
    dirty.current = false;
    setForm(null);
  };
  useBackHandler(
    form || openId || selecting
      ? () => {
          if (form) {
            if (dirty.current) confirm('放棄未儲存的內容？', '剛才的修改不會保留。', closeForm, '放棄');
            else closeForm();
          } else if (openId) setOpenId(null);
          else {
            setSelecting(false);
            setSel([]);
          }
          return true;
        }
      : null,
  );

  if (!pet) {
    return (
      <Screen title="文件夾" subtitle="證明、報告、保單">
        <Sub>請先新增一隻寵物。</Sub>
      </Screen>
    );
  }

  const openForm = (d: Doc | 'new') => {
    dirty.current = false;
    setOpenId(null);
    setForm(d);
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  };

  if (form) {
    return (
      <Screen title={form === 'new' ? '新增文件' : '編輯文件'} subtitle={pet.name} scrollRef={scrollRef}>
        <DocForm petId={pet.id} doc={form === 'new' ? null : form} dirty={dirty} onDone={() => setForm(null)} />
      </Screen>
    );
  }

  const open = openId ? store.docs.find((d) => d.id === openId) : null;
  if (open) {
    return (
      <Screen title="文件" subtitle={pet.name} scrollRef={scrollRef}>
        <DocDetail doc={open} onClose={() => setOpenId(null)} onEdit={() => openForm(open)} />
      </Screen>
    );
  }

  const query = q.trim().toLowerCase();
  const list = store.docs
    .filter((d) => d.petId === pet.id && (cat === '全部' || d.cat === cat) && (!query || d.title.toLowerCase().includes(query) || d.cat.includes(query)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const visibleSel = list.filter((d) => sel.includes(d.id));
  const hiddenSel = sel.length - visibleSel.length;
  const merge = async () => {
    // Only what the user can see is merged; selections hidden by the search or category are left out.
    const docs = visibleSel;
    if (!docs.length) return;
    setBusy(true);
    try {
      const parts: string[] = [];
      const pdfNames: string[] = [];
      let pagesLeft = MAX_PAGES;
      let skipped = 0;
      docs.forEach((d, idx) => {
        if (idx > 0) parts.push('<div style="page-break-before:always"></div>');
        parts.push(`<h2>${esc(d.title)}</h2><p style="color:#7A685B;margin:0 0 8px">${esc([d.cat, d.date.replace(/-/g, '/'), d.exp ? '到期 ' + d.exp.replace(/-/g, '/') : ''].filter(Boolean).join(' · '))}</p>`);
        parts.push(`@@IMAGES:${d.id}@@`);
      });
      const imgHtml: Record<string, string> = {};
      for (const d of docs) {
        const chunks: string[] = [];
        if (isPdf(d) && d.fileUri) pdfNames.push(d.fileName || d.title);
        for (const u of imagesOf(d)) {
          if (pagesLeft <= 0) {
            skipped++;
            continue;
          }
          const src = await imageDataUri(u, 1000);
          if (src) {
            pagesLeft--;
            chunks.push(`<div style="page-break-inside:avoid;margin:8px 0"><img src="${src}" style="max-width:100%;max-height:740px;display:block;margin:0 auto"/></div>`);
          }
        }
        if (!d.fileUri && !imagesOf(d).length) chunks.push('<p style="color:#776557">（尚未附檔）</p>');
        imgHtml[d.id] = chunks.join('');
      }
      let html = parts.join('').replace(/@@IMAGES:([^@]+)@@/g, (_m, id) => imgHtml[id] ?? '');
      if (pdfNames.length) html += `<h2>另附 PDF 檔</h2><p>${pdfNames.map(esc).join('、')}（PDF 檔需另外分享）</p>`;
      if (skipped) html += `<p style="color:#776557">為避免檔案過大，只放入前 ${MAX_PAGES} 頁，另有 ${skipped} 頁未放入。</p>`;
      const ok = await sharePdf(pdfShell(`${pet.name} 文件`, `<h1>${esc(pet.name)} 文件（${docs.length} 份）</h1>${html}`), `${pet.name}-文件合併`);
      if (ok) {
        setSelecting(false);
        setSel([]);
        if (skipped) toast(`只放入前 ${MAX_PAGES} 頁，另有 ${skipped} 頁沒有放入`);
      } else toast('沒有分享出去，勾選保留，可以再試一次');
    } catch {
      toast('合併失敗，請再試一次');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="文件夾" subtitle="證明、報告、保單" scrollRef={scrollRef}>
      <PetChips value={petId} onChange={(id) => { setPetId(id); setSelecting(false); setSel([]); }} />
      <Field value={q} onChangeText={setQ} placeholder="搜尋文件名稱" />
      <ChipRow>
        {['全部', ...CATS].map((c) => (
          <Chip key={c} label={c} on={cat === c} onPress={() => setCat(c)} />
        ))}
      </ChipRow>
      {selecting ? (
        <Card style={{ gap: 10, backgroundColor: C.blueBg, borderWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.blueInk }}>已選 {visibleSel.length} 份，合併成一份 PDF</Text>
          {hiddenSel > 0 ? <Sub>另有 {hiddenSel} 份已勾選但被搜尋或分類隱藏，不會放入。</Sub> : null}
          <Sub>適合申請寵物保險理賠（收據＋診斷證明）或寄宿時提供疫苗證明。</Sub>
          <Row>
            <Btn title={busy ? '產生中…' : '合併並分享'} style={{ flex: 1 }} disabled={!visibleSel.length || busy} onPress={merge} />
            <Btn kind="outline" title="取消" onPress={() => { setSelecting(false); setSel([]); }} />
          </Row>
        </Card>
      ) : (
        <Row>
          <Btn kind="outline" title="＋ 新增文件" onPress={() => openForm('new')} style={{ flex: 1, borderStyle: 'dashed' }} />
          {list.length > 1 ? <Btn kind="ghost" title="合併成 PDF" onPress={() => setSelecting(true)} /> : null}
        </Row>
      )}
      {store.docs.some((d) => d.petId === pet.id && d.exp && daysBetween(today(), d.exp) < 0) ? (
        <Banner kind="warn" text="有文件已經過期，記得更新（例如狂犬病疫苗證明每年都要重新施打）。" />
      ) : null}
      {list.length ? (
        list.map((d) => {
          const b = expBadge(d);
          const on = sel.includes(d.id);
          return (
            <Card
              key={d.id}
              onPress={() => (selecting ? setSel((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id])) : setOpenId(d.id))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderColor: selecting && on ? C.ink : C.line }}
            >
              {selecting ? (
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: on ? C.ink : '#CDBBA6', backgroundColor: on ? C.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text> : null}
                </View>
              ) : null}
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
          <Empty text={query ? '找不到符合的文件' : cat === '全部' ? `${pet.name}還沒有文件。把疫苗證明、保單拍下來存在這裡，看診時就不用翻抽屜。` : `沒有「${cat}」的文件`} />
        </Card>
      )}
    </Screen>
  );
}
