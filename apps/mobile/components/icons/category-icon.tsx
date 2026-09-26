import {
  Bath,
  Beef,
  Carrot,
  Croissant,
  CupSoda,
  type LucideIcon,
  Milk,
  Package,
  Snowflake,
  SprayCan,
  Wheat,
} from "lucide-react-native";

import type { CategoryKey } from "@/lib/types";

const CATEGORY_ICONS: Record<CategoryKey, LucideIcon> = {
  hortifruti: Carrot,
  laticinios: Milk,
  mercearia: Wheat,
  bebidas: CupSoda,
  carnes: Beef,
  padaria: Croissant,
  congelados: Snowflake,
  limpeza: SprayCan,
  higiene: Bath,
  outros: Package,
};

export interface CategoryIconProps {
  category: CategoryKey;
  size?: number;
  color?: string;
}

export function CategoryIcon({ category, size = 20, color }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} color={color} strokeWidth={2} />;
}
