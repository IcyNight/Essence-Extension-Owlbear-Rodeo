import "./styles/main.css";
import { createApp } from "./app";
import {
  closeTokenSheetPopover,
  fitActionToViewport,
  getCurrentPlayer,
  openTokenSheetPopover,
  OBR,
  registerEssenceTokenContextMenu,
  waitForOwlbear,
} from "./sdk/owlbear";
import { readData } from "./sdk/storage";

const root = document.querySelector<HTMLDivElement>("#app");

async function boot() {
  if (!root) return;
  root.innerHTML = `<main class="loading"><h1>Essence Powers</h1><p>Opening Owlbear Rodeo...</p></main>`;

  const ready = await waitForOwlbear();
  if (!ready) {
    root.innerHTML = `
      <main class="loading">
        <h1>Essence Powers</h1>
        <p>Open this page from inside Owlbear Rodeo to connect shared room data.</p>
      </main>
    `;
    return;
  }

  const player = await getCurrentPlayer();
  const actor = { role: player.role, playerId: player.id, name: player.name };
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "token" ? "token" : "console";
  const tokenId = params.get("tokenId");

  if (mode === "console") {
    await fitActionToViewport();
  }

  if (actor.role === "GM") {
    await registerEssenceTokenContextMenu(async (clickedTokenId) => {
      const data = await readData();
      const linkedCharacter = Object.values(data.characters).find((character) => character.tokenId === clickedTokenId);
      if (!linkedCharacter) {
        await OBR.notification.show("No Essence character is linked to this token.", "WARNING");
        return;
      }
      await openTokenSheetPopover(clickedTokenId);
    });
    if (mode === "console") {
      await closeTokenSheetPopover();
    }
  }

  const app = await createApp(root, actor, mode, tokenId);
  app.mount();
}

boot().catch((error) => {
  if (root) {
    root.innerHTML = `<main class="loading"><h1>Essence Powers</h1><p>${error instanceof Error ? error.message : "Unable to start."}</p></main>`;
  }
});
