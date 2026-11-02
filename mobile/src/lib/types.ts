// PetPal data model. Everything is stored locally on the device (AsyncStorage).
// Dates are "YYYY-MM-DD" strings in the phone's local time; timestamps are "YYYY-MM-DDTHH:mm".

export type PetKind = 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
export type Sex = 'male' | 'female';

export interface Pet {
  id: string;
  name: string;
  kind: PetKind;
  breed: string;
  sex: Sex;
  birthday: string; // YYYY-MM-DD ('' if unknown)
  adopted: string; // YYYY-MM-DD ('' if unknown)
  neutered: boolean;
  chip: string;
  allergy: string;
  color: string;
  photo?: string; // local file uri
}

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface CareTask {
  id: string;
  petId: string;
  title: string;
  time: string; // HH:mm
  who: string; // member id
}

export type EntryForm = 'feed' | 'health' | 'growth' | 'activity';

export interface FeedValue { food: string; amount: number; appetite?: string; note?: string }
export interface HealthValue {
  hType: 'symptom' | 'med' | 'visit' | 'poop';
  signs?: string[];
  severity?: string;
  medName?: string;
  clinic?: string;
  stool?: string;
  docs?: string[];
  note?: string;
}
export interface GrowthValue { weight: number; length: number; body: string }
export interface ActivityValue { min: number }

export interface Entry {
  id: string;
  petId: string;
  form: EntryForm;
  at: string; // YYYY-MM-DDTHH:mm
  who: string; // member id
  v: any;
}

export type Repeat = 'once' | 'monthly' | 'yearly';

export interface Reminder {
  id: string;
  petId: string;
  title: string;
  date: string; // next due date YYYY-MM-DD
  repeat: Repeat;
  notify: boolean;
  history: string[]; // dates it was completed (YYYY-MM-DD)
  doneOnce?: boolean; // for 'once' reminders that are completed
  lead?: number[]; // extra notices N days before (default: the evening before only)
  docId?: string; // created from a document's expiry date
}

export interface Contact {
  id: string;
  petId: string;
  name: string;
  rel: string;
  phone: string;
  primary: boolean;
}

export interface Vet {
  name: string;
  doctor: string;
  phone: string;
  addr: string;
  hours: string;
}

export interface JournalEntry {
  id: string;
  petId: string;
  at: string;
  author: string; // member id
  mood: string;
  acts: string[];
  title: string;
  body: string;
  photos: string[];
  private: boolean;
}

export type MedFreq = 'daily' | 'weekly' | 'monthly';

export interface Med {
  id: string;
  petId: string;
  name: string;
  dose: string;
  times: string[]; // HH:mm
  start: string;
  end: string | null; // inclusive, null = ongoing
  notify: boolean;
  freq: MedFreq; // daily; weekly on the start weekday; monthly on the start day-of-month
  count: number | null; // doses left in the pack (null = not tracked)
  refillAt: number; // remind to refill when count <= this
}

export interface Doc {
  id: string;
  petId: string;
  cat: string;
  title: string;
  date: string;
  exp: string | null;
  fileUri: string | null; // PDF or the first page image
  fileName: string;
  mime: string;
  pages: string[]; // extra page images (page 2, 3…)
}

export interface Expense {
  id: string;
  date: string;
  cat: string;
  amt: number;
  petId: string; // 'all' for shared
  note: string;
  receipt?: string; // photo uri
  recurringId?: string; // created automatically from a RecurringExpense
}

export interface RecurringExpense {
  id: string;
  cat: string;
  amt: number;
  petId: string;
  note: string;
  day: number; // day of month 1–28
  lastPosted: string; // YYYY-MM of the last month it was added
}

export interface Supply {
  id: string;
  petId: string;
  name: string;
  unit: string;
  stock: number; // stock as of `asOf`
  use: number; // per day
  pack: number;
  asOf: string; // YYYY-MM-DD
  inCart: boolean;
  price?: number; // NT$ per pack
}

export interface GroomTask {
  id: string;
  petId: string;
  name: string;
  every: number; // days
  last: string; // YYYY-MM-DD
  history: string[]; // past completion dates, newest last
}

export interface Milestone {
  id: string;
  petId: string;
  date: string;
  title: string;
  photo?: string;
}

export interface LostInfo {
  active: boolean;
  place: string;
  time: string;
  features: string;
  reward: string;
  phone: string;
  photo?: string;
  since?: string;
  sinceTime?: string;
  sightings: Sighting[];
}

export interface Sighting {
  id: string;
  at: string; // YYYY-MM-DDTHH:mm
  place: string;
  note: string;
}

export interface FavPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  addr: string;
  phone: string;
  kind: string;
}

export interface ScanResult {
  id: string;
  name: string;
  date: string;
  score: number;
  protein?: number; // dry-matter %
  text: string;
}

export interface CareSheet { from: string; to: string; notes: string }

export interface ActivityTimer {
  petId: string;
  startedAt: number | null; // epoch ms when running, null when paused
  accumulated: number; // seconds before the current run
}

export interface Store {
  v: number;
  onboarded: boolean;
  me: string; // member id of the person using this phone
  ownerId: string; // member who created this household (can delete anything)
  ownerPhone: string;
  erVet: Vet | null; // night / holiday emergency hospital, shared by all pets
  members: Member[];
  pets: Pet[];
  tasks: CareTask[];
  taskDone: Record<string, Record<string, string>>; // date -> taskId -> memberId
  entries: Entry[];
  reminders: Reminder[];
  contacts: Contact[];
  vets: Record<string, Vet>;
  journal: JournalEntry[];
  meds: Med[];
  doses: Record<string, 'taken' | 'skip'>; // `${date}|${medId}|${time}`
  docs: Doc[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  budget: number;
  catBudgets: Record<string, number>;
  supplies: Supply[];
  groom: GroomTask[];
  milestones: Milestone[];
  saved: Record<string, boolean>;
  lost: Record<string, LostInfo>;
  care: Record<string, CareSheet>;
  timer: ActivityTimer | null;
  notifyEnabled: boolean;
  favPlaces: FavPlace[];
  scans: ScanResult[];
  hideRecorder: boolean; // hide family names in reports given to the vet
}
