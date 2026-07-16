import { CURRENT_DATA_VERSION, EssenceData, createEmptyData } from "./schema";
import { BUNDLED_CONFLUENCES, BUNDLED_ESSENCES } from "./library";
import { normalizeData } from "./validation";

function withBundledLibrary(raw: Partial<EssenceData>): Partial<EssenceData> {
  return {
    ...raw,
    essences: BUNDLED_ESSENCES,
    confluences: BUNDLED_CONFLUENCES,
  };
}

export function migrateData(raw: unknown): EssenceData {
  if (!raw || typeof raw !== "object") {
    return createEmptyData();
  }

  const candidate = raw as Partial<EssenceData>;
  const version = Number.isFinite(candidate.version) ? Number(candidate.version) : 0;

  if (version > CURRENT_DATA_VERSION) {
    return normalizeData(withBundledLibrary({ ...candidate, version: CURRENT_DATA_VERSION }));
  }

  if (version <= 0) {
    return normalizeData(withBundledLibrary({ ...candidate, version: 1 }));
  }

  return normalizeData(withBundledLibrary(candidate));
}
