/** Which lesson shows each workshop (for links on /progresso/). */
import { getCourse } from '../../lib/content';
import { findWorkshopIds } from './scan.mjs';

/** Workshop id → id of the first lesson that uses it. */
export async function workshopLessons(): Promise<Map<string, string>> {
  const { lessons } = await getCourse();
  const map = new Map<string, string>();
  for (const lesson of lessons) {
    for (const id of findWorkshopIds(lesson.body ?? '')) {
      if (!map.has(id)) map.set(id, lesson.id);
    }
  }
  return map;
}
