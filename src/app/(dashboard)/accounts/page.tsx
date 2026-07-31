import { Landmark, Coins } from "lucide-react";
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
  getBankAccounts,
  getManualAssets,
  sumBalances,
  sumAssetValues,
  BANK_ACCOUNT_TYPE_LABELS,
  ASSET_CATEGORY_LABELS,
} from "@/lib/accounts/queries";
import { deleteBankAccount, deleteManualAsset } from "@/lib/accounts/actions";
import { formatInr } from "@/lib/money";
import { BankAccountDialog } from "@/components/accounts/bank-account-dialog";
import { ManualAssetDialog } from "@/components/accounts/manual-asset-dialog";
import { DeleteDialog } from "@/components/forms/delete-dialog";

export default async function AccountsPage() {
  const user = await requireUser();
  const [banks, assets] = await Promise.all([
    getBankAccounts(user.id),
    getManualAssets(user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Bank accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Bank accounts</CardTitle>
              <CardDescription>
                {banks.length > 0
                  ? `${formatInr(sumBalances(banks))} across ${banks.length} account${banks.length > 1 ? "s" : ""}`
                  : "Cash sitting in your bank accounts."}
              </CardDescription>
            </div>
            <BankAccountDialog trigger="primary" label="Add account" />
          </div>
        </CardHeader>
        <CardContent>
          {banks.length === 0 ? (
            <EmptyRow icon={<Landmark className="size-5" />} text="No bank accounts yet." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {banks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{b.bankName}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {BANK_ACCOUNT_TYPE_LABELS[b.accountType]}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {b.nickname ? `${b.nickname} · ` : ""}
                      {b.last4 ? `•• ${b.last4}` : "Not set"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="num">{formatInr(b.balanceInr)}</span>
                    <BankAccountDialog
                      initial={b}
                      trigger="icon"
                      label="Edit account"
                    />
                    <DeleteDialog
                      id={b.id}
                      name={b.bankName}
                      title="Delete account"
                      action={deleteBankAccount}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other assets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Other assets</CardTitle>
              <CardDescription>
                {assets.length > 0
                  ? `${formatInr(sumAssetValues(assets))} in cash, FDs, gold, EPF & more`
                  : "FDs, gold, EPF/PPF, property, and anything else you own."}
              </CardDescription>
            </div>
            <ManualAssetDialog trigger="primary" label="Add asset" />
          </div>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <EmptyRow icon={<Coins className="size-5" />} text="No other assets yet." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {assets.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{a.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {ASSET_CATEGORY_LABELS[a.category]}
                      </Badge>
                    </div>
                    {a.notes && (
                      <div className="text-muted-foreground truncate text-xs">
                        {a.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="num">{formatInr(a.valueInr)}</span>
                    <ManualAssetDialog
                      initial={a}
                      trigger="icon"
                      label="Edit asset"
                    />
                    <DeleteDialog
                      id={a.id}
                      name={a.name}
                      title="Delete asset"
                      action={deleteManualAsset}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 py-6 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      {text}
    </div>
  );
}
