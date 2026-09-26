import type { CartItem } from "@/lib/types";

// Carrinho mock — a compra real (SQLite + sync) chega na onda 3B. Aqui só a casca visual.
export const MOCK_CART_ITEMS: readonly CartItem[] = [
  {
    id: "item-1",
    name: "Café Pilão 500 g",
    category: "mercearia",
    quantityLabel: "1 un",
    unitPriceCents: 3780,
    unitLabel: "kg",
    totalCents: 1890,
    isOffer: false,
  },
  {
    id: "item-2",
    name: "Leite integral 1 L",
    category: "laticinios",
    quantityLabel: "6 un",
    unitPriceCents: 449,
    unitLabel: "L",
    totalCents: 2694,
    isOffer: true,
  },
  {
    id: "item-3",
    name: "Arroz branco 5 kg",
    category: "mercearia",
    quantityLabel: "1 un",
    unitPriceCents: 558,
    unitLabel: "kg",
    totalCents: 2790,
    isOffer: false,
  },
  {
    id: "item-4",
    name: "Tomate salada",
    category: "hortifruti",
    quantityLabel: "1,4 kg",
    unitPriceCents: 799,
    unitLabel: "kg",
    totalCents: 1119,
    isOffer: false,
  },
  {
    id: "item-5",
    name: "Peito de frango",
    category: "carnes",
    quantityLabel: "2,1 kg",
    unitPriceCents: 1499,
    unitLabel: "kg",
    totalCents: 3148,
    isOffer: false,
  },
  {
    id: "item-6",
    name: "Detergente neutro 500 ml",
    category: "limpeza",
    quantityLabel: "2 un",
    unitPriceCents: 598,
    unitLabel: "L",
    totalCents: 598,
    isOffer: false,
  },
];

export const MOCK_MARKET_NAME = "Bom Preço";
