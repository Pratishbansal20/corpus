import { CreditCard as CreditCardIcon, AlertCircle } from "lucide-react";
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
  getCreditCards,
  sumOutstanding,
  daysUntilDue,
  isDueSoon,
  resolveDueDate,
  CARD_NETWORK_LABELS,
} from "@/lib/cards/queries";
import { deleteCreditCard } from "@/lib/cards/actions";
import { formatInr } from "@/lib/money";
import { CreditCardDialog } from "@/components/cards/credit-card-dialog";
import { DeleteDialog } from "@/components/forms/delete-dialog";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function cardLabel(issuer: string, nickname: string | null): string {
  return nickname ? `${nickname} (${issuer})` : issuer;
}

export default async function CardsPage() {
  const user = await requireUser();
  const cards = await getCreditCards(user.id);
  const totalOutstanding = sumOutstanding(cards);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Credit cards</CardTitle>
              <CardDescription>
                {cards.length > 0
                  ? `${formatInr(totalOutstanding)} outstanding across ${cards.length} card${cards.length > 1 ? "s" : ""}`
                  : "Track limits, outstanding, and due dates. Last 4 digits only."}
              </CardDescription>
            </div>
            <CreditCardDialog trigger="primary" label="Add card" />
          </div>
        </CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-3 py-6 text-sm">
              <CreditCardIcon className="size-5" />
              No credit cards yet.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {cards.map((c) => {
                const dueSoon = isDueSoon(c);
                const days = daysUntilDue(c);
                const due = resolveDueDate(c);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">
                          {cardLabel(c.issuer, c.nickname)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {CARD_NETWORK_LABELS[c.network]}
                        </Badge>
                        {dueSoon && (
                          <Badge
                            variant="outline"
                            className="border-loss/40 text-loss gap-1 text-[10px]"
                          >
                            <AlertCircle className="size-3" />
                            Due{" "}
                            {days === 0
                              ? "today"
                              : days === 1
                                ? "tomorrow"
                                : `in ${days}d`}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {c.last4 ? `•• ${c.last4}` : "Not set"}
                        {due && (
                          <>
                            {" · "}
                            Due {dateFmt.format(due)}
                          </>
                        )}
                        {c.creditLimit > 0 && (
                          <>
                            {" · "}
                            {c.utilizationPct.toFixed(0)}% utilized
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="text-right num">
                        <div className="text-sm">{formatInr(c.currentOutstanding)}</div>
                        <div className="text-muted-foreground text-xs">
                          of {formatInr(c.creditLimit)}
                        </div>
                      </div>
                      <CreditCardDialog
                        initial={c}
                        trigger="icon"
                        label="Edit card"
                      />
                      <DeleteDialog
                        id={c.id}
                        name={cardLabel(c.issuer, c.nickname)}
                        title="Delete card"
                        action={deleteCreditCard}
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
