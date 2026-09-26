import type { CityOption } from "@/lib/types";

// Lista mock — Catalão-GO pré-selecionada (foco de entrada do produto, ver docs/produto.md).
export const CITY_OPTIONS: readonly CityOption[] = [
  { slug: "catalao-go", name: "Catalão", state: "GO" },
  { slug: "goiania-go", name: "Goiânia", state: "GO" },
  { slug: "uberlandia-mg", name: "Uberlândia", state: "MG" },
  { slug: "rio-verde-go", name: "Rio Verde", state: "GO" },
  { slug: "araguari-mg", name: "Araguari", state: "MG" },
];

export const DEFAULT_CITY_SLUG = "catalao-go";
