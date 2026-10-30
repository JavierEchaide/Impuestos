import Link from "next/link";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Logo className="size-8" />
          <span>Cuentas Claras</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/ajustes" aria-label="Ajustes y perfil">
            <UserAvatar name={user.name} color={user.color} size="md" />
          </Link>
        </div>
      </header>
      <main className="flex flex-col gap-5 px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
