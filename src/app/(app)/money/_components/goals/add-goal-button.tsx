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
import { GoalForm } from "@/app/(app)/money/_components/goals/goal-form";

export function AddGoalButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New savings goal</DialogTitle>
          <DialogDescription>What are you chipping away at?</DialogDescription>
        </DialogHeader>
        <GoalForm mode="create" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
