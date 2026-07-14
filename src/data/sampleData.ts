import { EssenceData } from "./schema";

export function createSampleData(base: EssenceData): EssenceData {
  return {
    ...base,
    essences: {
      ...base.essences,
      fire: {
        id: "fire",
        name: "Fire",
        summary: "Heat, flame, and sudden survival.",
        powers: [
          {
            id: "fire-resistance",
            name: "Fire Resistance",
            description: "Use your reaction to halve incoming fire damage.",
            cost: 1,
            activation: "Reaction",
            notes: "",
          },
        ],
      },
      metal: {
        id: "metal",
        name: "Metal",
        summary: "Steel nerves, hard edges, and forceful defense.",
        powers: [],
      },
      rune: {
        id: "rune",
        name: "Rune",
        summary: "Inscribed patterns of lingering magic.",
        powers: [],
      },
    },
    confluences: {
      ...base.confluences,
      "astral-forge": {
        id: "astral-forge",
        name: "Astral Forge",
        summary: "Purple astral craft and shattering pressure.",
        powers: [
          {
            id: "shattering-glass",
            name: "Shattering Glass",
            description: "Create purple astral cracks around the target.",
            cost: 1,
            activation: "Action",
            notes: "",
          },
        ],
      },
    },
  };
}
