import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LuBox,
  LuChevronsUpDown,
  LuDollarSign,
  LuFileWarning,
  LuHistory,
  LuListChecks,
  LuLogOut,
  LuStore,
  LuTag,
} from "react-icons/lu";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

// Config de nav tipada e greppável — um lugar só pra editar (ver skill app-scaffold).
const NAV_ITEMS = [
  { to: "/historico", label: "Histórico", icon: LuHistory },
  { to: "/ofertas", label: "Ofertas", icon: LuTag },
] as const;

const ADMIN_NAV_ITEMS = [
  { to: "/admin/produtos", label: "Produtos", icon: LuBox },
  { to: "/admin/mercados", label: "Mercados", icon: LuStore },
  { to: "/admin/precos", label: "Preços", icon: LuDollarSign },
  { to: "/admin/notas", label: "Notas com falha", icon: LuFileWarning },
  { to: "/admin/fila-ofertas", label: "Fila de ofertas", icon: LuListChecks },
] as const;

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppSidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/historico" onClick={handleNavigate}>
                <img src="/simbolo.svg" alt="" className="size-8 shrink-0" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-display text-base font-bold">EconoMerc</span>
                  <span className="truncate text-xs text-muted-foreground">Resumo</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={label}
                    isActive={pathname === to || pathname.startsWith(`${to}/`)}
                  >
                    <Link to={to} onClick={handleNavigate}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={label}
                    isActive={pathname === to || pathname.startsWith(`${to}/`)}
                  >
                    <Link to={to} onClick={handleNavigate}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {user ? initials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name ?? "Visitante"}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? ""}
                    </span>
                  </div>
                  <LuChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                className="min-w-56 rounded-lg"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name ?? "Visitante"}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? ""}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LuLogOut />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
