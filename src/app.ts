import { Character, Confluence, Essence, EssenceData, PlayerInfo, Power, createEmptyData } from "./data/schema";
import { createSampleData } from "./data/sampleData";
import { numberValue, textValue, bindClick, bindSubmit, qs } from "./ui/dom";
import { Actor, getVisibleCharacters } from "./sdk/permissions";
import { getPlayers, getSelectedTokenId, onPartyChange, onPlayerChange, onSelectionChange } from "./sdk/owlbear";
import { onDataChange, readData, updateData, writeData } from "./sdk/storage";
import { playerView } from "./ui/playerView";
import { gmView } from "./ui/gmView";
import { saveCharacter, deleteCharacter, resetCharacterResources } from "./services/characterService";
import { saveEssence, deleteEssence, createBlankPower } from "./services/essenceService";
import { saveConfluence, deleteConfluence, createBlankConfluencePower } from "./services/confluenceService";
import { adjustResource, longRest, spendResource, updateCharacterResource } from "./services/resourceService";

type AppState = {
  data: EssenceData;
  actor: Actor;
  playerName: string;
  players: PlayerInfo[];
  selectedCharacterId: string | null;
  gmTab: string;
  selectedGmId: string | null;
  pendingTokenCharacterId: string | null;
  message: string;
  error: string;
};

export class EssencePowersApp {
  private state: AppState;
  private unsubscribers: Array<() => void> = [];

  constructor(
    private root: HTMLElement,
    actor: Actor & { name: string },
    data: EssenceData,
    players: PlayerInfo[],
  ) {
    this.state = {
      data,
      actor,
      playerName: actor.name,
      players,
      selectedCharacterId: null,
      gmTab: localStorage.getItem("essence-powers.tab") ?? "characters",
      selectedGmId: null,
      pendingTokenCharacterId: null,
      message: "",
      error: "",
    };
  }

  mount(): void {
    this.render();
    this.unsubscribers.push(
      onDataChange((data) => {
        this.state.data = data;
        this.render();
      }),
      onPlayerChange(() => this.refreshPlayers()),
      onSelectionChange((selection) => this.capturePendingTokenSelection(selection)),
      onPartyChange(() => this.refreshPlayers()),
    );
  }

