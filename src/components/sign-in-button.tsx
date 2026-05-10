"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignInButton({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  return (
    <Button size="lg" onClick={() => signIn("google", { callbackUrl })}>
      Continue with Google
    </Button>
  );
}
