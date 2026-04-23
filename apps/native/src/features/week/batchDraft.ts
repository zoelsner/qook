import { api } from '../../services/api';
import { pendingOrFailedDates, useBatchSession } from '../../stores/batchSession';
import { useWeekPlan } from '../../stores/weekPlan';
import type { ISODate } from './weekDates';

export interface BatchDraftOptions {
  redraftAll?: boolean;
}

export async function batchDraft(
  dates: ISODate[],
  options: BatchDraftOptions = {},
): Promise<void> {
  if (dates.length === 0) return;

  const { redraftAll = false } = options;
  const batch = useBatchSession.getState();
  const week = useWeekPlan.getState();

  let targets: ISODate[];
  if (redraftAll) {
    targets = dates.slice();
  } else {
    const hasExistingBatch = Object.keys(batch.perDate).length > 0;
    if (hasExistingBatch) {
      targets = pendingOrFailedDates(batch.perDate);
    } else {
      targets = dates.filter((date) => !week.plan[date]?.recipes?.length);
    }
  }

  if (targets.length === 0) {
    batch.complete();
    return;
  }

  if (Object.keys(batch.perDate).length === 0 || redraftAll) {
    batch.begin(dates);
    for (const date of dates) {
      if (!targets.includes(date)) {
        batch.setDate(date, 'success');
      }
    }
  } else {
    // Retrying an existing batch (perDate already populated from prior error).
    // Flip status back to 'drafting' so the WeekScreen drafting UI renders
    // while we re-process pending/failed dates. Preserves per-date success markers.
    useBatchSession.setState({ status: 'drafting', error: null });
  }

  for (const date of targets) {
    const energy = useWeekPlan.getState().plan[date]?.energy;
    if (!energy) {
      batch.setDate(date, 'success');
      continue;
    }

    batch.setDate(date, 'in-progress');

    try {
      const recipes = await api.generateRecipesForEnergy(energy);
      // Stale-write guard: re-read the plan after the await. If the user
      // cleared or re-tiered this day mid-flight, discard the result.
      // (Codex adversarial finding #2.)
      const currentEnergy = useWeekPlan.getState().plan[date]?.energy;
      if (currentEnergy !== energy) {
        batch.setDate(date, 'success');
        continue;
      }
      useWeekPlan.getState().setRecipes(date, recipes);
      batch.setDate(date, 'success');
    } catch (error: any) {
      batch.setDate(date, 'error');
      batch.fail(error?.message ?? 'Draft failed');
      return;
    }
  }

  batch.complete();
}
