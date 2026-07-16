"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Le contenu (question, rapport, plan) est généré par un worker qui tourne sur la
// machine de l'utilisateur, sans limite de temps — contrairement à Vercel. Cette
// page se contente de re-vérifier périodiquement si le résultat est arrivé en base.
export function PollUntilReady({
  message,
  intervalMs = 4000,
}: {
  message: string;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 p-8 text-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          <p className="font-heading text-lg font-medium">{message}</p>
          <p className="text-sm text-muted-foreground">
            Ça peut prendre une à quelques minutes. Cette page se met à jour toute seule.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
