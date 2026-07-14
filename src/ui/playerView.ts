import { Character, EssenceData } from "../data/schema";
import { Actor, getVisibleCharacters } from "../sdk/permissions";
import { accordion } from "./components/accordion";
import { powerCard } from "./components/powerCard";
import { resourceCounter } from "./components/resourceCounter";
import { escapeHtml } from "./dom";

function essenceSlot(data: EssenceData, character: Character, index: number): string {
  const id = character.essenceIds[index];
  if (!id || !data.essences[id]) {
    return `<section class="empty-slot">Empty Essence Slot</section>`;
  }
  const essence = data.essences[id];
  const powers =
    essence.powers.length > 0
      ? essence.powers
          .map((power) =>
            powerCard(power, "EP", character.essencePoints.current >= power.cost, `use-essence:${essence.id}`),
          )
          .join("")
      : `<p class="empty">No powers have been added to this essence.</p>`;
  return accordion(
    `essence-${id}`,
    essence.name,
    essence.summary ?? "",
    `<h3>${escapeHtml(essence.name)}</h3>${powers}`,
  );
}

function confluenceSlot(data: EssenceData, character: Character): string {
  const id = character.confluenceId;
  if (!id || !data.confluences[id]) {
    return `<section class="empty-slot">No Confluence Assigned</section>`;
  }
  const confluence = data.confluences[id];
  const powers =
    confluence.powers.length > 0
      ? confluence.powers
          .map((power) =>
            powerCard(power, "CU", character.confluenceUses.current >= power.cost, `use-confluence:${confluence.id}`),
          )
          .join("")
      : `<p class="empty">No powers have been added to this confluence.</p>`;
  return accordion(
    `confluence-${id}`,
    confluence.name,
    confluence.summary ?? "",
    `<h3>${escapeHtml(confluence.name)}</h3>${powers}`,
  );
}

export function playerView(data: EssenceData, actor: Actor, selectedCharacterId: string | null): string {
  const characters = getVisibleCharacters(actor, data);
  if (characters.length === 0) {
    return `
      <section class="panel-section">
        <h2>Essence Powers</h2>
        <p class="empty">No visible character is assigned to you yet.</p>
      </section>
    `;
  }

  const character = characters.find((item) => item.id === selectedCharacterId) ?? characters[0];
  const canRestoreResources = actor.role === "GM";
  const selector =
    characters.length > 1
      ? `
        <label>
          Character
          <select id="character-picker">
            ${characters
              .map(
                (item) =>
                  `<option value="${escapeHtml(item.id)}" ${item.id === character.id ? "selected" : ""}>${escapeHtml(
                    item.name,
                  )}</option>`,
              )
              .join("")}
          </select>
        </label>
      `
      : "";

  return `
    <section class="player-panel" data-character-id="${escapeHtml(character.id)}">
      ${selector}
      <h2>${escapeHtml(character.name)}</h2>
      <div class="slots">
        ${essenceSlot(data, character, 0)}
        ${essenceSlot(data, character, 1)}
        ${essenceSlot(data, character, 2)}
        ${confluenceSlot(data, character)}
      </div>
      <footer class="resource-dock">
        ${resourceCounter("Essence Points", character.essencePoints, "essencePoints", canRestoreResources)}
        ${resourceCounter("Confluence Uses", character.confluenceUses, "confluenceUses", canRestoreResources)}
        ${canRestoreResources ? `<button class="lr-button" type="button" data-action="long-rest">LR</button>` : ""}
      </footer>
    </section>
  `;
}
