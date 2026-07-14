import { Essence, EssenceData, Power, createId } from "../data/schema";
import { getEssenceUsage, normalizeName, validatePower } from "../data/validation";
import { Actor, requireGm } from "../sdk/permissions";

export function createBlankEssence(): Essence {
  return { id: createId("essence"), name: "", summary: "", powers: [] };
}

export function createBlankPower(): Power {
  return { id: createId("power"), name: "", description: "", cost: 0, activation: "", notes: "" };
}

export function saveEssence(data: EssenceData, actor: Actor, essence: Essence): EssenceData {
  requireGm(actor);
  if (!normalizeName(essence.name)) throw new Error("Essence name is required.");
  for (const power of essence.powers) {
    const validation = validatePower(power, "Essence-point");
    if (!validation.ok) throw new Error(validation.errors.join(" "));
  }
  return { ...data, essences: { ...data.essences, [essence.id]: essence } };
}

export function deleteEssence(data: EssenceData, actor: Actor, essenceId: string, confirmed = false): EssenceData {
  requireGm(actor);
  const usage = getEssenceUsage(data, essenceId);
  if (usage.length > 0 && !confirmed) {
    throw new Error(`Essence is assigned to ${usage.length} character(s). Confirm deletion to continue.`);
  }
  const essences = { ...data.essences };
  delete essences[essenceId];
  const characters = Object.fromEntries(
    Object.entries(data.characters).map(([id, character]) => [
      id,
      { ...character, essenceIds: character.essenceIds.filter((assignedId) => assignedId !== essenceId) },
    ]),
  );
  return { ...data, essences, characters };
}
