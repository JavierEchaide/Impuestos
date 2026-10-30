"use client";

import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

/** Avisos con los colores de Gruvbox (siguen el tema activo). */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="top-center"
      closeButton
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          success: "border-success/60!",
          error: "border-destructive/70!",
        },
      }}
    />
  );
}
