import {
  CURRENT_DATA_VERSION,
  Character,
  Confluence,
  Essence,
  EssenceData,
  Power,
  ResourcePool,
  createEmptyData,
} from "./schema";

export type ValidationResult = {
  ok: boolean;
  errors: string[];
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

export function normalizeName(name: unknown): string {
  return typeof name === "string" ? name.trim() : "";
}

function normalizePool(pool: Partial<ResourcePool> | undefined): ResourcePool {
  const max = Math.max(0, Math.floor(Number(pool?.max ?? 0)));
  const current = clamp(Math.floor(Number(pool?.current ?? max)), 0, max);
  return { current, max };
}

function normalizePower(power: Partial<Power>): Power | null {
  const id = normalizeName(power.id);
  const name = normalizeName(power.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    description: typeof power.description === "string" ? power.description : "",
    cost: Math.max(0, Math.floor(Number(power.cost ?? 0))),
    activation: typeof power.activation === "string" ? power.activation : "",
    notes: typeof power.notes === "string" ? power.notes : "",
  };
}

function normalizeEssence(essence: Partial<Essence>): Essence | null {
  const id = normalizeName(essence.id);
  const name = normalizeName(essence.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    summary: typeof essence.summary === "string" ? essence.summary : "",
    powers: Array.isArray(essence.powers)
      ? essence.powers.map((power) => normalizePower(power)).filter(Boolean)
      : [],
  } as Essence;
}

function normalizeConfluence(confluence: Partial<Confluence>): Confluence | null {
  const id = normalizeName(confluence.id);
  const name = normalizeName(confluence.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    summary: typeof confluence.summary === "string" ? confluence.summary : "",
    powers: Array.isArray(confluence.powers)
      ? confluence.powers.map((power) => normalizePower(power)).filter(Boolean)
      : [],
  } as Confluence;
}

function uniqueEssenceIds(ids: unknown, validIds: Set<string>): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length === 3) break;
  }
  return result;
}

function normalizeCharacter(
  character: Partial<Character>,
  validEssences: Set<string>,
  validConfluences: Set<string>,
): Character | null {
  const id = normalizeName(character.id);
  const name = normalizeName(character.name);
  if (!id || !name) return null;
  const confluenceId =
    typeof character.confluenceId === "string" && validConfluences.has(character.confluenceId)
      ? character.confluenceId
      : null;
  return {
    id,
    name,
    ownerPlayerId: typeof character.ownerPlayerId === "string" ? character.ownerPlayerId : "",
    tokenId: typeof character.tokenId === "string" && character.tokenId ? character.tokenId : null,
    essenceIds: uniqueEssenceIds(character.essenceIds, validEssences),
    confluenceId,
    essencePoints: normalizePool(character.essencePoints),
    confluenceUses: normalizePool(character.confluenceUses),
    confluenceRoundsRemaining: clamp(Math.floor(Number(character.confluenceRoundsRemaining ?? 0)), 0, 10),
    confluenceAreaItemId:
      typeof character.confluenceAreaItemId === "string" && character.confluenceAreaItemId
        ? character.confluenceAreaItemId
        : null,
    confluenceAreaSaved: Boolean(character.confluenceAreaSaved),
    visibleToPlayers: Boolean(character.visibleToPlayers),
  };
}

export function normalizeData(raw: Partial<EssenceData>): EssenceData {
  const empty = createEmptyData();
  const data: EssenceData = {
    version: CURRENT_DATA_VERSION,
    essences: {},
    confluences: {},
    characters: {},
    lastProcessedForgeTurnEvent:
      typeof raw.lastProcessedForgeTurnEvent === "string" ? raw.lastProcessedForgeTurnEvent : null,
    confluenceNotifications: Array.isArray(raw.confluenceNotifications)
      ? raw.confluenceNotifications
          .flatMap((event) => {
            const candidate = event as { id?: unknown; ownerPlayerId?: unknown; tokenNames?: unknown };
            const id = normalizeName(candidate.id);
            const ownerPlayerId = normalizeName(candidate.ownerPlayerId);
            const tokenNames = Array.isArray(candidate.tokenNames)
              ? candidate.tokenNames.map((name) => normalizeName(name)).filter(Boolean)
              : [];
            return id && ownerPlayerId && tokenNames.length > 0 ? [{ id, ownerPlayerId, tokenNames }] : [];
          })
          .slice(-30)
      : [],
  };

  const rawEssences = raw.essences && typeof raw.essences === "object" ? raw.essences : empty.essences;
  for (const value of Object.values(rawEssences)) {
    const essence = normalizeEssence(value as Partial<Essence>);
    if (essence) data.essences[essence.id] = essence;
  }

  const rawConfluences =
    raw.confluences && typeof raw.confluences === "object" ? raw.confluences : empty.confluences;
  for (const value of Object.values(rawConfluences)) {
    const confluence = normalizeConfluence(value as Partial<Confluence>);
    if (confluence) data.confluences[confluence.id] = confluence;
  }

  const validEssences = new Set(Object.keys(data.essences));
  const validConfluences = new Set(Object.keys(data.confluences));
  const rawCharacters =
    raw.characters && typeof raw.characters === "object" ? raw.characters : empty.characters;
  for (const value of Object.values(rawCharacters)) {
    const character = normalizeCharacter(value as Partial<Character>, validEssences, validConfluences);
    if (character) data.characters[character.id] = character;
  }

  return data;
}

export function validatePower(power: Power, resourceName: string): ValidationResult {
  const errors: string[] = [];
  if (!normalizeName(power.name)) errors.push("Power name is required.");
  if (power.cost < 0) errors.push(`${resourceName} cost cannot be negative.`);
  return { ok: errors.length === 0, errors };
}

export function validateCharacter(character: Character, data: EssenceData, validPlayerIds: string[]): ValidationResult {
  const errors: string[] = [];
  if (!normalizeName(character.name)) errors.push("Character name is required.");
  if (character.essenceIds.length > 3) errors.push("A character can have at most 3 essences.");
  if (new Set(character.essenceIds).size !== character.essenceIds.length) {
    errors.push("The same essence cannot be assigned more than once.");
  }
  for (const id of character.essenceIds) {
    if (!data.essences[id]) errors.push(`Unknown essence: ${id}.`);
  }
  if (character.confluenceId && !data.confluences[character.confluenceId]) {
    errors.push(`Unknown confluence: ${character.confluenceId}.`);
  }
  if (character.ownerPlayerId && validPlayerIds.length > 0 && !validPlayerIds.includes(character.ownerPlayerId)) {
    errors.push("Owner must be a connected Owlbear Rodeo player.");
  }
  if (character.essencePoints.max < 0 || character.confluenceUses.max < 0) {
    errors.push("Resource maximums cannot be negative.");
  }
  if (character.essencePoints.current > character.essencePoints.max) {
    errors.push("Current essence points cannot exceed maximum essence points.");
  }
  if (character.confluenceUses.current > character.confluenceUses.max) {
    errors.push("Current confluence uses cannot exceed maximum confluence uses.");
  }
  return { ok: errors.length === 0, errors };
}

export function getEssenceUsage(data: EssenceData, essenceId: string): Character[] {
  return Object.values(data.characters).filter((character) => character.essenceIds.includes(essenceId));
}

export function getConfluenceUsage(data: EssenceData, confluenceId: string): Character[] {
  return Object.values(data.characters).filter((character) => character.confluenceId === confluenceId);
}
