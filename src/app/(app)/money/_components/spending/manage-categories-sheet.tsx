"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Check, Pencil, Tags, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  archiveCategory,
  renameCategory,
  setCategoryColor,
  unarchiveCategory
} from "@/app/(app)/money/actions";
import {
  CATEGORY_COLORS,
  NewCategoryInline
} from "@/app/(app)/money/_components/spending/new-category-inline";
import type { CategoryRow } from "@/lib/money/category-queries";

export function ManageCategoriesSheet({ categories }: { categories: CategoryRow[] }) {
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const side = isDesktop ? "right" : "bottom";
  const sheetClass = isDesktop
    ? "w-full overflow-y-auto sm:max-w-md"
    : "max-h-[85dvh] overflow-y-auto rounded-t-xl";

  const visible = showArchived ? categories : categories.filter((c) => !c.archived);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Tags className="h-3.5 w-3.5" />
          Manage categories
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className={sheetClass}>
        <SheetHeader>
          <SheetTitle>Categories</SheetTitle>
          <SheetDescription>
            Rename, recolor, or archive. Archived categories stay tagged on past transactions.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {creating ? (
            <NewCategoryInline
              onCreated={() => setCreating(false)}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              + New category
            </Button>
          )}

          <ul className="space-y-1">
            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No categories yet. Create one above.
              </p>
            ) : (
              visible.map((c) => <CategoryItem key={c.id} category={c} />)
            )}
          </ul>

          {categories.some((c) => c.archived) && (
            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <label htmlFor="show-archived" className="cursor-pointer text-xs text-muted-foreground">
                Show archived
              </label>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CategoryItem({ category }: { category: CategoryRow }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [pending, start] = useTransition();
  const [pickingColor, setPickingColor] = useState(false);

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name) {
      setEditing(false);
      setName(category.name);
      return;
    }
    start(async () => {
      try {
        await renameCategory(category.id, { name: trimmed });
        toast.success("Renamed.");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't rename.");
        setName(category.name);
      }
    });
  }

  function changeColor(color: string) {
    start(async () => {
      try {
        await setCategoryColor(category.id, color);
        setPickingColor(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  function toggleArchive() {
    start(async () => {
      try {
        if (category.archived) {
          await unarchiveCategory(category.id);
          toast.success("Restored.");
        } else {
          await archiveCategory(category.id);
          toast.success("Archived — won't show in the picker.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5",
        category.archived && "opacity-60"
      )}
    >
      <button
        type="button"
        aria-label={`Change color for ${category.name}`}
        onClick={() => setPickingColor((v) => !v)}
        className="h-4 w-4 shrink-0 rounded-full border"
        style={{ backgroundColor: category.color }}
      />

      {pickingColor ? (
        <div className="flex flex-1 items-center gap-1.5">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => changeColor(c)}
              disabled={pending}
              className={cn(
                "h-5 w-5 rounded-full transition-all",
                c === category.color && "ring-2 ring-foreground ring-offset-2"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setPickingColor(false)}
            className="ml-auto h-7 w-7"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : editing ? (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setEditing(false);
              setName(category.name);
            }
          }}
          className="h-8 flex-1"
          autoFocus
          disabled={pending}
        />
      ) : (
        <>
          <span className="flex-1 truncate text-sm">{category.name}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setEditing(true)}
            disabled={pending}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            onClick={toggleArchive}
            disabled={pending}
            aria-label={category.archived ? "Restore" : "Archive"}
          >
            {category.archived ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </Button>
        </>
      )}

      {editing && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={commitRename}
          disabled={pending}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}
