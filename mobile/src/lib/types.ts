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

export interface Med {
  id: string;
  petId: string;
  name: string;
  dose: string;
  times: string[]; // HH:mm
  start: string;
  end: string | null; // inclusive, null = ongoing
  notify: boolean;
}

export interface Doc {
  id: string;
  petId: string;
  cat: string;
  title: string;
  date: string;
  exp: string | null;
  fileUri: string | null;
  fileName: string;
  mime: string;
}

export interface Expense {
  id: string;
  date: string;
  cat: string;
  amt: number;
  petId: string; // 'all' for shared
  note: string;
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
}

export interface GroomTask {
  id: string;
  petId: string;
  name: string;
  every: number; // days
  last: string; // YYYY-MM-DD
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
  budget: number;
  supplies: Supply[];
  groom: GroomTask[];
  milestones: Milestone[];
  saved: Record<string, boolean>;
  lost: Record<string, LostInfo>;
  care: Record<string, CareSheet>;
  timer: ActivityTimer | null;
  notifyEnabled: boolean;
}
