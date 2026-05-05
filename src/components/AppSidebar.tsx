import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard, BookOpen, Users, UserCog, Truck, CreditCard, Search, FileText, Settings, ChevronLeft, ChevronRight, Receipt, BarChart3,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/bookings", icon: BookOpen, label: "Bookings" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/agents", icon: UserCog, label: "Agents" },
  { to: "/suppliers", icon: Truck, label: "Suppliers" },
  { to: "/payments", icon: CreditCard, label: "Payments" },
  { to: "/entries", icon: FileText, label: "Entries" },
  { to: "/expenses", icon: Receipt, label: "Expenses" },
  { to: "/reports", icon: BarChart3, label: "Financial Reports" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export default function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar"
    >
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">AV</span>
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
            <p className="text-sm font-semibold text-foreground">AV Travel</p>
            <p className="text-[10px] text-muted-foreground">Enterprise CRM</p>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
          return (
            <Link key={item.to} to={item.to}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && (
                <motion.div layoutId="sidebar-indicator" className="absolute left-0 h-8 w-[3px] rounded-r-full bg-primary" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
