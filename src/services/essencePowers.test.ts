import { describe, expect, it } from "vitest";
import { createEmptyData, EssenceData } from "../data/schema";
import { migrateData } from "../data/migrations";
import { validateCharacter } from "../data/validation";
import { canPlayerEditResources, canViewCharacter } from "../sdk/permissions";
import { deleteConfluence } from "./confluenceService";
import { deleteEssence } from "./essenceService";
import {
  activateConfluence,
  adjustResource,
  applyForgeTurnConfluenceTick,
  longRest,
  spendResource,
  tickConfluenceRound,
} from "./resourceService";

const gm = { role: "GM" as const, playerId: "gm" };
const player = { role: "PLAYER" as const, playerId: "player-1" };

function dataFixture(): EssenceData {
  return {
    ...createEmptyData(),
    essences: {
      fire: { id: "fire", name: "Fire", summary: "", powers: [] },
      metal: { id: "metal", name: "Metal", summary: "", powers: [] },
      rune: { id: "rune", name: "Rune", summary: "", powers: [] },
      water: { id: "water", name: "Water", summary: "", powers: [] },
    },
    confluences: {
      forge: { id: "forge", name: "Forge", summary: "", powers: [] },
    },
    characters: {
      hero: {
        id: "hero",
        name: "Hero",
        ownerPlayerId: "player-1",
        tokenId: "token-hero",
        essenceIds: ["fire"],
        confluenceId: "forge",
        essencePoints: { current: 2, max: 6 },
        confluenceUses: { current: 0, max: 2 },
        confluenceRoundsRemaining: 0,
        visibleToPlayers: true,
      },
    },
  };
}

describe("resource logic", () => {
  it("spends resources when affordable", () => {
    expect(spendResource(4, 6, 2)).toBe(2);
  });

  it("prevents spending unavailable resources", () => {
    expect(() => spendResource(1, 6, 2)).toThrow("Not enough resources");
  });

  it("prevents values below zero", () => {
    expect(adjustResource(0, 6, -3)).toBe(0);
  });

  it("prevents values above maximum", () => {
    expect(adjustResource(5, 6, 3)).toBe(6);
  });

  it("restores both resources on long rest", () => {
    const rested = longRest(dataFixture().characters.hero);
    expect(rested.essencePoints.current).toBe(6);
    expect(rested.confluenceUses.current).toBe(2);
  });

  it("starts confluence rounds at 10", () => {
    const active = activateConfluence(dataFixture().characters.hero);
    expect(active.confluenceRoundsRemaining).toBe(10);
  });

  it("ticks confluence rounds down to zero", () => {
    const ticked = tickConfluenceRound({ ...dataFixture().characters.hero, confluenceRoundsRemaining: 1 });
    expect(ticked.confluenceRoundsRemaining).toBe(0);
    expect(tickConfluenceRound(ticked).confluenceRoundsRemaining).toBe(0);
  });

  it("only applies a Forge turn tick once per turn event", () => {
    const data = dataFixture();
    const active = {
      ...data,
      characters: {
        ...data.characters,
        hero: { ...data.characters.hero, confluenceRoundsRemaining: 10 },
      },
    };
    const first = applyForgeTurnConfluenceTick(active, gm, "token-hero", "token-next", 2);
    const second = applyForgeTurnConfluenceTick(first, gm, "token-hero", "token-next", 2);
    expect(first.characters.hero.confluenceRoundsRemaining).toBe(9);
    expect(second.characters.hero.confluenceRoundsRemaining).toBe(9);
  });
});

describe("character validation", () => {
  it("accepts valid character assignment", () => {
    const data = dataFixture();
    const result = validateCharacter(data.characters.hero, data, ["player-1"]);
    expect(result.ok).toBe(true);
  });

  it("rejects more than 3 essences", () => {
    const data = dataFixture();
    const result = validateCharacter(
      { ...data.characters.hero, essenceIds: ["fire", "metal", "rune", "water"] },
      data,
      ["player-1"],
    );
    expect(result.errors).toContain("A character can have at most 3 essences.");
  });

  it("rejects duplicate essence assignment", () => {
    const data = dataFixture();
    const result = validateCharacter({ ...data.characters.hero, essenceIds: ["fire", "fire"] }, data, ["player-1"]);
    expect(result.errors).toContain("The same essence cannot be assigned more than once.");
  });
});

describe("permissions", () => {
  it("allows owners to view visible characters", () => {
    expect(canViewCharacter(player, dataFixture().characters.hero)).toBe(true);
  });

  it("blocks players from hidden characters", () => {
    const hidden = { ...dataFixture().characters.hero, visibleToPlayers: false };
    expect(canViewCharacter(player, hidden)).toBe(false);
    expect(canPlayerEditResources(player, hidden)).toBe(false);
  });

  it("blocks other players from another player character", () => {
    const other = { role: "PLAYER" as const, playerId: "player-2" };
    expect(canViewCharacter(other, dataFixture().characters.hero)).toBe(false);
  });
});

describe("migration and deletion warnings", () => {
  it("migrates invalid data into a safe current shape", () => {
    const migrated = migrateData({ essences: { bad: { id: "bad", name: "Bad", powers: [{ cost: -3 }] } } });
    expect(migrated.version).toBe(1);
    expect(migrated.essences.bad.powers).toEqual([]);
  });

  it("warns before deleting an assigned essence", () => {
    expect(() => deleteEssence(dataFixture(), gm, "fire")).toThrow("Essence is assigned");
  });

  it("warns before deleting an assigned confluence", () => {
    expect(() => deleteConfluence(dataFixture(), gm, "forge")).toThrow("Confluence is assigned");
  });
});
