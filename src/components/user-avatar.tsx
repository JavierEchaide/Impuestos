import { cn } from "@/lib/utils";

/** Avatar con la inicial y el color de la persona. */
export function UserAvatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-[#1d2021] select-none",
        size === "sm" && "size-7 text-xs",
        size === "md" && "size-9 text-sm",
        size === "lg" && "size-14 text-xl",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initial}
    </span>
  );
}
