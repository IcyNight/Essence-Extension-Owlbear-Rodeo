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
    confluenceRoundsRemaining: 0,
    confluenceAreaSaved: false,
  };
}

export function activateConfluence(character: Character, rounds = 10): Character {
  return {
    ...character,
    confluenceRoundsRemaining: Math.max(0, Math.floor(rounds)),
    confluenceAreaSaved: false,
  };
}

export function tickConfluenceRound(character: Character): Character {
  return tickConfluenceRounds(character, 1);
}

export function tickConfluenceRounds(character: Character, amount: number): Character {
  const remaining = Math.max(0, Math.floor(character.confluenceRoundsRemaining ?? 0));
  const safeAmount = Math.max(0, Math.floor(amount));
  if (remaining <= 0 || safeAmount <= 0) return character;
  const nextRemaining = Math.max(0, remaining - safeAmount);
  return {
    ...character,
    confluenceRoundsRemaining: nextRemaining,
    confluenceAreaItemId: nextRemaining === 0 ? null : character.confluenceAreaItemId,
    confluenceAreaSaved: nextRemaining === 0 ? false : character.confluenceAreaSaved,
  };
}

export function getExpiringConfluenceAreaItemIds(data: EssenceData, amount: number): string[] {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) return [];
  const ids = Object.values(data.characters).flatMap((character) => {
    const remaining = Math.max(0, Math.floor(character.confluenceRoundsRemaining ?? 0));
    if (remaining <= 0 || remaining - safeAmount > 0) return [];
    if (!character.confluenceAreaSaved || !character.confluenceAreaItemId) return [];
    return [character.confluenceAreaItemId];
  });
  return [...new Set(ids)];
}

export function applyForgeRoundConfluenceTick(
  data: EssenceData,
  actor: Actor,
  currentRound: number,
  encounterSequence = 0,
  amount = 1,
): EssenceData {
  if (actor.role !== "GM") return data;
  const eventKey = `${encounterSequence}:round:${currentRound}`;
  if (data.lastProcessedForgeRoundEvent === eventKey) return data;
  const safeAmount = Math.max(1, Math.floor(amount));
  return {
    ...data,
    lastProcessedForgeRoundEvent: eventKey,
    characters: Object.fromEntries(
      Object.entries(data.characters).map(([id, character]) => [
        id,
        tickConfluenceRounds(character, safeAmount),
      ]),
    ),
  };
}

export function applyForgeTurnConfluenceTick(
  data: EssenceData,
  actor: Actor,
  previousTurnTokenId: string | null,
  currentTurnTokenId: string | null,
  currentRound: number,
  encounterSequence = 0,
): EssenceData {
  if (!previousTurnTokenId || actor.role !== "GM") return data;
  const eventKey = `${encounterSequence}:${previousTurnTokenId}->${currentTurnTokenId ?? "none"}@${currentRound}`;
  if (data.lastProcessedForgeTurnEvent === eventKey) return data;
  const character = Object.values(data.characters).find((item) => item.tokenId === previousTurnTokenId);
  if (!character || character.confluenceRoundsRemaining <= 0) {
    return { ...data, lastProcessedForgeTurnEvent: eventKey };
  }
  const updated = updateCharacterResource(data, actor, character.id, (item) => tickConfluenceRound(item));
  return { ...updated, lastProcessedForgeTurnEvent: eventKey };
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
