// Every pushable screen, by route name. Push with useNav().push('<name>', params).
import type React from 'react';
import FormScreen from './FormScreen';
import LogPickerScreen from './LogPickerScreen';
import PetEditScreen from './PetEditScreen';
import ProfileScreen from './ProfileScreen';
import MembersScreen from './MembersScreen';
import TasksScreen from './TasksScreen';
import SettingsScreen from './SettingsScreen';
import VetEditScreen from './VetEditScreen';
import AiScreen from './tools/AiScreen';
import SosScreen from './tools/SosScreen';
import ToxicScreen from './tools/ToxicScreen';
import LostScreen from './tools/LostScreen';
import MedsScreen from './tools/MedsScreen';
import ReportScreen from './tools/ReportScreen';
import DocsScreen from './tools/DocsScreen';
import ExpenseScreen from './tools/ExpenseScreen';
import SuppliesScreen from './tools/SuppliesScreen';
import GroomScreen from './tools/GroomScreen';
import ScanScreen from './tools/ScanScreen';
import CareSheetScreen from './tools/CareSheetScreen';
import MilestonesScreen from './tools/MilestonesScreen';
import LearnScreen from './tools/LearnScreen';
import ArticleScreen from './tools/ArticleScreen';
import PlacesScreen from './tools/PlacesScreen';

export const SCREENS: Record<string, React.ComponentType<{ params: any }>> = {
  form: FormScreen, // { form: 'feed'|'health'|'growth'|'reminder'|'diary'|'contact', petId?, editId? }
  logPicker: LogPickerScreen,
  petEdit: PetEditScreen, // { petId? }
  profile: ProfileScreen, // { petId }
  members: MembersScreen,
  tasks: TasksScreen, // { petId }
  settings: SettingsScreen,
  vetEdit: VetEditScreen, // { petId }
  ai: AiScreen,
  sos: SosScreen,
  toxic: ToxicScreen,
  lost: LostScreen,
  meds: MedsScreen,
  report: ReportScreen,
  docs: DocsScreen,
  expense: ExpenseScreen,
  supplies: SuppliesScreen,
  groom: GroomScreen,
  scan: ScanScreen,
  care: CareSheetScreen,
  miles: MilestonesScreen,
  learn: LearnScreen,
  article: ArticleScreen, // { id }
  places: PlacesScreen,
};
