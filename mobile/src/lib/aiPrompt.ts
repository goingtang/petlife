// Builds the text handed to an external AI app from the symptom checker (unit-tested in __tests__/aiPrompt.test.ts).
// Privacy promise shown to the user: no phone numbers, addresses or photos are included.
import type { Pet, Store } from './types';
import { KIND_LABEL, SEX_LABEL, entriesFor, entrySummary, medActiveOn } from './domain';
import { addDays, ageText } from './date';

/** Remove things that look like phone numbers or URLs from free text before it leaves the phone. */
export function scrubPrivate(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '[網址已移除]')
    .replace(/(?:\+?886[-\s]?|0)\d(?:[-\s]?\d){6,9}/g, '[電話已移除]')
    .replace(/\d{8,}/g, '[號碼已移除]');
}

export function buildAiPrompt(store: Store, pet: Pet, symptoms: string, details: string[], td: string): string {
  const cutoff = addDays(td, -30);
  const growth = entriesFor(store, pet.id, 'growth')[0];
  const meds = store.meds.filter((m) => m.petId === pet.id && medActiveOn(m, td)).map((m) => `${m.name}${m.dose ? ' ' + m.dose : ''}`);
  const health = entriesFor(store, pet.id, 'health')
    .filter((e) => e.at.slice(0, 10) >= cutoff)
    .slice(0, 5)
    .map((e) => `${e.at.slice(0, 10)} ${entrySummary(e)}`);
  return scrubPrivate(
    [
      '我是新手飼主，想先了解寵物目前的狀況。請用繁體中文、以一般照護資訊的角度回答；這不是診斷，必要時請直接建議我就醫。',
      '',
      '【寵物資料】',
      `名字：${pet.name}`,
      `種類：${KIND_LABEL[pet.kind]}${pet.breed ? '（' + pet.breed + '）' : ''}`,
      `年齡：${ageText(pet.birthday) || '不詳'}`,
      `性別：${SEX_LABEL[pet.sex]}${pet.neutered ? '，已結紮' : ''}`,
      `體重：${growth ? `${growth.v.weight} kg（${growth.at.slice(0, 10)} 記錄）` : '不詳'}`,
      `過敏：${pet.allergy || '無'}`,
      `目前用藥：${meds.join('、') || '無'}`,
      `近 30 天健康紀錄：${health.join('；') || '無'}`,
      '',
      '【目前狀況】',
      symptoms || '（尚未描述）',
      ...details,
      '',
      '請先用一行說明建議的就醫時機：立即就醫／24 小時內就醫／先在家觀察。',
      '接著用最多 4 點說明：可能的原因方向、在家可以觀察什麼、出現什麼情況要馬上就醫。',
      '最後提醒我這不是診斷，請以獸醫的檢查為準。',
    ].join('\n'),
  );
}
