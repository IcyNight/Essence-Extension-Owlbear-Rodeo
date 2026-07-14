import { escapeHtml } from "../dom";

export function accordion(id: string, title: string, summary: string, body: string, open = false): string {
  return `
    <details class="accordion" ${open ? "open" : ""} data-accordion-id="${escapeHtml(id)}">
      <summary>
        <span>${escapeHtml(title)}</span>
        ${summary ? `<small>${escapeHtml(summary)}</small>` : ""}
      </summary>
      <div class="accordion-body">${body}</div>
    </details>
  `;
}
