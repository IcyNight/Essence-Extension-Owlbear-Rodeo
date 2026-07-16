import { Character, Confluence, Essence, EssenceData, PlayerInfo, Power, createEmptyData } from "./data/schema";
import { createSampleData } from "./data/sampleData";
import { numberValue, textValue, bindClick, bindSubmit, qs } from "./ui/dom";
import { Actor, getVisibleCharacters } from "./sdk/permissions";
import {
  getPlayers,
  getSceneTokenInfo,
  getSelectedTokenId,
  getForgeTurnState,
  createConfluenceAreaNotifications,
  deleteConfluenceAreaShapes,
  getSelectedConfluenceAreaShape,
  onPartyChange,
  onForgeTurnChange,
  onPlayerChange,
  onSelectionChange,
  onSceneReadyChange,
  selectConfluenceAreaShape,
  showConfluenceReminder,
} from "./sdk/owlbear";
import { onDataChange, readData, updateData, writeData } from "./sdk/storage";
import { playerView } from "./ui/playerView";
import { gmView } from "./ui/gmView";
import { createBlankCharacter, saveCharacter, deleteCharacter, resetCharacterResources } from "./services/characterService";
import { saveEssence, deleteEssence, createBlankEssence, createBlankPower } from "./services/essenceService";
import {
  saveConfluence,
  deleteConfluence,
  createBlankConfluence,
  createBlankConfluencePower,
} from "./services/confluenceService";
import {
  applyForgeRoundConfluenceTick,
  activateConfluence,
  adjustResource,
  getExpiringConfluenceAreaItemIds,
  longRest,
  spendResource,
  updateCharacterResource,
} from "./services/resourceService";

type AppState = {
  data: EssenceData;
  actor: Actor;
  playerName: string;
  players: PlayerInfo[];
  selectedCharacterId: string | null;
  gmTab: string;
  selectedGmId: string | null;
  draftCharacter: Character;
  draftEssence: Essence;
  draftConfluence: Confluence;
  pendingTokenCharacterId: string | null;
  pendingConfluenceAreaCharacterId: string | null;
  lastForgeTurnTokenId: string | null;
  lastForgeRound: number;
  forgeEncounterSequence: number;
  message: string;
  error: string;
};

const SEEN_CONFLUENCE_NOTIFICATIONS_KEY = "essence-powers.seen-confluence-notifications";
const CURRENT_EXTENSION_VERSION = "0.1.36";
const LIVE_MANIFEST_URL = "https://icynight.github.io/Essence-Extension-Owlbear-Rodeo/manifest.json";

