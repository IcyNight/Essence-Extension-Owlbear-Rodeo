import OBR, { isShape, Item, Shape } from "@owlbear-rodeo/sdk";
import { Character, ConfluenceNotification, EssenceData, PlayerInfo, PlayerRole } from "../data/schema";

export type SceneTokenInfo = {
  id: string;
  name: string;
  ownerPlayerId: string;
};

const FORGE_UNIT_NAME_KEY = "com.battle-system.forge/name";
const FORGE_CURRENT_TURN_KEY = "com.battle-system.forge/currturn";
const FORGE_CURRENT_ROUND_KEY = "com.battle-system.forge/currround";

type ShapeArea = {
  character: Character;
  shape: Shape;
  center: { x: number; y: number };
  width: number;
  height: number;
};

export async function waitForOwlbear(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.location.ancestorOrigins && window.self === window.top) {
    return false;
  }
  try {
    await new Promise<void>((resolve) => OBR.onReady(() => resolve()));
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentPlayer(): Promise<{ id: string; name: string; role: PlayerRole }> {
  const [id, name, role] = await Promise.all([OBR.player.getId(), OBR.player.getName(), OBR.player.getRole()]);
  return { id, name, role };
}

export async function getPlayers(): Promise<PlayerInfo[]> {
  const current = await getCurrentPlayer();
  const party = await OBR.party.getPlayers();
  const players = [
    { id: current.id, name: current.name },
    ...party.map((player: any) => ({
      id: String(player.id ?? ""),
      name: String(player.name ?? player.id ?? "Player"),
    })),
  ].filter((player) => player.id);
  const byId = new Map(players.map((player) => [player.id, player]));
  return [...byId.values()];
}

export async function getSelectedTokenId(): Promise<string | null> {
  try {
    const ready = await OBR.scene.isReady();
    if (!ready) return null;
    const selection = await OBR.player.getSelection();
    return selection?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getSceneTokenInfo(itemId: string): Promise<SceneTokenInfo> {
  try {
    const ready = await OBR.scene.isReady();
    if (!ready) return { id: itemId, name: "", ownerPlayerId: "" };
    const [item] = await OBR.scene.items.getItems([itemId]);
    const metadata = item?.metadata as Record<string, unknown> | undefined;
    const forgeName = metadata ? metadata[FORGE_UNIT_NAME_KEY] : "";
    const itemName = typeof item?.name === "string" ? item.name.trim() : "";
    const ownerPlayerId = typeof item?.createdUserId === "string" ? item.createdUserId : "";
    return {
      id: itemId,
      name: typeof forgeName === "string" && forgeName.trim() ? forgeName.trim() : itemName,
      ownerPlayerId,
    };
  } catch {
    return { id: itemId, name: "", ownerPlayerId: "" };
  }
}

export function onPlayerChange(callback: () => void): () => void {
  return OBR.player.onChange(callback);
}

export function onSelectionChange(callback: (selection: string[] | undefined) => void): () => void {
  return OBR.player.onChange((player: any) => {
    callback(player.selection);
  });
}

export function onPartyChange(callback: () => void): () => void {
  return OBR.party.onChange(callback);
}

export type ForgeTurnState = {
  currentTurnTokenId: string | null;
  currentRound: number;
};

function forgeTurnStateFromMetadata(metadata: Record<string, unknown>): ForgeTurnState {
  const currentTurn = metadata[FORGE_CURRENT_TURN_KEY];
  const currentRound = Number(metadata[FORGE_CURRENT_ROUND_KEY] ?? 1);
  return {
    currentTurnTokenId: typeof currentTurn === "string" && currentTurn ? currentTurn : null,
    currentRound: Number.isFinite(currentRound) ? currentRound : 1,
  };
}

export async function getForgeTurnState(): Promise<ForgeTurnState> {
  try {
    const ready = await OBR.scene.isReady();
    if (!ready) return { currentTurnTokenId: null, currentRound: 1 };
    return forgeTurnStateFromMetadata(await OBR.scene.getMetadata());
  } catch {
    return { currentTurnTokenId: null, currentRound: 1 };
  }
}

export function onForgeTurnChange(callback: (state: ForgeTurnState) => void): () => void {
  return OBR.scene.onMetadataChange((metadata) => {
    callback(forgeTurnStateFromMetadata(metadata));
  });
}

export function onSceneReadyChange(callback: (ready: boolean) => void): () => void {
  return OBR.scene.onReadyChange(callback);
}

export async function selectConfluenceAreaShape(itemId: string): Promise<boolean> {
  const [item] = await OBR.scene.items.getItems([itemId]);
  if (!item || !isShape(item)) return false;
  await OBR.player.select([itemId]);
  return true;
}

export async function getSelectedConfluenceAreaShape(fallbackId?: string | null): Promise<string | null> {
  const selection = await OBR.player.getSelection();
  const ids = [...(selection ?? []), ...(fallbackId ? [fallbackId] : [])];
  if (ids.length === 0) return null;
  const items = await OBR.scene.items.getItems(ids);
  const item = items.find((candidate) => isShape(candidate));
  return item?.id ?? null;
}

export async function deleteConfluenceAreaShapes(itemIds: string[]): Promise<void> {
  const ids = [...new Set(itemIds.filter(Boolean))];
  if (ids.length === 0) return;
  const ready = await OBR.scene.isReady();
  if (!ready) return;
  await OBR.scene.items.deleteItems(ids);
}

function pointInShapeArea(point: { x: number; y: number }, area: ShapeArea): boolean {
  const dx = Math.abs(point.x - area.center.x);
  const dy = Math.abs(point.y - area.center.y);
  if (area.shape.shapeType === "CIRCLE") {
    const radiusX = area.width / 2;
    const radiusY = area.height / 2;
    if (radiusX <= 0 || radiusY <= 0) return false;
    return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1;
  }
  if (area.shape.shapeType === "TRIANGLE") {
    const halfWidth = area.width / 2;
    const halfHeight = area.height / 2;
    if (halfWidth <= 0 || halfHeight <= 0) return false;
    const localX = point.x - area.center.x;
    const localY = point.y - area.center.y;
    const topY = -halfHeight;
    const bottomY = halfHeight;
    if (localY < topY || localY > bottomY) return false;
    const widthAtY = ((localY - topY) / area.height) * area.width;
    return Math.abs(localX) <= widthAtY / 2;
  }
  return dx <= area.width / 2 && dy <= area.height / 2;
}

async function itemCenter(item: Item): Promise<{ x: number; y: number }> {
  const bounds = await OBR.scene.items.getItemBounds([item.id]);
  return bounds.center;
}

async function getSavedShapeAreas(characters: Character[]): Promise<ShapeArea[]> {
  const active = characters.filter(
    (character) => character.confluenceRoundsRemaining > 0 && character.confluenceAreaSaved && character.confluenceAreaItemId,
  );
  if (active.length === 0) return [];
  const ids = active.map((character) => character.confluenceAreaItemId as string);
  const items = await OBR.scene.items.getItems(ids);
  const areas: ShapeArea[] = [];
  for (const character of active) {
    const item = items.find((candidate) => candidate.id === character.confluenceAreaItemId);
    if (!item || !isShape(item)) continue;
    const bounds = await OBR.scene.items.getItemBounds([item.id]);
    areas.push({
      character,
      shape: item,
      center: bounds.center,
      width: bounds.width,
      height: bounds.height,
    });
  }
  return areas;
}

function notificationOwnerForToken(token: SceneTokenInfo, data: EssenceData, gmPlayerId: string): string {
  const character = Object.values(data.characters).find((item) => item.tokenId === token.id);
  return character?.ownerPlayerId || token.ownerPlayerId || gmPlayerId;
}

function confluenceAreaName(area: ShapeArea, data: EssenceData): string {
  const confluence = area.character.confluenceId ? data.confluences[area.character.confluenceId] : undefined;
  return confluence?.name ? `${area.character.name}: ${confluence.name}` : `${area.character.name}'s Confluence`;
}

export async function createConfluenceAreaNotifications(
  data: EssenceData,
  previousTurnTokenId: string,
  eventKey: string,
  gmPlayerId: string,
): Promise<ConfluenceNotification[]> {
  const ready = await OBR.scene.isReady();
  if (!ready) return [];
  const [tokenItem] = await OBR.scene.items.getItems([previousTurnTokenId]);
  if (!tokenItem) return [];
  const areas = await getSavedShapeAreas(Object.values(data.characters));
  if (areas.length === 0) return [];
  const tokenCenter = await itemCenter(tokenItem);
  const matchingAreas = areas.filter((area) => pointInShapeArea(tokenCenter, area));
  if (matchingAreas.length === 0) return [];

  const token = await getSceneTokenInfo(previousTurnTokenId);
  const ownerPlayerId = notificationOwnerForToken(token, data, gmPlayerId);
  if (!ownerPlayerId) return [];
  const name = token.name || tokenItem.name || "Token";
  const confluenceNames = [...new Set(matchingAreas.map((area) => confluenceAreaName(area, data)))];
  return [
    {
      id: `${eventKey}:${ownerPlayerId}`,
      ownerPlayerId,
      tokenNames: [name],
      confluenceNames,
    },
  ];
}

export async function showConfluenceReminder(tokenNames: string[], confluenceNames: string[] = []): Promise<void> {
  const names = [...new Set(tokenNames)].join(", ");
  const confluences = [...new Set(confluenceNames)].join(", ");
  const message = confluences
    ? `Remember Confluence effect for ${names} in: ${confluences}.`
    : `Remember Confluence effect in the area: ${names}.`;
  await OBR.notification.show(message, "WARNING");
}

export { OBR };
