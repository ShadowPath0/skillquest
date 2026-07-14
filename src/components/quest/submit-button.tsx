"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText,
  size = "lg",
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size={size} disabled={pending} className={className}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
