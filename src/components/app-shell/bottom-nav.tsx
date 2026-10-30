"use client";

import { Activity, Home, Layers, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Inicio", icon: Home, match: (p: string) => p === "/" },
  { href: "/secciones", label: "Secciones", icon: Layers, match: (p: string) => p.startsWith("/secciones") },
  { href: "/actividad", label: "Actividad", icon: Activity, match: (p: string) => p.startsWith("/actividad") },
  { href: "/ajustes", label: "Ajustes", icon: Settings, match: (p: string) => p.startsWith("/ajustes") || p.startsWith("/admin") },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  const renderItem = (item: (typeof ITEMS)[number]) => {
    const active = item.match(pathname);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-xl items-center px-2">
        {left.map(renderItem)}
        <Link
          href="/gastos/nuevo"
          aria-label="Añadir gasto"
          className="-mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
        >
          <Plus className="size-7" />
        </Link>
        {right.map(renderItem)}
      </div>
    </nav>
  );
}
