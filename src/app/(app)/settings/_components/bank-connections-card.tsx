"use client";

import { useEffect, useState, useTransition } from "react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { Landmark, RefreshCw, Trash2, AlertTriangle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  disconnectBankConnectionAction,
  listInstitutionsAction,
  syncBankConnectionAction
} from "@/app/(app)/settings/actions";

export type BankConnectionRow = {
  id: string;
  institutionId: string;
  institutionName: string;
  status: "pending" | "active" | "expired" | string;
  lastSyncedAt: Date | null;
  expiresAt: Date | null;
  accountCount: number;
};

export function BankConnectionsCard({
  connections,
  defaultCountry
}: {
  connections: BankConnectionRow[];
  defaultCountry: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-muted-foreground" aria-hidden />
          Bank connections
        </CardTitle>
        <CardDescription>
          PSD2 Open Banking via Enable Banking. Transactions sync nightly into
          /money. Each consent lasts 90 days, then needs renewal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No banks connected yet. Connect one to start importing transactions.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {connections.map((c) => (
              <ConnectionRow key={c.id} connection={c} />
            ))}
          </ul>
        )}
        <ConnectDialog defaultCountry={defaultCountry} />
      </CardContent>
    </Card>
  );
}

function ConnectionRow({ connection }: { connection: BankConnectionRow }) {
  const [syncing, startSync] = useTransition();
  const [removing, startRemove] = useTransition();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const daysToExpiry = connection.expiresAt
    ? differenceInDays(connection.expiresAt, new Date())
    : null;
  const expiringSoon = daysToExpiry !== null && daysToExpiry <= 14 && daysToExpiry >= 0;
  const expired = connection.status === "expired" || (daysToExpiry !== null && daysToExpiry < 0);

  function handleSync() {
    startSync(async () => {
      const result = await syncBankConnectionAction(connection.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.expired) {
        toast.warning("Connection expired — reconnect to keep syncing.");
        return;
      }
      const parts: string[] = [`${result.inserted} new`];
      if (result.skippedDuplicates > 0) parts.push(`${result.skippedDuplicates} dedup'd`);
      toast.success(
        `Synced ${result.accountsScanned} account${result.accountsScanned === 1 ? "" : "s"}: ${parts.join(", ")}.`
      );
    });
  }

  function handleRemove() {
    startRemove(async () => {
      const result = await disconnectBankConnectionAction(connection.id);
      if (result.ok) {
        toast.success(`Disconnected ${connection.institutionName}.`);
      } else {
        toast.error(result.message);
      }
      setConfirmingRemove(false);
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium">{connection.institutionName}</p>
        <p className="text-xs text-muted-foreground">
          {connection.accountCount} account{connection.accountCount === 1 ? "" : "s"}
          {" · "}
          {connection.lastSyncedAt
            ? `last sync ${format(connection.lastSyncedAt, "MMM d, HH:mm")}`
            : "not yet synced"}
          {expired ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              expired
            </span>
          ) : expiringSoon ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              expires in {daysToExpiry}d
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing || expired}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync"}
        </Button>
        {confirmingRemove ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? "Removing…" : "Confirm"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingRemove(false)}
              disabled={removing}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirmingRemove(true)}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        )}
      </div>
    </li>
  );
}

function ConnectDialog({ defaultCountry }: { defaultCountry: string }) {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState(defaultCountry);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [institutions, setInstitutions] = useState<
    Array<{ name: string; country: string; logo: string | null; sandbox: boolean }>
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    listInstitutionsAction(country).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setInstitutions(result.institutions);
      } else {
        setInstitutions([]);
        setErrorMessage(result.message);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, country]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? institutions.filter((i) => i.name.toLowerCase().includes(normalizedQuery))
    : institutions;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Connect a bank
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a bank</DialogTitle>
          <DialogDescription>
            We&apos;ll redirect you to your bank to authorize 90 days of read-only access to balances
            and transactions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label htmlFor="bank-country" className="text-xs text-muted-foreground">
                Country
              </label>
              <Input
                id="bank-country"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="NL"
                className="h-9"
                maxLength={2}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label htmlFor="bank-search" className="text-xs text-muted-foreground">
                Search
              </label>
              <Input
                id="bank-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Revolut, ING, ABN…"
                className="h-9"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {loading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Loading institutions…</p>
            ) : errorMessage ? (
              <p className="px-3 py-4 text-sm text-destructive">{errorMessage}</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No matches in {country}. Try a different country code.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.slice(0, 50).map((i) => (
                  <li key={`${i.name}::${i.country}`}>
                    <a
                      href={`/api/banking/connect?aspspName=${encodeURIComponent(i.name)}&aspspCountry=${encodeURIComponent(i.country)}`}
                      className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
                    >
                      {i.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.logo} alt="" className="h-6 w-6 rounded-sm object-contain" />
                      ) : (
                        <div className="h-6 w-6 rounded-sm bg-muted" aria-hidden />
                      )}
                      <span className="truncate">{i.name}</span>
                      {i.sandbox && (
                        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          sandbox
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
