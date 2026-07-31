import { Shield, ShieldCheck, User, Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/require-user";
import {
  getCreditScores,
  CREDIT_BUREAU_LABELS,
  scoreBand,
} from "@/lib/credit/queries";
import { deleteCreditScore } from "@/lib/credit/actions";
import { hasPassphrase } from "@/lib/security/queries";
import { CreditScoreDialog } from "@/components/credit/credit-score-dialog";
import { SetupPassphraseDialog } from "@/components/security/setup-passphrase-dialog";
import { ChangePassphraseDialog } from "@/components/security/change-passphrase-dialog";
import { DeleteDialog } from "@/components/forms/delete-dialog";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function bandColor(band: ReturnType<typeof scoreBand>): string {
  if (band === "excellent" || band === "good") return "text-gain";
  if (band === "poor") return "text-loss";
  return "text-foreground";
}

export default async function SettingsPage() {
  const user = await requireUser();
  const [scores, hasPp] = await Promise.all([
    getCreditScores(user.id!),
    hasPassphrase(user.id!),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Profile / Account */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
              <User className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">Account</CardTitle>
              <CardDescription>Your profile and sign-in info</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Row label="Name" value={user.name ?? "Not set"} />
          <Row label="Email" value={user.email ?? "Not set"} />
          <Row
            label="Owner"
            value={
              process.env.OWNER_EMAIL
                ? user.email === process.env.OWNER_EMAIL
                  ? "Yes (allowlisted)"
                  : "No"
                : "Not configured"
            }
          />
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                {hasPp ? (
                  <ShieldCheck className="size-5" />
                ) : (
                  <Shield className="size-5" />
                )}
              </div>
              <div>
                <CardTitle className="text-base">App passphrase</CardTitle>
                <CardDescription>
                  {hasPp
                    ? "Your dashboard is protected. Change it any time."
                    : "Set a passphrase to lock your dashboard after Google login."}
                </CardDescription>
              </div>
            </div>
            {hasPp ? <ChangePassphraseDialog /> : <SetupPassphraseDialog />}
          </div>
        </CardHeader>
        {!hasPp && (
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Once set, you'll need this passphrase every time you sign in,
              on top of Google login. Minimum 6 characters.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Credit scores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                <Activity className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Credit score</CardTitle>
                <CardDescription>
                  {scores.length > 0
                    ? "Latest score per bureau. Add a new entry to update."
                    : "Record your CIBIL / Experian score to track it over time."}
                </CardDescription>
              </div>
            </div>
            <CreditScoreDialog />
          </div>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              No credit scores recorded yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {scores.map((s) => {
                const band = scoreBand(s.score);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {CREDIT_BUREAU_LABELS[s.bureau]}
                        </span>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {band}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {dateFmt.format(s.asOf)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-lg font-semibold num ${bandColor(band)}`}
                      >
                        {s.score}
                      </span>
                      <DeleteDialog
                        id={s.id}
                        name={`${CREDIT_BUREAU_LABELS[s.bureau]} score`}
                        title="Delete score"
                        action={deleteCreditScore}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
