import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteDialog } from "@/components/forms/delete-dialog";
import { deleteSip } from "@/lib/sips/actions";
import { formatInr } from "@/lib/money";
import {
  SIP_FREQUENCY_LABELS,
  monthlySipTotal,
  type SipView,
} from "@/lib/sips/queries";
import { sourceLabel } from "@/lib/holdings/consolidation";
import { SipDialog } from "./sip-dialog";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

export function SipSection({ sips }: { sips: SipView[] }) {
  const monthly = monthlySipTotal(sips);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">SIPs</CardTitle>
            <CardDescription>
              {sips.length > 0
                ? `${formatInr(monthly)} / month across ${sips.length} plan${sips.length > 1 ? "s" : ""}`
                : "Track recurring mutual-fund investments."}
            </CardDescription>
          </div>
          <SipDialog trigger="primary" label="Add SIP" />
        </div>
      </CardHeader>
      <CardContent>
        {sips.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">No SIPs yet.</p>
        ) : (
          <div className="divide-border flex flex-col divide-y">
            {sips.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.fundName}</span>
                    {!s.active && (
                      <Badge variant="secondary" className="text-[10px]">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {SIP_FREQUENCY_LABELS[s.frequency]} · day {s.dayOfMonth} ·{" "}
                    {sourceLabel(s.source)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="text-right">
                    <div className="text-sm num">
                      {formatInr(s.amountInr)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      next {dateFmt.format(s.nextDate)}
                    </div>
                  </div>
                  <SipDialog initial={s} trigger="icon" label="Edit SIP" />
                  <DeleteDialog
                    id={s.id}
                    name={s.fundName}
                    title="Delete SIP"
                    action={deleteSip}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
