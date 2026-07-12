import { ROLE_LABELS } from "@repo/shared";
import {
  Link,
  Outlet,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import {
  FilePlus2,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LoginScreen } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createRootRoute({ component: RootLayout });

type NavItem = { to: string; label: string; icon: LucideIcon };

function RootLayout() {
  const { user, isLoading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen p-8">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  // No session: render the login screen in place. Navigating to a /login route
  // from here would be a state update during render, which React rejects.
  if (!user) {
    return (
      <div className="bg-background text-foreground min-h-screen">
        <LoginScreen />
      </div>
    );
  }

  // A Reporter's world is their own cases; a Manager and Auditor see the queue.
  const nav: NavItem[] =
    user.role === "Reporter"
      ? [
          { to: "/", label: "Dashboard", icon: LayoutDashboard },
          { to: "/cases", label: "My Cases", icon: FolderOpen },
        ]
      : [
          { to: "/", label: "Dashboard", icon: LayoutDashboard },
          { to: "/cases", label: "Cases", icon: FolderOpen },
        ];

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <aside className="hidden w-52 shrink-0 flex-col border-r p-3 md:flex">
        <div className="flex items-center gap-2 px-2 py-2">
          <ShieldCheck className="size-5" />
          <span className="font-heading font-semibold">Compliance</span>
        </div>

        <nav className="mt-3 flex flex-col gap-1">
          {nav.map((item) => (
            <SidebarLink key={item.to} item={item} pathname={pathname} />
          ))}
        </nav>

        {user.role === "Reporter" && (
          // Base UI merges into the element given to `render`, rather than
          // Radix's asChild.
          <Button className="mt-4" render={<Link to="/cases/new" />}>
            <FilePlus2 />
            Report a Case
          </Button>
        )}

        <div className="mt-auto border-t pt-3">
          <div className="px-2 text-sm font-medium">{user.name}</div>
          <div className="text-muted-foreground px-2 text-xs">
            {ROLE_LABELS[user.role]}
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-4 md:px-6">
        <Outlet />
      </main>

      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  );
}

function SidebarLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const active =
    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50",
      )}
    >
      <item.icon className="size-4" />
      {item.label}
    </Link>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();

  // Clearing the session is enough: the layout swaps in the login screen.
  return (
    <Button
      variant="ghost"
      size="sm"
      className="mt-2 w-full justify-start"
      onClick={signOut}
    >
      <LogOut />
      Sign out
    </Button>
  );
}
