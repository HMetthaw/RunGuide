// Presentation-only controls. Native dialog supplies focus containment and Escape.
export function setupPlannerInterface(resizeMap: () => void) {
  const stage = document.getElementById("map-stage")!;
  const parent = stage.parentElement!;
  const dialog = document.getElementById("map-dialog") as HTMLDialogElement;
  const toggle = document.getElementById("expand-map") as HTMLButtonElement;
  const label = document.getElementById("expand-map-label")!;
  function expanded(value: boolean) {
    stage.classList.toggle("is-expanded", value);
    document.body.classList.toggle("map-expanded", value);
    toggle.setAttribute("aria-expanded", String(value));
    label.textContent = value ? "Zavřít mapu" : "Zvětšit mapu";
    resizeMap();
  }
  toggle.addEventListener("click", () => {
    if (dialog.open) {
      dialog.close();
      return;
    }
    dialog.append(stage);
    dialog.showModal();
    expanded(true);
    toggle.focus();
  });
  dialog.addEventListener("close", () => {
    parent.append(stage);
    expanded(false);
    toggle.focus();
  });

  if ("IntersectionObserver" in window) {
    const sections = ["planner", "run-panel", "history", "account"];
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = sections.find((id) => visible.has(id));
        document
          .querySelectorAll<HTMLAnchorElement>(".mobile-nav a")
          .forEach((link) => {
            if (link.hash === `#${current}`)
              link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          });
      },
      { rootMargin: "-80px 0px -45% 0px", threshold: 0 },
    );
    for (const id of sections) observer.observe(document.getElementById(id)!);
  }
}
