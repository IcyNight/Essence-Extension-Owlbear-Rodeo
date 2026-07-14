import { Character, EssenceData } from "../data/schema";
import { clamp } from "../data/validation";
import { Actor, requireResourceAccess } from "../sdk/permissions";

export function spendResource(current: number, max: number, cost: number): number {
  const safeCost = Math.max(0, Math.floor(cost));
  if (current < safeCost) {
    throw new Error("Not enough resources.");
  }
  return clamp(current - safeCost, 0, max);
}

export function adjustResource(current: number, max: number, delta: number): number {
  return clamp(current + Math.floor(delta), 0, max);
}

export function restoreResource(max: number): number {
  return Math.max(0, Math.floor(max));
}

export function longRest(character: Character): Character {
  return {
    ...character,
    essencePoints: {
      ...character.essencePoints,
      current: restoreResource(character.essencePoints.max),
    },
    confluenceUses: {
      ...character.confluenceUses,
      current: restoreResource(character.confluenceUses.max),
    },
  };
}

export function updateCharacterResource(
  data: EssenceData,
  actor: Actor,
  characterId: string,
  updater: (character: Character) => Character,
): EssenceData {
  const character = data.characters[characterId];
  if (!character) throw new Error("Character not found.");
  requireResourceAccess(actor, character);
  const updated = updater(character);
  return {
    ...data,
    characters: {
      ...data.characters,
      [characterId]: updated,
    },
  };
}
