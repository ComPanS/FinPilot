"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const YANDEX_AUTH_URL = "https://oauth.yandex.ru/authorize";

interface YandexIdButtonProps {
  callbackUrl?: string;
  onError?: (error: string) => void;
}

export function YandexIdButton({
  callbackUrl = "/dashboard",
  onError,
}: YandexIdButtonProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/yandex-config")
      .then((r) => r.json())
      .then((data: { clientId?: string | null }) =>
        setClientId(data.clientId ?? null),
      )
      .catch(() => setClientId(null));
  }, []);

  const handleYandexToken = useCallback(
    async (token: string) => {
      setError(null);
      const result = await signIn("credentials", {
        yandex_access_token: token,
        redirect: false,
      });
      if (result?.error) {
        const err = result.error;
        setError(err);
        onError?.(err);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    },
    [callbackUrl, onError, router],
  );

  const handleClick = useCallback(() => {
    if (!clientId) {
      setError("Яндекс OAuth не настроен");
      return;
    }

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "";
    const redirectUri = `${origin}/oauth/yandex/token`;

    const params = new URLSearchParams({
      response_type: "token",
      client_id: clientId,
      redirect_uri: redirectUri,
      force_confirm: "yes",
    });

    const url = `${YANDEX_AUTH_URL}?${params.toString()}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      url,
      "yandex_oauth",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
    );

    const handler = (event: MessageEvent) => {
      if (event.origin !== origin && event.origin !== window.location.origin)
        return;
      const data = event.data as {
        type?: string;
        token?: string;
        error?: string;
      };
      if (data?.type === "yandex_token" && data.token) {
        window.removeEventListener("message", handler);
        messageHandlerRef.current = null;
        handleYandexToken(data.token);
      } else if (data?.type === "yandex_token_error") {
        window.removeEventListener("message", handler);
        messageHandlerRef.current = null;
        const err = data.error || "Ошибка авторизации Яндекс";
        setError(err);
        onError?.(err);
      }
    };

    messageHandlerRef.current = handler;
    window.addEventListener("message", handler);
  }, [clientId, handleYandexToken, onError]);

  useEffect(() => {
    return () => {
      if (messageHandlerRef.current) {
        window.removeEventListener("message", messageHandlerRef.current);
      }
    };
  }, []);

  if (!clientId) return null;

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-medium transition-colors hover:bg-surface"
      >
        Войти через Яндекс
      </button>
      {error && !onError && (
        <p className="text-center text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
