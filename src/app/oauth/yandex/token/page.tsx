"use client";

import { useEffect } from "react";

const closeDelayMs = 500;

export default function YandexSuggestTokenPage() {
  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    const targetOrigin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    const targets = new Set<Window | null>();
    if (window.opener) targets.add(window.opener);
    if (window.opener?.parent) targets.add(window.opener.parent);
    if (window.opener?.top) targets.add(window.opener.top);

    const post = (payload: unknown) => {
      targets.forEach((target) => {
        if (target) {
          target.postMessage(payload, targetOrigin);
        }
      });
    };

    if (token) {
      post({ type: "yandex_token", token });
      setTimeout(() => window.close(), closeDelayMs);
    } else if (error) {
      post({ type: "yandex_token_error", error: errorDescription || error });
      setTimeout(() => window.close(), closeDelayMs);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Обработка входа...</p>
    </div>
  );
}
