import {
  Bus,
  HandCoins,
  House,
  Landmark,
  Package,
  PartyPopper,
  Plane,
  Utensils,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  comida: Utensils,
  casa: House,
  viaje: Plane,
  ocio: PartyPopper,
  transporte: Bus,
  otros: Package,
  deuda_inicial: Landmark,
  pago: HandCoins,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICONS[category] ?? Package;
  return <Icon className={className} aria-hidden />;
}
