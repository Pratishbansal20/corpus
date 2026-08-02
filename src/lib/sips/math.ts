import { Prisma } from "@/generated/prisma";

// The arithmetic behind applying a SIP debit, kept free of Prisma's client so
// it can be tested without a database. Money stays Decimal throughout: a
// float here would drift the average buy price a little on every debit, which
// is exactly the kind of slow, unexplainable error this feature exists to stop.

/** The holding column's scale. Rounding here keeps stored and recorded units equal. */
export const UNIT_SCALE = 6;

export function unitsForAmount(
  amountInr: Prisma.Decimal,
  nav: Prisma.Decimal,
): Prisma.Decimal {
  return amountInr.div(nav).toDecimalPlaces(UNIT_SCALE);
}

/**
 * The new average buy price after adding `amountInr` of new units.
 *
 * Computed from money in, `(old invested + amount) / new quantity`, rather than
 * from `units × nav`. The unit count is rounded to the column's scale, so
 * pricing off it would let a few paise escape on every debit; using the amount
 * actually debited keeps invested equal to what the bank statement says.
 */
export function blendedAverage(
  oldQuantity: Prisma.Decimal,
  oldAvgBuyPrice: Prisma.Decimal,
  addedUnits: Prisma.Decimal,
  amountInr: Prisma.Decimal,
): Prisma.Decimal {
  const newQuantity = oldQuantity.plus(addedUnits);
  if (newQuantity.isZero()) return oldAvgBuyPrice;
  return oldQuantity
    .times(oldAvgBuyPrice)
    .plus(amountInr)
    .div(newQuantity)
    .toDecimalPlaces(UNIT_SCALE);
}
