import { escapeHtml } from "./dom";

const DESCRIPTION_HEADINGS = [
  "VITAL SURGE",
  "ENTROPIC SURGE",
  "SPECIAL PROPERTY",
  "PASSIVE EFFECTS",
  "MAGICAL STABILITY SENSE",
  "STABILIZING PRESENCE",
  "SOLAR RETRIBUTION",
  "BLAZING CHALLENGE",
  "LIGHT OF RECOVERY",
  "SENSE MALICE",
  "CONSECUTIVE HITS",
  "PORTABLE SMITHY",
  "ORE SENSE",
  "RESONANCE DETONATION",
  "ONCE PER LONG REST",
  "SHADOW RESONANCE",
  "SPREADING TWILIGHT",
  "SPECIAL PROPERTIES",
  "PRIMARY TARGET",
  "SECONDARY TARGETS",
  "SHADOW COMMUNION",
  "DETACHED SHADOW",
  "SHADOW'S GREED",
  "DEFENDING WILL",
  "IMPENETRABLE ADVANCE",
  "GUIDED ARROW",
  "INTERCESSION",
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formattedDescription(description: string): string {
  const headingPattern = new RegExp(`\\b(${DESCRIPTION_HEADINGS.map(escapeRegex).join("|")})(\\s*[-:]\\s*)`, "g");
  const sections: Array<{ title?: string; body: string }> = [];
  let currentTitle: string | undefined;
  let lastIndex = 0;

  for (const match of description.matchAll(headingPattern)) {
    const body = description.slice(lastIndex, match.index).trim();
    if (body || currentTitle) {
      sections.push({ title: currentTitle, body });
    }
    currentTitle = match[1];
    lastIndex = match.index + match[0].length;
  }

  const finalBody = description.slice(lastIndex).trim();
  if (finalBody || currentTitle) {
    sections.push({ title: currentTitle, body: finalBody });
  }

  if (sections.length <= 1 && !sections[0]?.title) {
    return `<p>${escapeHtml(description)}</p>`;
  }

  return `<div class="library-description">${sections
    .map(
      (section) => `
        <section class="${section.title ? "description-section" : "description-intro"}">
          ${section.title ? `<h5>${escapeHtml(section.title)}</h5>` : ""}
          ${section.body ? `<p>${escapeHtml(section.body)}</p>` : ""}
        </section>
      `,
    )
    .join("")}</div>`;
}
