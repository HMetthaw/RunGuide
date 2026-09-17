import { registerSW } from "virtual:pwa-register";

export function registerApp(onUpdate: (apply: () => Promise<void>) => void) {
  if (!import.meta.env.PROD) return;
  const update = registerSW({
    immediate: true,
    onNeedRefresh: () => onUpdate(() => update(true)),
    onRegisterError: () => {
      document
        .querySelector("#offline-status")
        ?.replaceChildren(
          "Offline režim se nepodařilo připravit. Připoj se a obnov stránku.",
        );
    },
  });
}
