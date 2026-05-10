"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNav } from "@/components/nav-config";

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden">
      <ul className="container flex items-stretch justify-between gap-1 px-2 py-1.5">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] transition-colors",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-foreground")} />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
