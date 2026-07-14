import { Character, EssenceData, PlayerRole } from "../data/schema";

export type Actor = {
  role: PlayerRole;
  playerId: string;
};

export function isGm(actor: Actor): boolean {
  return actor.role === "GM";
}

export function canViewCharacter(actor: Actor, character: Character): boolean {
  return isGm(actor) || (character.visibleToPlayers && character.ownerPlayerId === actor.playerId);
}

export function canPlayerEditResources(actor: Actor, character: Character): boolean {
  return isGm(actor) || (character.visibleToPlayers && character.ownerPlayerId === actor.playerId);
}

export function getVisibleCharacters(actor: Actor, data: EssenceData): Character[] {
  return Object.values(data.characters).filter((character) => canViewCharacter(actor, character));
}

export function requireGm(actor: Actor): void {
  if (!isGm(actor)) {
    throw new Error("Only the GM can make this change.");
  }
}

export function requireResourceAccess(actor: Actor, character: Character): void {
  if (!canPlayerEditResources(actor, character)) {
    throw new Error("You can only adjust visible characters assigned to you.");
  }
}
