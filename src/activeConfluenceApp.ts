import { EssenceData } from "./data/schema";
import { Actor } from "./sdk/permissions";
import { getForgeTurnState, onForgeTurnChange } from "./sdk/owlbear";
import { onDataChange, readData, updateData } from "./sdk/storage";
import { applyForgeTurnConfluenceTick } from "./services/resourceService";
import { escapeHtml } from "./ui/dom";

type ActiveConfluenceState = {
  data: EssenceData;
  actor: Actor;
  lastForgeTurnTokenId: string | null;
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
    };
  }

  mount(): void {
    this.render();
    getForgeTurnState().then((state) => {
      this.state.lastForgeTurnTokenId = state.currentTurnTokenId;
    });
    this.unsubscribers.push(
      onDataChange((data) => {
        this.state.data = data;
        this.render();
      }),
      onForgeTurnChange((state) => this.handleForgeTurnChange(state.currentTurnTokenId, state.currentRound)),
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
        </header>
        <section class="active-confluence-list">
          ${activeConfluenceList(this.state.data)}
        </section>
      </main>
    `;
  }

  private async handleForgeTurnChange(currentTurnTokenId: string | null, currentRound: number): Promise<void> {
    const previousTurnTokenId = this.state.lastForgeTurnTokenId;
    if (previousTurnTokenId === currentTurnTokenId) return;
    this.state.lastForgeTurnTokenId = currentTurnTokenId;
    if (!previousTurnTokenId || this.state.actor.role !== "GM") return;
    await updateData((data) =>
      applyForgeTurnConfluenceTick(data, this.state.actor, previousTurnTokenId, currentTurnTokenId, currentRound),
    );
  }
}

export async function createActiveConfluenceApp(root: HTMLElement, actor: Actor): Promise<ActiveConfluenceApp> {
  const data = await readData();
  return new ActiveConfluenceApp(root, actor, data);
}
