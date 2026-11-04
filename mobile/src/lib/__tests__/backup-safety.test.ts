// Round 7: backup limits, all-or-nothing restore, unique restore names, old .json paths,
// notification tap de-duplication and the backup reminder using the phone's local date.
import JSZip from 'jszip';
import {
  FULL_BACKUP_MAX_BYTES,
  RestoreSpaceError,
  fixJsonBackupPaths,
  fullBackupAllowed,
  packZip,
  packZipChunks,
  restoreNames,
  unpackZip,
  writeAllOrNothing,
} from '../backup';
import { firstTap, planNotifications } from '../notify';
import { backupNudge } from '../domain';
import { sampleStore, emptyStore } from '../seed';

describe('full backup size limit', () => {
  test('files up to the limit are allowed, above it only a data backup', () => {
    expect(fullBackupAllowed(0)).toBe(true);
    expect(fullBackupAllowed(FULL_BACKUP_MAX_BYTES)).toBe(true);
    expect(fullBackupAllowed(FULL_BACKUP_MAX_BYTES + 1)).toBe(false);
    expect(FULL_BACKUP_MAX_BYTES).toBe(120 * 1024 * 1024);
  });
});

describe('streamed zip', () => {
  test('chunks join into the same backup packZip makes', async () => {
    const files = [
      { name: 'a.jpg', bytes: new Uint8Array(5000).fill(7) },
      { name: 'b.pdf', bytes: new TextEncoder().encode('pdf') },
    ];
    const chunks: Uint8Array[] = [];
    await packZipChunks({ pets: [{ id: 'p' }] }, files, (c) => chunks.push(c));
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const joined = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      joined.set(c, o);
      o += c.length;
    }
    const un = await unpackZip(joined);
    expect(un.data.pets[0].id).toBe('p');
    expect(un.files.map((f) => f.name).sort()).toEqual(['a.jpg', 'b.pdf']);
    expect((await un.files.find((f) => f.name === 'a.jpg')!.read()).length).toBe(5000);
    expect(un.files.find((f) => f.name === 'a.jpg')!.size).toBe(5000);
  });

  test('entries outside files/ or with ../ are ignored', async () => {
    const zip = new JSZip();
    zip.file('data.json', JSON.stringify({ pets: [] }));
    zip.file('files/ok.jpg', 'x');
    zip.file('files/sub/deep.jpg', 'x');
    zip.file('files/..evil.jpg', 'x');
    const un = await unpackZip(await zip.generateAsync({ type: 'uint8array' }));
    expect(un.files.map((f) => f.name)).toEqual(['ok.jpg']);
  });

  test('a normal backup still round-trips through packZip', async () => {
    const un = await unpackZip(await packZip({ v: 9 }, []));
    expect(un.data.v).toBe(9);
    expect(un.files).toEqual([]);
  });
});

describe('restore writes every file or none', () => {
  test('all written: returns the new paths', async () => {
    const m = await writeAllOrNothing([{ name: 'a' }, { name: 'b' }], async (n) => `file:///new/${n}`, () => {});
    expect([...m]).toEqual([
      ['a', 'file:///new/a'],
      ['b', 'file:///new/b'],
    ]);
  });

  test('a failed write removes what was written and reports the space needed', async () => {
    const removed: string[] = [];
    const files = [
      { name: 'a', size: 3 * 1048576 },
      { name: 'b', size: 2 * 1048576 },
      { name: 'c', size: 1 },
    ];
    let err: unknown = null;
    try {
      await writeAllOrNothing(
        files,
        async (n) => {
          if (n === 'c') throw new Error('disk full');
          return `file:///new/${n}`;
        },
        (u) => removed.push(u),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RestoreSpaceError);
    expect((err as RestoreSpaceError).neededMB).toBe(6);
    expect(removed.sort()).toEqual(['file:///new/a', 'file:///new/b']);
  });
});

describe('restore file names', () => {
  test('names that clean up to the same file name stay apart', () => {
    const m = restoreNames(['a b.jpg', 'a_b.jpg', 'c.jpg'], 'x1');
    const dests = [...m.values()];
    expect(new Set(dests).size).toBe(3);
    expect(m.get('a b.jpg')).toBe('rx1_a_b.jpg');
    expect(m.get('a_b.jpg')).toBe('rx1_2_a_b.jpg');
  });
});

describe('old .json backups on a new phone', () => {
  test('app-folder paths move to this phone; missing files are cleared without leaving holes', () => {
    const root = 'file:///data/user/0/tw.petpal.app/files/';
    const here = new Set([root + 'petpal/a.jpg']);
    const data: any = {
      pets: [{ id: 'p', photo: 'file:///var/mobile/Containers/Data/Application/OLD/Documents/petpal/a.jpg' }],
      journal: [{ photos: ['file:///var/old/Documents/petpal/gone.jpg', 'file:///var/old/Documents/petpal/a.jpg'] }],
      expenses: [{ receipt: 'file:///var/old/Documents/petpal/gone2.jpg' }],
      docs: [],
      entries: [],
      milestones: [],
      lost: {},
    };
    fixJsonBackupPaths(data, root, (u) => here.has(u));
    expect(data.pets[0].photo).toBe(root + 'petpal/a.jpg');
    expect(data.journal[0].photos).toEqual([root + 'petpal/a.jpg']);
    expect(data.expenses[0].receipt).toBeUndefined();
  });
});

describe('notification taps', () => {
  test('each tap is handled once (launch tap reported twice, or again after a retry)', () => {
    expect(firstTap('n-1')).toBe(true);
    expect(firstTap('n-1')).toBe(false);
    expect(firstTap('n-2')).toBe(true);
    expect(firstTap(undefined)).toBe(true);
  });

  test('scheduled notifications carry the pet they are about', () => {
    const s: any = sampleStore();
    s.notifyEnabled = true;
    const plan = planNotifications(s, new Date('2026-11-04T06:00:00'));
    const meds = plan.filter((n) => n.kind === 'med');
    expect(meds.length).toBeGreaterThan(0);
    for (const n of meds) expect(s.pets.some((p: any) => p.id === n.petId)).toBe(true);
    expect(meds[0].title).not.toMatch(/ 該吃藥了/);
  });
});

describe('backup reminder uses the phone date', () => {
  // 00:30 local time: in Taiwan (UTC+8) the ISO string still says the day before.
  test('a backup made just after midnight counts from the local day, not the UTC day', () => {
    const s: any = emptyStore();
    s.entries = Array.from({ length: 25 }, (_, i) => ({ id: 'e' + i, petId: 'p', form: 'feed', at: '2026-10-31T09:00', who: 'm', v: {} }));
    s.lastBackupAt = new Date(2026, 9, 2, 0, 30).toISOString(); // 2026-10-02 00:30 on this phone
    expect(backupNudge(s, '2026-11-01')).toBeNull(); // 30 days since the local date
    expect(backupNudge(s, '2026-11-02')).toBe('stale');
  });
});
