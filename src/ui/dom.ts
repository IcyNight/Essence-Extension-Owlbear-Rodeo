export function qs<T extends HTMLElement>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function numberValue(form: FormData, key: string): number {
  return Math.max(0, Math.floor(Number(form.get(key) ?? 0)));
}

export function textValue(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export function bindSubmit(root: HTMLElement, selector: string, handler: (form: HTMLFormElement) => void): void {
  root.querySelectorAll<HTMLFormElement>(selector).forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handler(form);
    });
  });
}

export function bindClick(root: HTMLElement, selector: string, handler: (button: HTMLButtonElement) => void): void {
  root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    button.addEventListener("click", () => handler(button));
  });
}
