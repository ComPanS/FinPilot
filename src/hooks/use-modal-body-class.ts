"use client";

import { useEffect } from "react";

const BODY_CLASS = "modal-open";

let modalCount = 0;

/**
 * Adds body.modal-open when mounted, removes when unmounted.
 * Supports multiple stacked modals via ref count.
 * Used so CSS can disable pointer-events on Driver.js overlay when modals are open.
 */
export function useModalBodyClass() {
  useEffect(() => {
    modalCount++;
    document.body.classList.add(BODY_CLASS);
    return () => {
      modalCount--;
      if (modalCount <= 0) {
        modalCount = 0;
        document.body.classList.remove(BODY_CLASS);
      }
    };
  }, []);
}
