import { formatInr, formatNative, formatQuantity } from "@/lib/money";
import type { SipAppliedView } from "@/lib/sips/constants";

const dayFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * The receipt for an automatically applied debit. The app changes the units and
 * the average price on its own, so it has to say when, at what NAV, and for how
 * many units, or the position quietly disagrees with the broker.
 *
 * When the allotment date is not the debit date, both are shown: a SIP due on a
 * Saturday is allotted at Monday's NAV, and that gap is exactly the thing a
 * reader would otherwise think was a bug.
 *
 * The bank line is the other half of the same receipt. The app draws the money
 * down on its own, so it has to say which account it came out of.
 */
export function SipAppliedNote({ applied }: { applied: SipAppliedView }) {
  const shifted =
    applied.navDate.getTime() !== applied.dueDate.getTime();

  return (
    <p className="text-muted-foreground text-xs">
      Applied {dayFmt.format(applied.navDate)} at NAV{" "}
      <span className="num">{formatNative(applied.nav, "INR")}</span> ·{" "}
      <span className="num">{formatQuantity(applied.units)}</span> units
      {shifted && <> (due {dayFmt.format(applied.dueDate)})</>}
      {applied.debitedFrom && (
        <>
          {" · "}
          <span className="num">{formatInr(applied.amountInr)}</span> from{" "}
          {applied.debitedFrom}
        </>
      )}
    </p>
  );
}
