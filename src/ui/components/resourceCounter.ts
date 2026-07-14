import { ResourcePool } from "../../data/schema";
import { escapeHtml } from "../dom";

export function resourceCounter(label: string, pool: ResourcePool, key: string, canRestore: boolean, showControls = true): string {
  const controls = !showControls
    ? ""
    : canRestore
      ? `
        <button type="button" data-action="resource" data-resource="${key}" data-delta="-1" aria-label="Decrease ${escapeHtml(
          label,
        )}">-</button>
        <button type="button" data-action="resource" data-resource="${key}" data-delta="1" aria-label="Increase ${escapeHtml(
          label,
        )}">+</button>
      `
      : `
        <button class="use-resource" type="button" data-action="resource" data-resource="${key}" data-delta="-1" aria-label="Use 1 ${escapeHtml(
          label,
        )}" ${pool.current <= 0 ? "disabled" : ""}>Use</button>
      `;

  return `
    <div class="resource">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${pool.current} / ${pool.max}</span>
      </div>
      ${showControls ? `<div class="stepper" aria-label="${escapeHtml(label)} controls">${controls}</div>` : ""}
    </div>
  `;
}
