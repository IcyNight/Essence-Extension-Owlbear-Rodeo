import { EssenceData } from "./data/schema";
import { Actor } from "./sdk/permissions";
import {
  closePinnedActiveConfluence,
  getForgeTurnState,
  onForgeTurnChange,
  openPinnedActiveConfluence,
  PinnedActiveConfluenceBounds,
  resizePinnedActiveConfluence,
} from "./sdk/owlbear";
import { onDataChange, readData, updateData } from "./sdk/storage";
import { applyForgeTurnConfluenceTick } from "./services/resourceService";
import { escapeHtml } from "./ui/dom";

type ActiveConfluenceState = {
  data: EssenceData;
  actor: Actor;
  lastForgeTurnTokenId: string | null;
  bounds: PinnedActiveConfluenceBounds;
};

const MIN_WIDTH = 220;
const MIN_HEIGHT = 160;
function boundsFromUrl(): PinnedActiveConfluenceBounds {
  const params = new URLSearchParams(window.location.search);
  return {
    left: Math.max(0, Number(params.get("x") ?? 80)),
    top: Math.max(0, Number(params.get("y") ?? 80)),
    width: Math.max(MIN_WIDTH, Number(params.get("w") ?? 280)),
    height: Math.max(MIN_HEIGHT, Number(params.get("h") ?? 240)),
  };
}

function saveBounds(bounds: PinnedActiveConfluenceBounds): void {
  localStorage.setItem("essence-powers.active-confluence.bounds", JSON.stringify(bounds));
}

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
      bounds: boundsFromUrl(),
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
          <button type="button" data-action="close-pinned" aria-label="Close pinned tracker">x</button>
        </header>
        <section class="active-confluence-list">
          ${activeConfluenceList(this.state.data)}
        </section>
        <div class="resize-handle" title="Resize"></div>
      </main>
    `;
    this.bindEvents();
  }

  private bindEvents(): void {
    const header = this.root.querySelector<HTMLElement>(".pinned-confluence header");
    const resizeHandle = this.root.querySelector<HTMLElement>(".resize-handle");
    const closeButton = this.root.querySelector<HTMLButtonElement>('[data-action="close-pinned"]');
    header?.addEventListener("pointerdown", (event) => this.startMove(event));
    resizeHandle?.addEventListener("pointerdown", (event) => this.startResize(event));
    closeButton?.addEventListener("click", () => closePinnedActiveConfluence());
  }

  private startMove(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startBounds = { ...this.state.bounds };

    const onPointerUp = (moveEvent: PointerEvent) => {
      window.removeEventListener("pointerup", onPointerUp);
      const next = {
        ...startBounds,
        left: Math.max(0, startBounds.left + moveEvent.clientX - startX),
        top: Math.max(0, startBounds.top + moveEvent.clientY - startY),
      };
      this.state.bounds = next;
      saveBounds(next);
      openPinnedActiveConfluence(next);
    };

    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  private startResize(event: PointerEvent): void {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startBounds = { ...this.state.bounds };

    const onPointerMove = (moveEvent: PointerEvent) => {
      const next = {
        ...startBounds,
        width: Math.max(MIN_WIDTH, startBounds.width + moveEvent.clientX - startX),
        height: Math.max(MIN_HEIGHT, startBounds.height + moveEvent.clientY - startY),
      };
      this.state.bounds = next;
      saveBounds(next);
      resizePinnedActiveConfluence(next.width, next.height);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      openPinnedActiveConfluence(this.state.bounds);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
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
