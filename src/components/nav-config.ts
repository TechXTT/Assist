import {
  CalendarRange,
  HeartPulse,
  LayoutDashboard,
  ListTodo,
  Settings,
  Sun,
  Wallet,
  type LucideIcon
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary: boolean; // shown in mobile bottom tab bar
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { href: "/tasks", label: "Tasks", icon: ListTodo, primary: true },
  { href: "/money", label: "Money", icon: Wallet, primary: true },
  { href: "/health", label: "Health", icon: HeartPulse, primary: true },
  { href: "/briefing", label: "Briefing", icon: Sun, primary: true },
  { href: "/review", label: "Review", icon: CalendarRange, primary: false },
  { href: "/settings", label: "Settings", icon: Settings, primary: false }
];

export const primaryNav = navItems.filter((i) => i.primary);
export const secondaryNav = navItems.filter((i) => !i.primary);
