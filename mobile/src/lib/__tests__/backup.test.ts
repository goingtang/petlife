import { prepareBackupData, restoreFileRefs, packZip, unpackZip, FILE_REF } from '../backup';
import { sampleStore } from '../seed';

const A = 'file:///old/Documents/petpal/f_a.jpg';
const B = 'file:///old/Documents/petpal/f_b.pdf';

function storeWithFiles() {
  const s: any = sampleStore();
  s.pets[0].photo = A;
  s.journal[0].photos = [A, 'file:///old/Documents/petpal/missing.jpg'];
  s.docs.push({ id: 'd1', petId: s.pets[0].id, cat: '證件', title: '登記證', date: '2026-01-01', exp: null, fileUri: B, fileName: 'x.pdf', mime: 'application/pdf', pages: [] });
  s.lost[s.pets[0].id] = { ...(s.lost[s.pets[0].id] || {}), photo: A, sightings: [] };
  return s;
}

describe('backup with photos', () => {
  test('references existing files once and keeps missing ones as they were', () => {
    const s = storeWithFiles();
    const { data, files } = prepareBackupData(s, (u) => !u.includes('missing'));
    expect(files.map((f) => f.name).sort()).toEqual(['f_a.jpg', 'f_b.pdf']);
    expect(data.pets[0].photo).toBe(FILE_REF + 'f_a.jpg');
    expect(data.journal[0].photos).toEqual([FILE_REF + 'f_a.jpg', 'file:///old/Documents/petpal/missing.jpg']);
    expect(s.pets[0].photo).toBe(A); // the live data is not changed
  });

  test('zip round trip restores data and files, pointing at the new paths', async () => {
    const s = storeWithFiles();
    const { data, files } = prepareBackupData(s, () => true);
    const bytes = await packZip(data, files.map((f) => ({ name: f.name, bytes: new TextEncoder().encode('content of ' + f.name) })));
    const un = await unpackZip(bytes);
    expect(un.files.map((f) => f.name).sort()).toEqual(['f_a.jpg', 'f_b.pdf', 'missing.jpg']);
    expect(new TextDecoder().decode(await un.files.find((f) => f.name === 'f_b.pdf')!.read())).toBe('content of f_b.pdf');
    const restored = restoreFileRefs(un.data, (n) => (n === 'missing.jpg' ? null : 'file:///new/petpal/r_' + n));
    expect(restored.pets[0].photo).toBe('file:///new/petpal/r_f_a.jpg');
    expect(restored.docs.find((d: any) => d.id === 'd1').fileUri).toBe('file:///new/petpal/r_f_b.pdf');
    expect(restored.journal[0].photos).toEqual(['file:///new/petpal/r_f_a.jpg']); // a file that didn't come back leaves no hole
    expect(restored._backup).toBeUndefined();
  });

  test('two different files with the same name get distinct names', () => {
    const s: any = sampleStore();
    s.pets[0].photo = 'file:///x/petpal/same.jpg';
    s.pets[1].photo = 'file:///y/petpal/same.jpg';
    const { files } = prepareBackupData(s, () => true);
    expect(new Set(files.map((f) => f.name)).size).toBe(2);
  });
});
