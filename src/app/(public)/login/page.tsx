import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/sign-in-button";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">assist</h1>
          <p className="text-sm text-muted-foreground">
            Your friendly personal-life dashboard. Sign in to get started.
          </p>
        </div>
        <SignInButton />
        <p className="text-xs text-muted-foreground">
          Only the configured Google account can sign in.
        </p>
      </div>
    </main>
  );
}
