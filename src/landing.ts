import "../public-config.js";

declare global {
  interface Window {
    RUNGUIDE_CONFIG?: { wishlistEndpoint?: string };
  }
}

const endpoint = window.RUNGUIDE_CONFIG?.wishlistEndpoint?.trim() ?? "";
const form = document.querySelector<HTMLFormElement>("#wishlist-form");
const status = document.querySelector<HTMLParagraphElement>("#form-status");
const submitButton = form?.querySelector<HTMLButtonElement>(
  'button[type="submit"]',
);
const controls = form?.querySelector<HTMLFieldSetElement>("fieldset");
let submitting = false;

function setStatus(
  message: string,
  state: "error" | "success" | "pending" | "unavailable",
) {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function validEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

if (!validEndpoint(endpoint)) {
  setStatus(
    "Přihlášky právě připravujeme. Zkus to prosím později.",
    "unavailable",
  );
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Přihlášky brzy otevřeme";
  }
  if (controls) controls.disabled = true;
} else if (submitButton && controls) {
  controls.disabled = false;
  submitButton.disabled = false;
  submitButton.textContent = "Chci na wishlist →";
  if (status) status.textContent = "";
}

form?.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();
  if (submitting || !validEndpoint(endpoint) || !submitButton || !controls)
    return;
  for (const field of form.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >('input:not([type="checkbox"]), textarea')) {
    field.value = field.value.trim();
  }
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  if (data.get("website")) {
    setStatus(
      "Žádost se nepodařilo odeslat. Obnov stránku a zkus to znovu.",
      "error",
    );
    return;
  }
  const payload = Object.fromEntries(data.entries());
  payload.consent = data.get("consent") === "on" ? "Ano" : "Ne";
  submitting = true;
  controls.disabled = true;
  submitButton.disabled = true;
  submitButton.textContent = "Odesílám…";
  form.setAttribute("aria-busy", "true");
  setStatus("Ukládáme tvoji přihlášku…", "pending");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok || response.type === "opaque")
      throw new Error("Unconfirmed response");
    const result: unknown = await response.json();
    if (
      typeof result !== "object" ||
      result === null ||
      !("ok" in result) ||
      result.ok !== true ||
      !("status" in result) ||
      result.status !== "received"
    ) {
      throw new Error("Unconfirmed write");
    }
    form.reset();
    setStatus(
      "Díky! Tvoji přihlášku evidujeme. Pokud tě vybereme do testu, ozveme se e-mailem.",
      "success",
    );
  } catch {
    setStatus(
      "Uložení se nepodařilo potvrdit. Údaje zůstaly vyplněné. Zkus odeslání znovu; stejný e-mail se neuloží dvakrát.",
      "error",
    );
  } finally {
    window.clearTimeout(timer);
    submitting = false;
    controls.disabled = false;
    submitButton.disabled = false;
    submitButton.textContent = "Chci na wishlist →";
    form.removeAttribute("aria-busy");
  }
});
