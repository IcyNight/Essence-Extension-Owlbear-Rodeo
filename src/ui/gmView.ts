import { Character, Confluence, Essence, EssenceData, PlayerInfo, Power } from "../data/schema";
import { createBlankCharacter } from "../services/characterService";
import { createBlankConfluence, createBlankConfluencePower } from "../services/confluenceService";
import { createBlankEssence, createBlankPower } from "../services/essenceService";
import { escapeHtml } from "./dom";

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

function powerFields(power: Power, index: number): string {
  return `
    <fieldset class="power-edit" data-power-index="${index}">
      <input type="hidden" name="powerId:${index}" value="${escapeHtml(power.id)}" />
      <div class="grid two">
        <label>Power Name<input name="powerName:${index}" required value="${escapeHtml(power.name)}" /></label>
        <label>Cost<input name="powerCost:${index}" type="number" min="0" value="${power.cost}" /></label>
      </div>
      <label>Description<textarea name="powerDescription:${index}" rows="3">${escapeHtml(power.description)}</textarea></label>
      <div class="grid two">
        <label>Activation<input name="powerActivation:${index}" value="${escapeHtml(power.activation ?? "")}" /></label>
        <label>Notes<input name="powerNotes:${index}" value="${escapeHtml(power.notes ?? "")}" /></label>
      </div>
      <div class="button-row compact">
        <button class="secondary" type="button" data-action="move-power" data-index="${index}" data-dir="-1">Up</button>
        <button class="secondary" type="button" data-action="move-power" data-index="${index}" data-dir="1">Down</button>
        <button class="danger" type="button" data-action="remove-power" data-index="${index}">Delete Power</button>
      </div>
    </fieldset>
  `;
}

function libraryForm(kind: "essence" | "confluence", item?: Essence | Confluence): string {
  const blank = kind === "essence" ? createBlankEssence() : createBlankConfluence();
  const current = item ?? blank;
  const addPower = kind === "essence" ? createBlankPower : createBlankConfluencePower;
  const powers = current.powers.length ? current.powers : [addPower()];
  return `
    <form class="editor" data-form="${kind}">
      <input type="hidden" name="id" value="${escapeHtml(current.id)}" />
      <label>Name<input name="name" required value="${escapeHtml(current.name)}" /></label>
      <label>Summary<textarea name="summary" rows="2">${escapeHtml(current.summary ?? "")}</textarea></label>
      <div class="power-list">
        ${powers.map((power, index) => powerFields(power, index)).join("")}
      </div>
      <div class="button-row">
        <button class="secondary" type="button" data-action="add-power">Add Power</button>
        <button class="primary" type="submit">Save ${kind === "essence" ? "Essence" : "Confluence"}</button>
        <button class="danger" type="button" data-action="delete-${kind}" data-id="${escapeHtml(current.id)}">Delete</button>
      </div>
    </form>
  `;
}

export function gmView(
  data: EssenceData,
  players: PlayerInfo[],
  tab: string,
  selectedId: string | null,
  draftCharacter: Character = createBlankCharacter(),
): string {
  const active = tab || "characters";
  const character = selectedId ? data.characters[selectedId] : draftCharacter;
  const essence = selectedId ? data.essences[selectedId] : undefined;
  const confluence = selectedId ? data.confluences[selectedId] : undefined;

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
              <aside>${Object.values(data.characters)
                .map(
                  (item) =>
                    `<button type="button" data-select="${escapeHtml(item.id)}" class="${
                      item.id === selectedId ? "active" : ""
                    }">${escapeHtml(item.name)}</button>`,
                )
                .join("")}<button type="button" data-select="" class="new">New Character</button></aside>
              ${characterForm(data, players, character)}
            </div>`
          : ""
      }
      ${
        active === "essences"
          ? `<div class="manager">
              <aside>${Object.values(data.essences)
                .map(
                  (item) =>
                    `<button type="button" data-select="${escapeHtml(item.id)}" class="${
                      item.id === selectedId ? "active" : ""
                    }">${escapeHtml(item.name)}</button>`,
                )
                .join("")}<button type="button" data-select="" class="new">New Essence</button></aside>
              ${libraryForm("essence", essence)}
            </div>`
          : ""
      }
      ${
        active === "confluences"
          ? `<div class="manager">
              <aside>${Object.values(data.confluences)
                .map(
                  (item) =>
                    `<button type="button" data-select="${escapeHtml(item.id)}" class="${
                      item.id === selectedId ? "active" : ""
                    }">${escapeHtml(item.name)}</button>`,
                )
                .join("")}<button type="button" data-select="" class="new">New Confluence</button></aside>
              ${libraryForm("confluence", confluence)}
            </div>`
          : ""
      }
      <div class="button-row">
        <button class="secondary" type="button" data-action="load-sample">Load Sample Data</button>
        <button class="secondary" type="button" data-action="export-data">Export Data</button>
        <button class="danger" type="button" data-action="clear-data">Clear Data</button>
      </div>
    </section>
  `;
}
