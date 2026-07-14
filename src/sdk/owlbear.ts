import OBR from "@owlbear-rodeo/sdk";
import { PlayerInfo, PlayerRole } from "../data/schema";

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

export function onPlayerChange(callback: () => void): () => void {
  return OBR.player.onChange(callback);
}

export function onPartyChange(callback: () => void): () => void {
  return OBR.party.onChange(callback);
}

export { OBR };
