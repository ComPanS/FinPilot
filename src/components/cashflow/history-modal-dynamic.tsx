"use client";

import dynamic from "next/dynamic";

export const HistoryModal = dynamic(
  () => import("./history-modal").then((m) => m.HistoryModal),
  { ssr: false }
);
