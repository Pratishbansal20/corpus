"use server";

import { requireUser } from "@/lib/auth/require-user";
import { searchInstruments, type InstrumentHit } from "./search";

/**
 * Type-ahead search for the Add-holding form. Behind auth like everything else:
 * it is only ever called from a signed-in dialog, and leaving it open would
 * make the app a free proxy for two third-party APIs.
 */
export async function searchInstrumentsAction(
  query: string,
): Promise<InstrumentHit[]> {
  await requireUser();
  try {
    return await searchInstruments(query);
  } catch {
    // A dead search source must not break the form: the user can still type
    // the symbol by hand.
    return [];
  }
}
