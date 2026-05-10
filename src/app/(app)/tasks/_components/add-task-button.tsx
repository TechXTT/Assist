"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { TaskForm } from "@/app/(app)/tasks/_components/task-form";

export function AddTaskButton({ variant = "default" }: { variant?: "default" | "ghost" }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>What's on your plate?</DialogDescription>
        </DialogHeader>
        <TaskForm mode="create" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
