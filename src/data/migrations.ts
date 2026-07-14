import { CURRENT_DATA_VERSION, EssenceData, createEmptyData } from "./schema";
import { normalizeData } from "./validation";

export function migrateData(raw: unknown): EssenceData {
  if (!raw || typeof raw !== "object") {
    return createEmptyData();
  }

  const candidate = raw as Partial<EssenceData>;
  const version = Number.isFinite(candidate.version) ? Number(candidate.version) : 0;

  if (version > CURRENT_DATA_VERSION) {
    return normalizeData({ ...candidate, version: CURRENT_DATA_VERSION });
  }

  if (version <= 0) {
    return normalizeData({ ...candidate, version: 1 });
  }

  return normalizeData(candidate);
}