type ExtensionManifest = {
  version?: unknown;
};

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftValue !== rightValue) return leftValue - rightValue;
  }
  return 0;
}

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
      draftCharacter: createBlankCharacter(),
      draftEssence: createBlankEssence(),
      draftConfluence: createBlankConfluence(),
      pendingTokenCharacterId: null,
      pendingConfluenceAreaCharacterId: null,
      lastForgeTurnTokenId: null,
      lastForgeRound: 1,
      forgeEncounterSequence: 0,
      message: "",
      error: "",
    };
  }

  mount(): void {
    this.render();
    getForgeTurnState().then((state) => {
      this.state.lastForgeTurnTokenId = state.currentTurnTokenId;
      this.state.lastForgeRound = state.currentRound;
    });
    this.unsubscribers.push(
      onDataChange((data) => {
        this.state.data = data;
        this.showConfluenceNotifications(data);
        this.render();
      }),
      onPlayerChange(() => this.refreshPlayers()),
      onSelectionChange((selection) => this.capturePendingTokenSelection(selection)),
      onPartyChange(() => this.refreshPlayers()),
      onForgeTurnChange((state) => this.handleForgeTurnChange(state.currentTurnTokenId, state.currentRound)),
      this.pollForgeTurnState(),
      onSceneReadyChange((ready) => {
        if (!ready) return;
        getForgeTurnState().then((state) => {
          this.state.lastForgeTurnTokenId = state.currentTurnTokenId;
          this.state.lastForgeRound = state.currentRound;
        });
      }),
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
    if (this.state.pendingConfluenceAreaCharacterId && selection?.[0]) {
      const characterId = this.state.pendingConfluenceAreaCharacterId;
      this.state.pendingConfluenceAreaCharacterId = null;
      try {
        await this.saveConfluenceAreaSelection(characterId, selection[0]);
      } catch (error) {
        this.setMessage("", error instanceof Error ? error.message : "Unable to save confluence area.");
      }
      return;
    }

    if (!this.state.pendingTokenCharacterId || !selection?.[0]) return;
    const tokenId = selection[0];
    const characterId = this.state.pendingTokenCharacterId;
    this.state.pendingTokenCharacterId = null;

    try {
      await this.assignTokenToCharacter(characterId, tokenId);
    } catch (error) {
      this.setMessage("", error instanceof Error ? error.message : "Unable to link token.");
    }
  }

  private render(): void {
    const isGm = this.state.actor.role === "GM";
    const visible = isGm ? [] : getVisibleCharacters(this.state.actor, this.state.data);
    if (!isGm && !this.state.selectedCharacterId && visible[0]) {
      this.state.selectedCharacterId = visible[0].id;
    }

    this.root.innerHTML = `
      <main class="app-shell">
        <header class="app-header">
          <div>
            <p>${isGm ? "GM Console" : this.state.playerName}</p>
            <h1>Essence Powers</h1>
          </div>
          <span class="role">${this.state.actor.role}</span>
        </header>
        ${this.state.error ? `<div class="toast error" role="alert">${this.state.error}</div>` : ""}
        ${this.state.message ? `<div class="toast" role="status">${this.state.message}</div>` : ""}
        ${isGm ? "" : playerView(this.state.data, this.state.actor, this.state.selectedCharacterId)}
        ${
          isGm
            ? gmView(
                this.state.data,
                this.state.players,
                this.state.gmTab,
              this.state.selectedGmId,
              this.state.draftCharacter,
              this.state.draftEssence,
              this.state.draftConfluence,
            )
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
      if (!this.state.selectedGmId && this.state.gmTab === "characters") {
        this.state.draftCharacter = createBlankCharacter();
      } else if (!this.state.selectedGmId && this.state.gmTab === "essences") {
        this.state.draftEssence = createBlankEssence();
      } else if (!this.state.selectedGmId && this.state.gmTab === "confluences") {
        this.state.draftConfluence = createBlankConfluence();
      }
      this.render();
    });

    bindClick(this.root, "[data-action]", (button) => this.handleAction(button));
    bindSubmit(this.root, '[data-form="character"]', (form) => this.saveCharacterForm(form));
    bindSubmit(this.root, '[data-form="essence"]', (form) => this.saveLibraryForm(form, "essence"));
    bindSubmit(this.root, '[data-form="confluence"]', (form) => this.saveLibraryForm(form, "confluence"));
    this.bindLibraryAutosave();
  }

  private async handleAction(button: HTMLButtonElement): Promise<void> {
    const action = button.dataset.action ?? "";
    try {
      if (action.startsWith("use-essence:")) await this.useEssencePower(action.split(":")[1], button.dataset.powerId);
      else if (action.startsWith("use-confluence:")) await this.useConfluencePower(action.split(":")[1], button.dataset.powerId);
      else if (action === "resource") await this.adjustResource(button);
      else if (action === "long-rest") await this.longRest();
      else if (action === "confluence-area") await this.selectConfluenceArea();
      else if (action === "delete-character") await this.deleteCharacter(button.dataset.id);
      else if (action === "reset-character") await this.resetCharacter(button.dataset.id);
      else if (action === "delete-essence") await this.deleteEssence(button.dataset.id);
      else if (action === "delete-confluence") await this.deleteConfluence(button.dataset.id);
      else if (action === "load-sample") await this.loadSampleData();
      else if (action === "clear-data") await this.clearData();
      else if (action === "check-update") await this.checkForUpdate();
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
          confluenceRoundsRemaining: 10,
          confluenceAreaSaved: false,
        };
      }),
    );
    this.setMessage("Confluence power used.");
  }

  private async adjustResource(button: HTMLButtonElement): Promise<void> {
    const resource = button.dataset.resource as "essencePoints" | "confluenceUses";
    const delta = Number(button.dataset.delta ?? 0);
    if (this.state.actor.role !== "GM" && delta !== -1) {
      throw new Error("Players can only use one resource at a time.");
    }
    await updateData((data) =>
      updateCharacterResource(data, this.state.actor, this.currentCharacterId(), (character) => {
        const updated = {
          ...character,
          [resource]: {
            ...character[resource],
            current: adjustResource(character[resource].current, character[resource].max, delta),
          },
        };
        return resource === "confluenceUses" && delta < 0 ? activateConfluence(updated) : updated;
      }),
    );
  }

  private async handleForgeTurnChange(currentTurnTokenId: string | null, currentRound: number): Promise<void> {
    const previousTurnTokenId = this.state.lastForgeTurnTokenId;
    const previousRound = this.state.lastForgeRound;
    if (previousTurnTokenId === currentTurnTokenId && previousRound === currentRound) return;
    const encounterReset = currentRound < previousRound;
    if (encounterReset) {
      this.state.forgeEncounterSequence += 1;
    }
    this.state.lastForgeTurnTokenId = currentTurnTokenId;
    this.state.lastForgeRound = currentRound;
    if (this.state.actor.role !== "GM") return;
    if (encounterReset) return;
    const roundTickAmount = currentRound > previousRound ? currentRound - previousRound : 0;
    const eventKey = `${this.state.forgeEncounterSequence}:${previousTurnTokenId}->${currentTurnTokenId ?? "none"}@${currentRound}`;
    const roundEventKey = `${this.state.forgeEncounterSequence}:round:${currentRound}`;
    let expiredAreaItemIds: string[] = [];
    await updateData(async (data) => {
      if (roundTickAmount > 0 && data.lastProcessedForgeRoundEvent !== roundEventKey) {
        expiredAreaItemIds = getExpiringConfluenceAreaItemIds(data, roundTickAmount);
      }
      let next =
        roundTickAmount > 0
          ? applyForgeRoundConfluenceTick(
              data,
              this.state.actor,
              currentRound,
              this.state.forgeEncounterSequence,
              roundTickAmount,
            )
          : data;
      if (!previousTurnTokenId || next.lastProcessedForgeTurnEvent === eventKey) return next;
      const notifications = await createConfluenceAreaNotifications(next, previousTurnTokenId, eventKey, this.state.actor.playerId);
      next = {
        ...next,
        lastProcessedForgeTurnEvent: eventKey,
      };
      if (notifications.length === 0) return next;
      const seen = new Set(next.confluenceNotifications.map((event) => event.id));
      return {
        ...next,
        confluenceNotifications: [
          ...next.confluenceNotifications,
          ...notifications.filter((event) => !seen.has(event.id)),
        ].slice(-30),
      };
    });
    if (expiredAreaItemIds.length > 0) {
      await deleteConfluenceAreaShapes(expiredAreaItemIds);
    }
  }

  private pollForgeTurnState(): () => void {
    const interval = window.setInterval(() => {
      if (this.state.actor.role !== "GM") return;
      getForgeTurnState().then((state) => this.handleForgeTurnChange(state.currentTurnTokenId, state.currentRound));
    }, 1500);
    return () => window.clearInterval(interval);
  }

  private seenConfluenceNotificationIds(): Set<string> {
    try {
      const value = JSON.parse(localStorage.getItem(SEEN_CONFLUENCE_NOTIFICATIONS_KEY) ?? "[]");
      return new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);
    } catch {
      return new Set();
    }
  }

  private saveSeenConfluenceNotificationIds(ids: Set<string>): void {
    localStorage.setItem(SEEN_CONFLUENCE_NOTIFICATIONS_KEY, JSON.stringify([...ids].slice(-60)));
  }

  private showConfluenceNotifications(data: EssenceData): void {
    const seen = this.seenConfluenceNotificationIds();
    const pending = data.confluenceNotifications.filter(
      (event) => event.ownerPlayerId === this.state.actor.playerId && !seen.has(event.id),
    );
    if (pending.length === 0) return;
    pending.forEach((event) => seen.add(event.id));
    this.saveSeenConfluenceNotificationIds(seen);
    const tokenNames = pending.flatMap((event) => event.tokenNames);
    const confluenceNames = pending.flatMap((event) => event.confluenceNames);
    showConfluenceReminder(tokenNames, confluenceNames);
  }

  private async selectConfluenceArea(): Promise<void> {
    const characterId = this.currentCharacterId();
    const character = this.state.data.characters[characterId];
    if (!character || character.confluenceRoundsRemaining <= 0) {
      throw new Error("Use a confluence power before selecting an area.");
    }

    const selectedAreaItemId = await getSelectedConfluenceAreaShape();
    if (selectedAreaItemId) {
      await this.saveConfluenceAreaSelection(characterId, selectedAreaItemId);
      return;
    }

    if (character.confluenceAreaItemId && character.confluenceAreaSaved) {
      const selected = await selectConfluenceAreaShape(character.confluenceAreaItemId);
      if (selected) {
        await updateData((data) =>
          updateCharacterResource(data, this.state.actor, characterId, (item) => ({
            ...item,
            confluenceAreaSaved: false,
          })),
        );
        this.setMessage("Current confluence area selected. Choose another shape, or press Select Area again to re-save it.");
        return;
      }
    }

    this.state.pendingConfluenceAreaCharacterId = characterId;
    this.setMessage("Area pick mode active. Select an existing Owlbear shape to use as the confluence area.");
  }

  private async saveConfluenceAreaSelection(characterId: string, areaItemId: string): Promise<void> {
    const selectedAreaItemId = await getSelectedConfluenceAreaShape(areaItemId);
    if (!selectedAreaItemId) throw new Error("Select an Owlbear shape to use as the confluence area.");
    await updateData((data) =>
      updateCharacterResource(data, this.state.actor, characterId, (item) => ({
        ...item,
        confluenceAreaItemId: selectedAreaItemId,
        confluenceAreaSaved: true,
      })),
    );
    this.setMessage("Confluence area saved.");
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
      confluenceRoundsRemaining: Math.max(0, Number(this.state.data.characters[textValue(data, "id")]?.confluenceRoundsRemaining ?? 0)),
      confluenceAreaItemId: this.state.data.characters[textValue(data, "id")]?.confluenceAreaItemId ?? null,
      confluenceAreaSaved: Boolean(this.state.data.characters[textValue(data, "id")]?.confluenceAreaSaved),
      visibleToPlayers: data.get("visibleToPlayers") === "on",
    };
  }

  private async saveCharacterForm(form: HTMLFormElement): Promise<void> {
    const character = this.characterFromForm(form);
    await updateData((data) => saveCharacter(data, this.state.actor, character, this.state.players.map((player) => player.id)));
    this.state.selectedGmId = character.id;
    this.state.draftCharacter = createBlankCharacter();
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
    const savedId = textValue(new FormData(form), "id");
    const next = await this.persistLibraryForm(form, kind);
    this.state.data = next;
    this.state.selectedGmId = savedId;
    if (kind === "essence" && this.state.draftEssence.id === savedId) {
      this.state.draftEssence = createBlankEssence();
    }
    if (kind === "confluence" && this.state.draftConfluence.id === savedId) {
      this.state.draftConfluence = createBlankConfluence();
    }
    this.setMessage(`${kind === "essence" ? "Essence" : "Confluence"} saved.`);
  }

  private async persistLibraryForm(form: HTMLFormElement, kind: "essence" | "confluence"): Promise<EssenceData> {
    const formData = new FormData(form);
    const item = {
      id: textValue(formData, "id"),
      name: textValue(formData, "name"),
      summary: String(formData.get("summary") ?? ""),
      powers: this.powersFromForm(formData).filter((power) => power.name),
    };
    if (kind === "essence") {
      return updateData((data) => saveEssence(data, this.state.actor, item as Essence));
    }
    return updateData((data) => saveConfluence(data, this.state.actor, item as Confluence));
  }

  private bindLibraryAutosave(): void {
    this.root.querySelectorAll<HTMLFormElement>('[data-form="essence"], [data-form="confluence"]').forEach((form) => {
      form.addEventListener("change", () => {
        const kind = form.dataset.form === "confluence" ? "confluence" : "essence";
        const id = textValue(new FormData(form), "id");
        const exists = kind === "essence" ? Boolean(this.state.data.essences[id]) : Boolean(this.state.data.confluences[id]);
        if (!exists) return;
        void this.persistLibraryForm(form, kind)
          .then((next) => {
            this.state.data = next;
          })
          .catch((error) => {
            this.setMessage("", error instanceof Error ? error.message : "Unable to publish library changes.");
          });
      });
    });
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

  private async checkForUpdate(): Promise<void> {
    const response = await fetch(`${LIVE_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to check for updates.");
    const manifest = (await response.json()) as ExtensionManifest;
    const latestVersion = typeof manifest.version === "string" ? manifest.version : "";
    if (!latestVersion) throw new Error("Live manifest is missing update information.");
    if (compareVersions(latestVersion, CURRENT_EXTENSION_VERSION) <= 0) {
      this.setMessage(`Already up to date (${CURRENT_EXTENSION_VERSION}).`);
      return;
    }
    this.setMessage(`Version ${latestVersion} is available. Please refresh the page to see the new version.`);
  }

  private async useSelectedToken(characterId?: string): Promise<void> {
    const tokenId = await getSelectedTokenId();
    if (!tokenId) {
      this.state.pendingTokenCharacterId = characterId || this.state.draftCharacter.id;
      this.setMessage("Token pick mode active. Click a token in the Owlbear scene to create or link the character.");
      return;
    }
    await this.assignTokenToCharacter(characterId || this.state.draftCharacter.id, tokenId);
  }

  private async assignTokenToCharacter(characterId: string | undefined, tokenId: string): Promise<void> {
    const token = await getSceneTokenInfo(tokenId);
    const ownerPlayerId = token.ownerPlayerId;
    if (ownerPlayerId && !this.state.players.some((player) => player.id === ownerPlayerId)) {
      this.state.players = [...this.state.players, { id: ownerPlayerId, name: "Token Owner" }];
    }
    const form = qs<HTMLFormElement>(this.root, '[data-form="character"]');
    const tokenInput = form?.querySelector<HTMLInputElement>('input[name="tokenId"]');
    const nameInput = form?.querySelector<HTMLInputElement>('input[name="name"]');
    const ownerInput = form?.querySelector<HTMLSelectElement>('select[name="ownerPlayerId"]');
    const visibleInput = form?.querySelector<HTMLInputElement>('input[name="visibleToPlayers"]');
    if (tokenInput) tokenInput.value = token.id;
    if (nameInput && token.name) nameInput.value = token.name;
    if (ownerInput && ownerPlayerId) {
      if (![...ownerInput.options].some((option) => option.value === ownerPlayerId)) {
        ownerInput.add(new Option("Token Owner", ownerPlayerId));
      }
      ownerInput.value = ownerPlayerId;
    }
    if (visibleInput && ownerPlayerId) visibleInput.checked = true;

    if (!form) {
      if (!characterId) return;
      await updateData((data) => {
        const existing = data.characters[characterId];
        const base =
          existing ??
          (this.state.draftCharacter.id === characterId
            ? this.state.draftCharacter
            : { ...createBlankCharacter(), id: characterId });
        const character = {
          ...base,
          name: token.name || base.name,
          ownerPlayerId: ownerPlayerId || base.ownerPlayerId,
          tokenId: token.id,
          visibleToPlayers: ownerPlayerId ? true : base.visibleToPlayers,
        };
        return saveCharacter(
          data,
          this.state.actor,
          character,
          this.state.players.map((player) => player.id),
        );
      });
      this.state.selectedGmId = characterId;
      this.state.draftCharacter = createBlankCharacter();
      this.setMessage(
        token.name
          ? `Created visible character from token: ${token.name}.`
          : "Token linked to character.",
      );
      return;
    }

    const character = this.characterFromForm(form);
    await updateData((data) => saveCharacter(data, this.state.actor, character, this.state.players.map((player) => player.id)));
    this.state.selectedGmId = character.id;
    this.state.draftCharacter = createBlankCharacter();
    const ownerMessage = ownerPlayerId ? " Owner and visibility filled from token." : "";
    this.setMessage(
      token.name ? `Created character from token: ${token.name}.${ownerMessage}` : `Token linked to character.${ownerMessage}`,
    );
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
    const exists =
      kind === "essence" ? Boolean(this.state.data.essences[item.id]) : Boolean(this.state.data.confluences[item.id]);
    if (!exists && kind === "essence") {
      this.state.draftEssence = item as Essence;
      this.state.selectedGmId = null;
    } else if (!exists) {
      this.state.draftConfluence = item as Confluence;
      this.state.selectedGmId = null;
    } else {
      this.state.data =
        kind === "essence"
          ? { ...this.state.data, essences: { ...this.state.data.essences, [item.id]: item } }
          : { ...this.state.data, confluences: { ...this.state.data.confluences, [item.id]: item } };
      this.state.selectedGmId = item.id;
    }
    this.render();
  }
}

export async function createApp(root: HTMLElement, actor: Actor & { name: string }): Promise<EssencePowersApp> {
  const [data, players] = await Promise.all([readData(), getPlayers()]);
  return new EssencePowersApp(root, actor, data, players);
}
