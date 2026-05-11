"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { Session } from "next-auth";

import { cn } from "@/lib/utils";
import { navItems, secondaryNav } from "@/components/nav-config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SignOutMenuItem } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

function initialsFromName(name?: string | null) {
  if (!name) return "u";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export function TopNav({ session }: { session: Session }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const userImage = session.user?.image ?? undefined;
  const userName = session.user?.name ?? "you";

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/85 backdrop-blur">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          assist
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Mobile "more" sheet (Review + Settings) */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className="rounded-md p-2 text-muted-foreground hover:bg-muted/60 md:hidden"
                aria-label="More"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted/60"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Avatar className="h-9 w-9">
                {userImage ? <AvatarImage src={userImage} alt={userName} /> : null}
                <AvatarFallback>{initialsFromName(userName).toLowerCase()}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                {session.user?.email ?? userName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <SignOutMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
