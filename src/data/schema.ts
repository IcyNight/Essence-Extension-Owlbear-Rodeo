export const EXTENSION_ID = "com.codex.essence-powers";
export const METADATA_KEY = `${EXTENSION_ID}/data`;
export const CURRENT_DATA_VERSION = 1;

export type PlayerRole = "GM" | "PLAYER";

export type Power = {
  id: string;
  name: string;
  description: string;
  cost: number;
  activation?: string;
  notes?: string;
};

export type Essence = {
  id: string;
  name: string;
  summary?: string;
  powers: Power[];
};

export type Confluence = {
  id: string;
  name: string;
  summary?: string;
  powers: Power[];
};

export type ResourcePool = {
  current: number;
  max: number;
};

export type Character = {
  id: string;
  name: string;
  ownerPlayerId: string;
  tokenId: string | null;
  essenceIds: string[];
  confluenceId: string | null;
  essencePoints: ResourcePool;
  confluenceUses: ResourcePool;
  confluenceRoundsRemaining: number;
  confluenceAreaItemId: string | null;
  confluenceAreaSaved: boolean;
  visibleToPlayers: boolean;
};

export type ConfluenceNotification = {
  id: string;
  ownerPlayerId: string;
  tokenNames: string[];
  confluenceNames: string[];
};

export type EssenceData = {
  version: number;
  essences: Record<string, Essence>;
  confluences: Record<string, Confluence>;
  characters: Record<string, Character>;
  lastProcessedForgeTurnEvent: string | null;
  lastProcessedForgeRoundEvent: string | null;
  confluenceNotifications: ConfluenceNotification[];
};

export type PlayerInfo = {
  id: string;
  name: string;
};

export function createEmptyData(): EssenceData {
  return {
    version: CURRENT_DATA_VERSION,
    essences: {},
    confluences: {},
    characters: {},
    lastProcessedForgeTurnEvent: null,
    lastProcessedForgeRoundEvent: null,
    confluenceNotifications: [],
  };
}

export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}
