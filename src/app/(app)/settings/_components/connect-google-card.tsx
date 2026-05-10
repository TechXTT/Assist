"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ConnectGoogleCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Calendar</CardTitle>
        <CardDescription>
          Connect to see your real schedule on the dashboard. Read-only — we never write back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          size="sm"
          onClick={() => signIn("google", { callbackUrl: "/settings" })}
        >
          Connect Google
        </Button>
      </CardContent>
    </Card>
  );
}
