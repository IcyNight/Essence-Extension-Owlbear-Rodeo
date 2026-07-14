import "./styles/main.css";
import { createActiveConfluenceApp } from "./activeConfluenceApp";
import { createApp } from "./app";
import { getCurrentPlayer, waitForOwlbear } from "./sdk/owlbear";

const root = document.querySelector<HTMLDivElement>("#app");

async function boot() {
  if (!root) return;
  const isPinnedView = new URLSearchParams(window.location.search).get("view") === "active-confluence";
  document.documentElement.classList.toggle("pinned-mode", isPinnedView);
  document.body.classList.toggle("pinned-mode", isPinnedView);
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
  const app = isPinnedView ? await createActiveConfluenceApp(root, actor) : await createApp(root, actor);
  app.mount();
}

boot().catch((error) => {
  if (root) {
    root.innerHTML = `<main class="loading"><h1>Essence Powers</h1><p>${error instanceof Error ? error.message : "Unable to start."}</p></main>`;
  }
});
