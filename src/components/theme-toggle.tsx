"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};

/** Alterna entre el tema oscuro (por defecto) y el claro de Gruvbox. */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <Button
      type="button"
      variant={withLabel ? "outline" : "ghost"}
      size={withLabel ? "default" : "icon"}
      className={withLabel ? "w-full justify-start" : undefined}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      {isDark ? <Sun /> : <Moon />}
      {withLabel ? <span>{isDark ? "Tema claro" : "Tema oscuro"}</span> : null}
    </Button>
  );
}
