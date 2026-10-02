import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, BookOpen, Users, UserCog, Truck, CreditCard, Search, FileText, Settings, Receipt, BarChart3, Layers, Bell, Menu, X, Plane,
} from "lucide-react";
import { useEffect, useState } from "react";

const sections = [
  { title: "Overview", items: [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/alerts", icon: Bell, label: "Alerts" },
    { to: "/search", icon: Search, label: "Search" },
  ]},
  { title: "Operations", items: [
    { to: "/bookings", icon: BookOpen, label: "Bookings" },
    { to: "/groups", icon: Layers, label: "Groups" },
    { to: "/clients", icon: Users, label: "Clients" },
    { to: "/agents", icon: UserCog, label: "Agents" },
    { to: "/suppliers", icon: Truck, label: "Suppliers" },
  ]},
  { title: "Finance", items: [
    { to: "/payments", icon: CreditCard, label: "Payments" },
    { to: "/entries", icon: FileText, label: "Entries" },
    { to: "/expenses", icon: Receipt, label: "Expenses" },
    { to: "/reports", icon: BarChart3, label: "Financial Reports" },
  ]},
  { title: "System", items: [
    { to: "/settings", icon: Settings, label: "Settings" },
  ]},
] as const;

export default function AppSidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
            <Plane className="h-4 w-4 text-primary" />
          </div>
          <span className="font-display text-base text-foreground">Avery Travel</span>
        </div>
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md border border-border p-2 text-foreground">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
            <Plane className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-display text-[15px] leading-tight text-foreground">Avery Travel</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Operations Suite</p>
          </div>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-muted-foreground md:hidden"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((s) => (
            <div key={s.title} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">{s.title}</p>
              <div className="space-y-0.5">
                {s.items.map((item) => {
                  const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
                  return (
                    <Link key={item.to} to={item.to}
                      className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}
                    >
                      {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-primary" />}
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Umrah · Hajj · Tours · Visa
        </div>
      </aside>
    </>
  );
}
