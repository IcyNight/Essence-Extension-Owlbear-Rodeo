import { Confluence, Essence, Power } from "./schema";
import essenceLibrary from "./library/essences.json";
import confluenceLibrary from "./library/confluences.json";

type LibraryPower = {
  id?: string;
  name: string;
  cost: number;
  description: string;
  actionCost?: string;
};

type LibraryItem = {
  id?: string;
  name: string;
  powers: LibraryPower[];
};

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function powerFromLibrary(power: LibraryPower, parentId: string): Power {
  const name = power.name.trim();
  return {
    id: power.id?.trim() || `${parentId}-${slug(name)}`,
    name,
    cost: Math.max(0, Math.floor(Number(power.cost ?? 0))),
    description: power.description ?? "",
    activation: power.actionCost ?? "",
    notes: "",
  };
}

function essenceFromLibrary(item: LibraryItem): Essence {
  const name = item.name.trim();
  const id = item.id?.trim() || slug(name);
  return {
    id,
    name,
    summary: "",
    powers: Array.isArray(item.powers) ? item.powers.map((power) => powerFromLibrary(power, id)) : [],
  };
}

function confluenceFromLibrary(item: LibraryItem): Confluence {
  const name = item.name.trim();
  const id = item.id?.trim() || slug(name);
  return {
    id,
    name,
    summary: "",
    powers: Array.isArray(item.powers) ? item.powers.map((power) => powerFromLibrary(power, id)) : [],
  };
}

function byId<T extends { id: string; name: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.filter((item) => item.id && item.name).map((item) => [item.id, item]));
}

export const BUNDLED_ESSENCES: Record<string, Essence> = byId(
  (essenceLibrary as LibraryItem[]).map((item) => essenceFromLibrary(item)),
);

export const BUNDLED_CONFLUENCES: Record<string, Confluence> = byId(
  (confluenceLibrary as LibraryItem[]).map((item) => confluenceFromLibrary(item)),
);
