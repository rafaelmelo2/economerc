import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LuBox, LuPencil, LuPlus } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { type DataListColumn, DataList } from "@/components/ui/data-list";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListToolbar } from "@/components/ui/list-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import {
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  type Product,
  type ProductUpsertPayload,
} from "@/lib/api/admin";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: AdminProdutosPage,
});

const PRODUCT_UNITS: Product["unit"][] = ["un", "kg", "g", "l", "ml"];

interface ProductFormState {
  name: string;
  ean: string;
  brand: string;
  categoryId: string;
  unit: Product["unit"];
}

const EMPTY_FORM: ProductFormState = { name: "", ean: "", brand: "", categoryId: "", unit: "un" };

function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}) {
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [form, setForm] = useState<ProductFormState>(
    product
      ? {
          name: product.name,
          ean: product.ean ?? "",
          brand: product.brand ?? "",
          categoryId: product.categoryId ?? "",
          unit: product.unit,
        }
      : EMPTY_FORM,
  );

  const isPending = createProduct.isPending || updateProduct.isPending;

  const handleSubmit = () => {
    const payload: ProductUpsertPayload = {
      name: form.name,
      ean: form.ean || null,
      brand: form.brand || null,
      categoryId: form.categoryId || null,
      unit: form.unit,
    };
    const onSuccess = () => onOpenChange(false);
    if (product) {
      updateProduct.mutate({ id: product.id, payload }, { onSuccess });
    } else {
      createProduct.mutate(payload, { onSuccess });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setForm(product ? { name: product.name, ean: product.ean ?? "", brand: product.brand ?? "", categoryId: product.categoryId ?? "", unit: product.unit } : EMPTY_FORM);
      }}
      title={product ? "Editar produto" : "Novo produto"}
      size="sm"
      footer={
        <Button onClick={handleSubmit} disabled={isPending || form.name.trim().length === 0}>
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-name">Nome</Label>
          <Input
            id="product-name"
            value={form.name}
            onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-ean">Código de barras (EAN)</Label>
          <Input
            id="product-ean"
            value={form.ean}
            onChange={(event) => setForm((f) => ({ ...f, ean: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-brand">Marca</Label>
          <Input
            id="product-brand"
            value={form.brand}
            onChange={(event) => setForm((f) => ({ ...f, brand: event.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.categoryId || undefined}
              onValueChange={(next) => setForm((f) => ({ ...f, categoryId: next }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Unidade</Label>
            <Select value={form.unit} onValueChange={(next) => setForm((f) => ({ ...f, unit: next as Product["unit"] }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </FormDialog>
  );
}

function AdminProdutosPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const list = useInfiniteList<Product>("/api/products", { search: search.q });

  const columns: DataListColumn<Product>[] = [
    { id: "name", header: "Nome", role: "primary", cell: (p) => p.name },
    { id: "ean", header: "EAN", role: "secondary", cell: (p) => p.ean ?? "—" },
    { id: "unit", header: "Unidade", cell: (p) => p.unit },
    { id: "brand", header: "Marca", cell: (p) => p.brand ?? "—" },
  ];

  if (list.total === 0 && !list.isLoading && !search.q) {
    return (
      <div className="flex flex-col gap-4">
        <ListToolbar
          actions={
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <LuPlus /> Novo produto
            </Button>
          }
        />
        <EmptyState
          icon={LuBox}
          title="Nenhum produto para moderar"
          description="Produtos cadastrados pelo app, por NFC-e ou pela comunidade aparecem aqui para revisão — nome, categoria e código de barras."
        />
        <ProductFormDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        search={search.q}
        onSearchChange={(next) => void navigate({ search: { q: next } })}
        searchPlaceholder="Buscar por nome ou EAN…"
        actions={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <LuPlus /> Novo produto
          </Button>
        }
      />
      <DataList
        items={list.items}
        columns={columns}
        getRowId={(p) => p.id}
        actions={[
          {
            id: "edit",
            label: "Editar",
            icon: LuPencil,
            onSelect: (product) => {
              setEditing(product);
              setDialogOpen(true);
            },
          },
        ]}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        isFetchingNextPage={list.isFetchingNextPage}
        hasNextPage={list.hasNextPage}
        fetchNextPage={() => void list.fetchNextPage()}
        total={list.total}
        emptyTitle="Nenhum produto encontrado"
      />
      <ProductFormDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} />
    </div>
  );
}
