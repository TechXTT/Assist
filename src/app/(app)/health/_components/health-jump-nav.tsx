"use client";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "exercise", label: "Exercise" },
  { id: "sleep", label: "Sleep" },
  { id: "nutrition", label: "Nutrition" },
  { id: "mood", label: "Mood" }
];

export function HealthJumpNav() {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 z-10 -mx-1 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <ul className="flex w-max gap-1 md:w-full md:gap-2">
        {SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              className={cn(
                "inline-flex rounded-md border border-transparent bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
