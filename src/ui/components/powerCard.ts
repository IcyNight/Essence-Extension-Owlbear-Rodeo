import { Power } from "../../data/schema";
import { escapeHtml } from "../dom";

export function powerCard(power: Power, resourceLabel: string, affordable: boolean, action: string): string {
  return `
    <article class="power-card">
      <div class="power-card__head">
        <h4>${escapeHtml(power.name)}</h4>
        <span class="cost">${escapeHtml(resourceLabel)} ${power.cost}</span>
      </div>
      ${power.activation ? `<p class="activation">${escapeHtml(power.activation)}</p>` : ""}
      <p>${escapeHtml(power.description || "No description entered.")}</p>
      ${power.notes ? `<p class="notes">${escapeHtml(power.notes)}</p>` : ""}
      <button class="primary small" type="button" data-action="${action}" data-power-id="${escapeHtml(power.id)}" ${
        affordable ? "" : "disabled"
      }>Use Power</button>
    </article>
  `;
}
