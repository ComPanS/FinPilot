"use client";

import { useState } from "react";
import { cancelSubscriptionAction } from "@/app/actions/billing";
import { formatDateShortMSK } from "@/lib/date-utils";

export function CancelSubscriptionButton({
  userId,
  currentPeriodEnd,
  className = "",
}: {
  userId: string;
  currentPeriodEnd?: Date | null;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setLoading(true);
    cancelSubscriptionAction(userId).then((res) => {
      setLoading(false);
      setConfirming(false);
      if (res?.error) {
        alert(res.error);
      } else {
        window.location.reload();
      }
    });
  };

  return (
    <div className={className}>
      {!confirming ? (
        <button
          type="button"
          onClick={handleClick}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          Отменить подписку
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Подписка будет действовать до {currentPeriodEnd ? formatDateShortMSK(new Date(currentPeriodEnd)) : "—"}. Деньги не возвращаются.
          </span>
          <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="rounded bg-destructive/90 px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive disabled:opacity-50"
          >
            {loading ? "..." : "Подтвердить отмену"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="text-sm text-muted-foreground underline hover:text-foreground disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
