# data/

Local-only staging area, not shipped with the app.

## cas-raw/

Raw source documents (CAS PDFs, broker exports) staged for the future
`Transaction`-model importer. Gitignored deliberately: these carry real PAN,
address and mobile number, and this repo is public. Nothing under here is
ever committed, and no content from it should be copied into any tracked
file, commit message, or doc — see the "PDF / LLM holdings import" note in
[`TODO.md`](../TODO.md) for what's planned to actually read these.
