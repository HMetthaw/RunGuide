type Page = "overview" | "history" | "start" | "profile" | "menu";
type Step = "route" | "goal" | "run";
const pages: Page[] = ["overview", "history", "start", "profile", "menu"];

export function setupAppNavigation(
  resizeMap: () => void,
  isRunning: () => boolean,
) {
  function render() {
    const hash = location.hash.slice(1);
    let page: Page = pages.includes(hash as Page) ? (hash as Page) : "overview";
    let step: Step = "route";
    if (["goal", "run", "planner", "run-panel"].includes(hash)) page = "start";
    if (hash === "account") page = "menu";
    if (hash === "goal") step = "goal";
    if (
      ["run", "run-panel"].includes(hash) ||
      (hash === "start" && isRunning())
    )
      step = "run";
    const dialog = document.getElementById("map-dialog") as HTMLDialogElement;
    if (dialog.open) dialog.close();
    document
      .querySelectorAll<HTMLElement>(".app-page[data-page]")
      .forEach((view) => {
        view.hidden = view.dataset.page !== page;
      });
    document
      .querySelectorAll<HTMLElement>("[data-start-step]")
      .forEach((view) => {
        view.hidden = view.dataset.startStep !== step;
      });
    document
      .querySelectorAll<HTMLAnchorElement>("[data-nav]")
      .forEach((link) => {
        if (link.dataset.nav === page)
          link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    document
      .querySelectorAll<HTMLAnchorElement>("[data-step-link]")
      .forEach((link) => {
        if (link.dataset.stepLink === step)
          link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
      });
    document.body.dataset.page = page;
    document.body.dataset.step = step;
    if (page === "start" && step === "route") resizeMap();
    const heading = document.querySelector<HTMLElement>(
      `.app-page[data-page="${page}"] [data-page-title]`,
    );
    heading?.focus({ preventScroll: true });
    document.getElementById("main")?.scrollIntoView?.({ block: "start" });
  }
  function navigate(hash: string) {
    if (location.hash !== `#${hash}`) history.pushState(null, "", `#${hash}`);
    render();
  }
  document.addEventListener("click", (event) => {
    if (
      !(event.target instanceof Element) ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.target.closest<HTMLAnchorElement>("a[data-route]");
    if (!link) return;
    event.preventDefault();
    navigate(link.hash.slice(1));
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", render);
  render();
  return { navigate };
}
