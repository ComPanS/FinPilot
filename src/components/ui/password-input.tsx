"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

type PasswordInputProps = React.ComponentProps<"input"> & {
  className?: string;
};

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={className ?? inputClassName}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={show ? "Скрыть пароль" : "Показать пароль"}
      >
        {show ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
