# data/

Local-only staging area, not shipped with the app.

## cas-raw/

Raw source documents (CAS PDFs, broker exports, and `.txt` files holding a
PDF's extracted text) for the `Transaction`-model backfill
(`../src/lib/db/backfill-cas-transactions.ts`). Gitignored deliberately: these
carry real PAN, address and mobile number, and this repo is public. Nothing
under here is ever committed, and no content from it should be copied into
any tracked file, commit message, or doc — the parser
(`../src/lib/imports/cas-cams-kfintech.ts`) is tested against a fabricated
fixture instead, never against a real file. See the "PDF / LLM holdings
import" note in [`TODO.md`](../TODO.md) for the general (non-CAMS/KFintech,
LLM-assisted) importer this one doesn't replace.
