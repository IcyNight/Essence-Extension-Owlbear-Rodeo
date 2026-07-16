import { Character, Confluence, Essence, EssenceData, PlayerInfo, Power } from "../data/schema";
import { createBlankCharacter } from "../services/characterService";
import { createBlankConfluence } from "../services/confluenceService";
import { createBlankEssence } from "../services/essenceService";
import { escapeHtml } from "./dom";
import { formattedDescription } from "./formatDescription";

function option(value: string, label: string, selected?: boolean): string {
  return `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function characterForm(data: EssenceData, players: PlayerInfo[], character: Character = createBlankCharacter()): string {
  const ownerInPlayerList = players.some((player) => player.id === character.ownerPlayerId);
  const essenceOptions = (selected = "") =>
    option("", "Empty Essence Slot", !selected) +
    Object.values(data.essences)
      .map((essence) => option(essence.id, essence.name, selected === essence.id))
      .join("");
  return `
    <form class="editor" data-form="character">
      <input type="hidden" name="id" value="${escapeHtml(character.id)}" />
      <div class="grid two">
        <label>Name<input name="name" required value="${escapeHtml(character.name)}" /></label>
        <label>Owner
          <select name="ownerPlayerId">
            ${option("", "Unassigned", !character.ownerPlayerId)}
            ${players.map((player) => option(player.id, player.name, player.id === character.ownerPlayerId)).join("")}
            ${
              character.ownerPlayerId && !ownerInPlayerList
                ? option(character.ownerPlayerId, "Token Owner", true)
                : ""
            }
          </select>
        </label>
      </div>
      <div class="grid two">
        <label>Token ID<input name="tokenId" value="${escapeHtml(character.tokenId ?? "")}" /></label>
        <button class="secondary align-end" type="button" data-action="selected-token" data-target="${escapeHtml(
          character.id,
        )}">Link Scene Token</button>
      </div>
      <div class="grid three">
        <label>Essence 1<select name="essence1">${essenceOptions(character.essenceIds[0])}</select></label>
        <label>Essence 2<select name="essence2">${essenceOptions(character.essenceIds[1])}</select></label>
        <label>Essence 3<select name="essence3">${essenceOptions(character.essenceIds[2])}</select></label>
      </div>
      <label>Confluence
        <select name="confluenceId">
          ${option("", "No Confluence", !character.confluenceId)}
          ${Object.values(data.confluences)
            .map((confluence) => option(confluence.id, confluence.name, confluence.id === character.confluenceId))
            .join("")}
        </select>
      </label>
      <div class="grid four">
        <label>Max EP<input name="epMax" type="number" min="0" value="${character.essencePoints.max}" /></label>
        <label>Current EP<input name="epCurrent" type="number" min="0" value="${character.essencePoints.current}" /></label>
        <label>Max CU<input name="cuMax" type="number" min="0" value="${character.confluenceUses.max}" /></label>
        <label>Current CU<input name="cuCurrent" type="number" min="0" value="${character.confluenceUses.current}" /></label>
      </div>
      <label class="check"><input name="visibleToPlayers" type="checkbox" ${
        character.visibleToPlayers ? "checked" : ""
      } /> Visible to Players</label>
      <div class="button-row">
        <button class="primary" type="submit">Save Character</button>
        <button class="secondary" type="button" data-action="reset-character" data-id="${escapeHtml(character.id)}">Reset</button>
        <button class="danger" type="button" data-action="delete-character" data-id="${escapeHtml(character.id)}">Delete</button>
      </div>
    </form>
  `;
}

function powerSummary(power: Power): string {
  return `
    <article class="library-power">
      <div class="library-power-head">
        <h4>${escapeHtml(power.name)}</h4>
        <span>Cost ${power.cost}</span>
      </div>
      ${power.activation ? `<p class="muted">Action Cost: ${escapeHtml(power.activation)}</p>` : ""}
      ${formattedDescription(power.description)}
    </article>
  `;
}

function libraryDetails(kind: "essence" | "confluence", item?: Essence | Confluence): string {
  if (!item) {
    return `<section class="editor"><p class="empty">Add ${kind === "essence" ? "essences" : "confluences"} to the repo JSON file.</p></section>`;
  }
  return `
    <section class="editor">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="power-list">
        ${item.powers.length ? item.powers.map((power) => powerSummary(power)).join("") : `<p class="empty">No powers in this entry.</p>`}
      </div>
    </section>
  `;
}

function picker<T extends { id: string; name: string }>(
  label: string,
  items: T[],
  selectedId: string | null,
  emptyLabel: string,
  includeEmptyOption = false,
): string {
  const selected = selectedId && items.some((item) => item.id === selectedId) ? selectedId : "";
  return `
    <label class="manager-picker">${escapeHtml(label)}
      <select data-select-menu ${items.length === 0 ? "disabled" : ""}>
        ${items.length === 0 ? option("", emptyLabel, true) : ""}
        ${items.length > 0 && includeEmptyOption ? option("", emptyLabel, !selected) : ""}
        ${items.map((item) => option(item.id, item.name, item.id === selected)).join("")}
      </select>
    </label>
  `;
}

export function gmView(
  data: EssenceData,
  players: PlayerInfo[],
  tab: string,
  selectedId: string | null,
  draftCharacter: Character = createBlankCharacter(),
  draftEssence: Essence = createBlankEssence(),
  draftConfluence: Confluence = createBlankConfluence(),
): string {
  const active = tab || "characters";
  const characters = Object.values(data.characters);
  const essences = Object.values(data.essences);
  const confluences = Object.values(data.confluences);
  const character = selectedId ? data.characters[selectedId] ?? draftCharacter : draftCharacter;
  const essence = selectedId && data.essences[selectedId] ? data.essences[selectedId] : essences[0];
  const confluence =
    selectedId && data.confluences[selectedId] ? data.confluences[selectedId] : confluences[0];

  return `
    <section class="gm-panel">
      <nav class="tabs" aria-label="GM management sections">
        ${["characters", "essences", "confluences"]
          .map(
            (item) =>
              `<button type="button" data-tab="${item}" class="${active === item ? "active" : ""}">${escapeHtml(
                item === "characters" ? "Characters" : item === "essences" ? "Essence Library" : "Confluence Library",
              )}</button>`,
          )
          .join("")}
      </nav>
      ${
        active === "characters"
          ? `<div class="manager">
              <div class="manager-toolbar">
                ${picker("Character", characters, selectedId, "Select character", true)}
                <button type="button" data-select="" class="secondary">New Character</button>
              </div>
              ${characterForm(data, players, character)}
            </div>`
          : ""
      }
      ${
        active === "essences"
          ? `<div class="manager">
              <div class="manager-toolbar">
                ${picker("Essence", essences, selectedId, "No essences")}
              </div>
              ${libraryDetails("essence", essence)}
            </div>`
          : ""
      }
      ${
        active === "confluences"
          ? `<div class="manager">
              <div class="manager-toolbar">
                ${picker("Confluence", confluences, selectedId, "No confluences")}
              </div>
              ${libraryDetails("confluence", confluence)}
            </div>`
          : ""
      }
      <div class="button-row">
        <button class="secondary" type="button" data-action="check-update">Check for Update</button>
        <button class="danger" type="button" data-action="clear-data">Clear Data</button>
      </div>
    </section>
  `;
}
