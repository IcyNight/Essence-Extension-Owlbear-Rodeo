import { EssenceData } from "./data/schema";
import { Actor } from "./sdk/permissions";
import {
  closePinnedActiveConfluence,
  createConfluenceAreaNotifications,
  getForgeTurnState,
  onForgeTurnChange,
  onSceneReadyChange,
} from "./sdk/owlbear";
import { onDataChange, readData, updateData } from "./sdk/storage";
import { applyForgeTurnConfluenceTick } from "./services/resourceService";
import { escapeHtml } from "./ui/dom";

type ActiveConfluenceState = {
  data: EssenceData;
  actor: Actor;
  lastForgeTurnTokenId: string | null;
  lastForgeRound: number;
};

function activeConfluenceList(data: EssenceData): string {
  const active = Object.values(data.characters)
    .filter((character) => character.confluenceRoundsRemaining > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (active.length === 0) {
    return `<p class="empty compact-empty">No active confluences.</p>`;
  }

  return active
    .map(
      (character) => `
        <div>
          <span>${escapeHtml(character.name)}</span>
          <strong>${character.confluenceRoundsRemaining}</strong>
        </div>
      `,
    )
    .join("");
}

export class ActiveConfluenceApp {
  private state: ActiveConfluenceState;
  private unsubscribers: Array<() => void> = [];

  constructor(
    private root: HTMLElement,
    actor: Actor,
    data: EssenceData,
  ) {
    this.state = {
      actor,
      data,
      lastForgeTurnTokenId: null,
      lastForgeRound: 1,
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
        this.render();
      }),
      onForgeTurnChange((state) => this.handleForgeTurnChange(state.currentTurnTokenId, state.currentRound)),
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

  private render(): void {
    this.root.innerHTML = `
      <main class="pinned-confluence">
        <header>
          <h1>Active confluence</h1>
          <button type="button" data-action="close-pinned" aria-label="Close pinned tracker">x</button>
        </header>
        <div class="active-confluence-list">
          ${activeConfluenceList(this.state.data)}
        </div>
      </main>
    `;
    this.bindEvents();
  }

  private bindEvents(): void {
    const closeButton = this.root.querySelector<HTMLButtonElement>('[data-action="close-pinned"]');
    closeButton?.addEventListener("click", () => closePinnedActiveConfluence());
  }

  private async handleForgeTurnChange(currentTurnTokenId: string | null, currentRound: number): Promise<void> {
    const previousTurnTokenId = this.state.lastForgeTurnTokenId;
    const previousRound = this.state.lastForgeRound;
    if (previousTurnTokenId === currentTurnTokenId && previousRound === currentRound) return;
    this.state.lastForgeTurnTokenId = currentTurnTokenId;
    this.state.lastForgeRound = currentRound;
    if (!previousTurnTokenId || this.state.actor.role !== "GM") return;
    const eventKey = `${previousTurnTokenId}->${currentTurnTokenId ?? "none"}@${currentRound}`;
    await updateData(async (data) => {
      if (data.lastProcessedForgeTurnEvent === eventKey) return data;
      const notifications = await createConfluenceAreaNotifications(data, previousTurnTokenId, eventKey, this.state.actor.playerId);
      const ticked = applyForgeTurnConfluenceTick(data, this.state.actor, previousTurnTokenId, currentTurnTokenId, currentRound);
      if (notifications.length === 0) return ticked;
      const seen = new Set(ticked.confluenceNotifications.map((event) => event.id));
      return {
        ...ticked,
        confluenceNotifications: [
          ...ticked.confluenceNotifications,
          ...notifications.filter((event) => !seen.has(event.id)),
        ].slice(-30),
      };
    });
  }
}

export async function createActiveConfluenceApp(root: HTMLElement, actor: Actor): Promise<ActiveConfluenceApp> {
  const data = await readData();
  return new ActiveConfluenceApp(root, actor, data);
}
