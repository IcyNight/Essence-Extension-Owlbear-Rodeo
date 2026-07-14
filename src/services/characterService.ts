import { Character, EssenceData, createId } from "../data/schema";
import { validateCharacter } from "../data/validation";
import { Actor, requireGm } from "../sdk/permissions";
import { longRest } from "./resourceService";

export function createBlankCharacter(): Character {
  return {
    id: createId("character"),
    name: "",
    ownerPlayerId: "",
    tokenId: null,
    essenceIds: [],
    confluenceId: null,
    essencePoints: { current: 0, max: 0 },
    confluenceUses: { current: 0, max: 0 },
    confluenceRoundsRemaining: 0,
    visibleToPlayers: false,
  };
}

export function saveCharacter(
  data: EssenceData,
  actor: Actor,
  character: Character,
  validPlayerIds: string[],
): EssenceData {
  requireGm(actor);
  const validation = validateCharacter(character, data, validPlayerIds);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  return {
    ...data,
    characters: {
      ...data.characters,
      [character.id]: character,
    },
  };
}

export function deleteCharacter(data: EssenceData, actor: Actor, characterId: string): EssenceData {
  requireGm(actor);
  const characters = { ...data.characters };
  delete characters[characterId];
  return { ...data, characters };
}

export function resetCharacterResources(data: EssenceData, actor: Actor, characterId: string): EssenceData {
  requireGm(actor);
  const character = data.characters[characterId];
  if (!character) throw new Error("Character not found.");
  return {
    ...data,
    characters: {
      ...data.characters,
      [characterId]: longRest(character),
    },
  };
}
