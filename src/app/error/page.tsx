import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Un problème est survenu</h1>
      <p className="text-muted-foreground">
        Le lien utilisé est invalide ou a expiré.
      </p>
      <Button render={<Link href="/login" />} nativeButton={false}>
        Retour à la connexion
      </Button>
    </div>
  );
}
