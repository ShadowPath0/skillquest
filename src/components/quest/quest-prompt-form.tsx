"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/quest/submit-button";

const INSPIRATIONS = [
  "Sommellerie",
  "Développement React",
  "Négociation commerciale",
  "Photographie culinaire",
  "Entretien Data Scientist",
  "Anglais professionnel",
];

export function QuestPromptForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4">
      <Textarea
        name="prompt"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ex. Je veux devenir développeur React, préparer un entretien Data Scientist, maîtriser Excel..."
        rows={4}
        required
      />
      <div className="flex flex-wrap gap-2">
        {INSPIRATIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setValue(suggestion)}
            className="rounded-full border border-primary/30 bg-muted/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <SubmitButton pendingText="L'Oracle consulte les astres...">
        Consulter l&apos;Oracle
      </SubmitButton>
    </form>
  );
}
