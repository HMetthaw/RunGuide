/** A manual choice wins over the system and survives reloads when storage is available. */
export function setupTheme() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  const system = window.matchMedia?.("(prefers-color-scheme: dark)");
  let preference: string | null = null;
  try {
    preference = localStorage.getItem("runguide.theme");
  } catch {
    /* Private browsing may deny storage. */
  }
  if (preference !== "light" && preference !== "dark") preference = null;

  function apply() {
    const dark = preference ? preference === "dark" : !!system?.matches;
    const theme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    toggle!.setAttribute("aria-pressed", String(dark));
    toggle!.setAttribute(
      "title",
      dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim",
    );
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#101922" : "#172c45");
  }
  function change() {
    preference =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("runguide.theme", preference);
    } catch {
      /* Keep the choice for this session. */
    }
    apply();
  }
  apply();
  toggle.addEventListener("click", change);
  system?.addEventListener("change", apply);
  return () => {
    toggle.removeEventListener("click", change);
    system?.removeEventListener("change", apply);
  };
}
