import { ResourcePool } from "../../data/schema";
import { escapeHtml } from "../dom";

export function resourceCounter(label: string, pool: ResourcePool, key: string): string {
  return `
    <div class="resource">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${pool.current} / ${pool.max}</span>
      </div>
      <div class="stepper" aria-label="${escapeHtml(label)} controls">
        <button type="button" data-action="resource" data-resource="${key}" data-delta="-1" aria-label="Decrease ${escapeHtml(
          label,
        )}">-</button>
        <button type="button" data-action="resource" data-resource="${key}" data-delta="1" aria-label="Increase ${escapeHtml(
          label,
        )}">+</button>
      </div>
    </div>
  `;
}