  destroy(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private async refreshPlayers(): Promise<void> {
    this.state.players = await getPlayers();
    this.render();
  }

  private setMessage(message: string, error = ""): void {
    this.state.message = message;
    this.state.error = error;
    this.render();
  }

  private async capturePendingTokenSelection(selection: string[] | undefined): Promise<void> {
    if (!this.state.pendingTokenCharacterId || !selection?.[0]) return;
    const tokenId = selection[0];
    const characterId = this.state.pendingTokenCharacterId;
    this.state.pendingTokenCharacterId = null;

    try {
      await this.assignTokenToCharacter(characterId, tokenId);
      this.setMessage("Token linked to character.");
    } catch (error) {
      this.setMessage("", error instanceof Error ? error.message : "Unable to link token.");
    }
  }

  private render(): void {
    const visible = getVisibleCharacters(this.state.actor, this.state.data);
    if (!this.state.selectedCharacterId && visible[0]) {
      this.state.selectedCharacterId = visible[0].id;
    }

    this.root.innerHTML = `
      <main class="app-shell">
        <header class="app-header">
          <div>
            <p>${this.state.actor.role === "GM" ? "GM Console" : this.state.playerName}</p>
            <h1>Essence Powers</h1>
          </div>
          <span class="role">${this.state.actor.role}</span>
        </header>
        ${this.state.error ? `<div class="toast error" role="alert">${this.state.error}</div>` : ""}
        ${this.state.message ? `<div class="toast" role="status">${this.state.message}</div>` : ""}
        ${playerView(this.state.data, this.state.actor, this.state.selectedCharacterId)}
        ${
          this.state.actor.role === "GM"
            ? gmView(this.state.data, this.state.players, this.state.gmTab, this.state.selectedGmId)
            : ""
        }
      </main>
    `;
    this.bindEvents();
  }

  private bindEvents(): void {
    qs<HTMLSelectElement>(this.root, "#character-picker")?.addEventListener("change", (event) => {
      this.state.selectedCharacterId = (event.currentTarget as HTMLSelectElement).value;
      this.render();
    });

    bindClick(this.root, "[data-tab]", (button) => {
      this.state.gmTab = button.dataset.tab ?? "characters";
      this.state.selectedGmId = null;
      localStorage.setItem("essence-powers.tab", this.state.gmTab);
      this.render();
    });

    bindClick(this.root, "[data-select]", (button) => {
      this.state.selectedGmId = button.dataset.select || null;
      this.render();
    });

    bindClick(this.root, "[data-action]", (button) => this.handleAction(button));
    bindSubmit(this.root, '[data-form="character"]', (form) => this.saveCharacterForm(form));
    bindSubmit(this.root, '[data-form="essence"]', (form) => this.saveLibraryForm(form, "essence"));
    bindSubmit(this.root, '[data-form="confluence"]', (form) => this.saveLibraryForm(form, "confluence"));
  }

  private async handleAction(button: HTMLButtonElement): Promise<void> {
    const action = button.dataset.action ?? "";
    try {
      if (action.startsWith("use-essence:")) await this.useEssencePower(action.split(":")[1], button.dataset.powerId);
      else if (action.startsWith("use-confluence:")) await this.useConfluencePower(action.split(":")[1], button.dataset.powerId);
      else if (action === "resource") await this.adjustResource(button);
      else if (action === "long-rest") await this.longRest();
      else if (action === "delete-character") await this.deleteCharacter(button.dataset.id);
      else if (action === "reset-character") await this.resetCharacter(button.dataset.id);
      else if (action === "delete-essence") await this.deleteEssence(button.dataset.id);
      else if (action === "delete-confluence") await this.deleteConfluence(button.dataset.id);
      else if (action === "load-sample") await this.loadSampleData();
      else if (action === "clear-data") await this.clearData();
      else if (action === "export-data") await this.exportData();
      else if (action === "selected-token") await this.useSelectedToken(button.dataset.target);
      else if (action === "add-power" || action === "remove-power" || action === "move-power") this.editPowerList(button);
    } catch (error) {
      this.setMessage("", error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  private currentCharacterId(): string {
    const id = qs<HTMLElement>(this.root, ".player-panel")?.dataset.characterId;
    if (!id) throw new Error("No character selected.");
    return id;
  }

  private async useEssencePower(essenceId: string, powerId?: string): Promise<void> {
    await updateData((data) =>
      updateCharacterResource(data, this.state.actor, this.currentCharacterId(), (character) => {
        const power = data.essences[essenceId]?.powers.find((item) => item.id === powerId);
        if (!power) throw new Error("Power not found.");
        return {
          ...character,
          essencePoints: {
            ...character.essencePoints,
            current: spendResource(character.essencePoints.current, character.essencePoints.max, power.cost),
          },
        };
      }),
    );
    this.setMessage("Essence power used.");
  }

  private async useConfluencePower(confluenceId: string, powerId?: string): Promise<void> {
    await updateData((data) =>
      updateCharacterResource(data, this.state.actor, this.currentCharacterId(), (character) => {
        const power = data.confluences[confluenceId]?.powers.find((item) => item.id === powerId);
        if (!power) throw new Error("Power not found.");
        return {
          ...character,
          confluenceUses: {
            ...character.confluenceUses,
            current: spendResource(character.confluenceUses.current, character.confluenceUses.max, power.cost),
          },
        };
      }),
    );
    this.setMessage("Confluence power used.");
  }

  private async adjustResource(button: HTMLButtonElement): Promise<void> {
    const resource = button.dataset.resource as "essencePoints" | "confluenceUses";
    const delta = Number(button.dataset.delta ?? 0);
    await updateData((data) =>
      updateCharacterResource(data, this.state.actor, this.currentCharacterId(), (character) => ({
        ...character,
        [resource]: {
          ...character[resource],
          current: adjustResource(character[resource].current, character[resource].max, delta),
        },
      })),
    );
  }

  private async longRest(): Promise<void> {
    if (!confirm("Restore all essence points and confluence uses?")) return;
    await updateData((data) =>
      updateCharacterResource(data, this.state.actor, this.currentCharacterId(), (character) => longRest(character)),
    );
    this.setMessage("Resources restored.");
  }

  private characterFromForm(form: HTMLFormElement): Character {
    const data = new FormData(form);
    const epMax = numberValue(data, "epMax");
    const cuMax = numberValue(data, "cuMax");
    const essenceIds = ["essence1", "essence2", "essence3"]
      .map((key) => textValue(data, key))
      .filter(Boolean);
    return {
      id: textValue(data, "id"),
      name: textValue(data, "name"),
      ownerPlayerId: textValue(data, "ownerPlayerId"),
      tokenId: textValue(data, "tokenId") || null,
      essenceIds,
      confluenceId: textValue(data, "confluenceId") || null,
      essencePoints: { max: epMax, current: Math.min(numberValue(data, "epCurrent"), epMax) },
      confluenceUses: { max: cuMax, current: Math.min(numberValue(data, "cuCurrent"), cuMax) },
      visibleToPlayers: data.get("visibleToPlayers") === "on",
    };
  }

  private async saveCharacterForm(form: HTMLFormElement): Promise<void> {
    const character = this.characterFromForm(form);
    await updateData((data) => saveCharacter(data, this.state.actor, character, this.state.players.map((player) => player.id)));
    this.state.selectedGmId = character.id;
    this.setMessage("Character saved.");
  }

  private powersFromForm(data: FormData): Power[] {
    const ids = [...data.keys()]
      .filter((key) => key.startsWith("powerId:"))
      .map((key) => key.split(":")[1]);
    return ids.map((index) => ({
      id: textValue(data, `powerId:${index}`),
      name: textValue(data, `powerName:${index}`),
      description: String(data.get(`powerDescription:${index}`) ?? ""),
      cost: numberValue(data, `powerCost:${index}`),
      activation: textValue(data, `powerActivation:${index}`),
      notes: textValue(data, `powerNotes:${index}`),
    }));
  }

  private async saveLibraryForm(form: HTMLFormElement, kind: "essence" | "confluence"): Promise<void> {
    const formData = new FormData(form);
    const item = {
      id: textValue(formData, "id"),
      name: textValue(formData, "name"),
      summary: String(formData.get("summary") ?? ""),
      powers: this.powersFromForm(formData).filter((power) => power.name),
    };
    if (kind === "essence") {
      await updateData((data) => saveEssence(data, this.state.actor, item as Essence));
    } else {
      await updateData((data) => saveConfluence(data, this.state.actor, item as Confluence));
    }
    this.state.selectedGmId = item.id;
    this.setMessage(`${kind === "essence" ? "Essence" : "Confluence"} saved.`);
  }

  private async deleteCharacter(id?: string): Promise<void> {
    if (!id || !confirm("Delete this character?")) return;
    await updateData((data) => deleteCharacter(data, this.state.actor, id));
    this.state.selectedGmId = null;
    this.setMessage("Character deleted.");
  }

  private async resetCharacter(id?: string): Promise<void> {
    if (!id || !confirm("Reset this character's resources?")) return;
    await updateData((data) => resetCharacterResources(data, this.state.actor, id));
    this.setMessage("Character resources reset.");
  }

  private async deleteEssence(id?: string): Promise<void> {
    if (!id) return;
    try {
      await updateData((data) => deleteEssence(data, this.state.actor, id));
    } catch (error) {
      if (!confirm(`${error instanceof Error ? error.message : "Essence is assigned."} Delete anyway?`)) return;
      await updateData((data) => deleteEssence(data, this.state.actor, id, true));
    }
    this.state.selectedGmId = null;
    this.setMessage("Essence deleted.");
  }

  private async deleteConfluence(id?: string): Promise<void> {
    if (!id) return;
    try {
      await updateData((data) => deleteConfluence(data, this.state.actor, id));
    } catch (error) {
      if (!confirm(`${error instanceof Error ? error.message : "Confluence is assigned."} Delete anyway?`)) return;
      await updateData((data) => deleteConfluence(data, this.state.actor, id, true));
    }
    this.state.selectedGmId = null;
    this.setMessage("Confluence deleted.");
  }

  private async loadSampleData(): Promise<void> {
    if (!confirm("Load sample essences and confluence? Existing matching sample IDs will be replaced.")) return;
    await updateData((data) => createSampleData(data));
    this.setMessage("Sample data loaded.");
  }

  private async clearData(): Promise<void> {
    if (!confirm("Clear all Essence Powers data for this room?")) return;
    await writeData(createEmptyData());
    this.setMessage("Shared data cleared.");
  }

  private async exportData(): Promise<void> {
    await navigator.clipboard?.writeText(JSON.stringify(this.state.data, null, 2));
    this.setMessage("Data copied to clipboard.");
  }

  private async useSelectedToken(characterId?: string): Promise<void> {
    const tokenId = await getSelectedTokenId();
    if (!tokenId) {
      if (!characterId) throw new Error("Save the character first, then link a token.");
      this.state.pendingTokenCharacterId = characterId;
      this.setMessage("Token pick mode active. Click a token in the Owlbear scene to link it.");
      return;
    }
    await this.assignTokenToCharacter(characterId, tokenId);
    this.setMessage("Token linked to character.");
  }

  private async assignTokenToCharacter(characterId: string | undefined, tokenId: string): Promise<void> {
    const form = qs<HTMLFormElement>(this.root, '[data-form="character"]');
    const input = form?.querySelector<HTMLInputElement>('input[name="tokenId"]');
    if (input) input.value = tokenId;
    if (!characterId) return;
    await updateData((data) => {
      const character = data.characters[characterId];
      if (!character) throw new Error("Character not found. Save the character before linking a token.");
      return saveCharacter(data, this.state.actor, { ...character, tokenId }, this.state.players.map((player) => player.id));
    });
  }

  private editPowerList(button: HTMLButtonElement): void {
    const form = button.closest("form");
    if (!form) return;
    const kind = form.dataset.form === "confluence" ? "confluence" : "essence";
    const formData = new FormData(form);
    const powers = this.powersFromForm(formData);
    const action = button.dataset.action;
    const index = Number(button.dataset.index ?? -1);
    if (action === "add-power") powers.push(kind === "essence" ? createBlankPower() : createBlankConfluencePower());
    if (action === "remove-power" && index >= 0) powers.splice(index, 1);
    if (action === "move-power" && index >= 0) {
      const dir = Number(button.dataset.dir ?? 0);
      const next = index + dir;
      if (next >= 0 && next < powers.length) {
        [powers[index], powers[next]] = [powers[next], powers[index]];
      }
    }
    const item = {
      id: textValue(formData, "id"),
      name: textValue(formData, "name"),
      summary: String(formData.get("summary") ?? ""),
      powers,
    };
    this.state.data =
      kind === "essence"
        ? { ...this.state.data, essences: { ...this.state.data.essences, [item.id]: item } }
        : { ...this.state.data, confluences: { ...this.state.data.confluences, [item.id]: item } };
    this.state.selectedGmId = item.id;
    this.render();
  }
}

export async function createApp(root: HTMLElement, actor: Actor & { name: string }): Promise<EssencePowersApp> {
  const [data, players] = await Promise.all([readData(), getPlayers()]);
  return new EssencePowersApp(root, actor, data, players);
}
