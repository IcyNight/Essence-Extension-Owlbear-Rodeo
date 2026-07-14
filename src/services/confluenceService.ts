import { Confluence, EssenceData, Power, createId } from "../data/schema";
import { getConfluenceUsage, normalizeName, validatePower } from "../data/validation";
import { Actor, requireGm } from "../sdk/permissions";

export function createBlankConfluence(): Confluence {
  return { id: createId("confluence"), name: "", summary: "", powers: [] };
}

export function createBlankConfluencePower(): Power {
  return { id: createId("power"), name: "", description: "", cost: 0, activation: "", notes: "" };
}

export function saveConfluence(data: EssenceData, actor: Actor, confluence: Confluence): EssenceData {
  requireGm(actor);
  if (!normalizeName(confluence.name)) throw new Error("Confluence name is required.");
  for (const power of confluence.powers) {
    const validation = validatePower(power, "Confluence-use");
    if (!validation.ok) throw new Error(validation.errors.join(" "));
  }
  return { ...data, confluences: { ...data.confluences, [confluence.id]: confluence } };
}

export function deleteConfluence(
  data: EssenceData,
  actor: Actor,
  confluenceId: string,
  confirmed = false,
): EssenceData {
  requireGm(actor);
  const usage = getConfluenceUsage(data, confluenceId);
  if (usage.length > 0 && !confirmed) {
    throw new Error(`Confluence is assigned to ${usage.length} character(s). Confirm deletion to continue.`);
  }
  const confluences = { ...data.confluences };
  delete confluences[confluenceId];
  const characters = Object.fromEntries(
    Object.entries(data.characters).map(([id, character]) => [
      id,
      { ...character, confluenceId: character.confluenceId === confluenceId ? null : character.confluenceId },
    ]),
  );
  return { ...data, confluences, characters };
}
