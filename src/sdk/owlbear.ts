import OBR from "@owlbear-rodeo/sdk";
import { PlayerInfo, PlayerRole } from "../data/schema";

export type SceneTokenInfo = {
  id: string;
  name: string;
  ownerPlayerId: string;
};

const FORGE_UNIT_NAME_KEY = "com.battle-system.forge/name";
const FORGE_CURRENT_TURN_KEY = "com.battle-system.forge/currturn";
const FORGE_CURRENT_ROUND_KEY = "com.battle-system.forge/currround";
const PINNED_ACTIVE_CONFLUENCE_ID = "com.codex.essence-powers/active-confluence";

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

export async function openPinnedActiveConfluence(): Promise<void> {
  const viewportWidth = await OBR.viewport.getWidth();
  const url = new URL(window.location.href);
  url.searchParams.set("view", "active-confluence");
  url.searchParams.set("pinned", "true");
  await OBR.modal.close(PINNED_ACTIVE_CONFLUENCE_ID).catch(() => undefined);
  await OBR.popover.open({
    id: PINNED_ACTIVE_CONFLUENCE_ID,
    url: `${url.pathname}${url.search}`,
    height: 240,
    width: 350,
    anchorPosition: { top: 50, left: viewportWidth - 70 },
    anchorReference: "POSITION",
    anchorOrigin: { vertical: "CENTER", horizontal: "RIGHT" },
    transformOrigin: { vertical: "CENTER", horizontal: "RIGHT" },
    hidePaper: true,
    disableClickAway: true,
  });
}

export async function closePinnedActiveConfluence(): Promise<void> {
  await OBR.popover.close(PINNED_ACTIVE_CONFLUENCE_ID).catch(() => undefined);
  await OBR.modal.close(PINNED_ACTIVE_CONFLUENCE_ID).catch(() => undefined);
}

export { OBR };
