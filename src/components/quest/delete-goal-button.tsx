"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/quest/submit-button";
import { deleteGoal } from "@/lib/goals/actions";

export function DeleteGoalButton({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={`Supprimer la quête ${goalTitle}`}
      >
        <Trash2 className="text-destructive" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer cette quête ?</DialogTitle>
          <DialogDescription>
            Tu es sur le point de supprimer « {goalTitle} ». Ses tests, rapports et programme de
            6 semaines associés seront définitivement perdus. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <form action={deleteGoal}>
            <input type="hidden" name="goalId" value={goalId} />
            <SubmitButton size="sm" variant="destructive" pendingText="Suppression..." className="w-full">
              Supprimer définitivement
            </SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
