"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { switchProfileAction } from "@/app/actions/profiles";

type Profile = { id: string; name: string; currency: string };

export function ProfileSwitcher({
  profiles,
  activeProfileId,
}: {
  profiles: Profile[];
  activeProfileId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function handleSwitch(profileId: string) {
    const res = await switchProfileAction(profileId);
    if (res?.error) {
      alert(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!profiles.length) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface/80"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="max-w-[140px] truncate">{activeProfile?.name ?? "Профиль"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-surface py-1 shadow-lg"
          role="listbox"
        >
          <Link
            href="/profiles/new"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Добавить профиль
          </Link>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === activeProfileId}
              onClick={() => handleSwitch(p.id)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary/5 ${
                p.id === activeProfileId ? "bg-primary/5 text-primary" : "text-foreground"
              }`}
            >
              <span className="truncate">{p.name}</span>
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">{p.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
