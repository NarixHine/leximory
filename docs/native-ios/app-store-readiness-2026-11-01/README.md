# App Store readiness and account experience

The research and initial design studies were followed by native and server implementation on 1 November 2026. The user's final constraints replace the earlier local-saving proposal.

Guests open the existing Home, browse websites, open EPUB/PDF files in memory, and receive five free generated AI definitions per 30-day credential period. Saving a word requires sign-in. No guest word store, guest library, reading-mark database, merge, anonymous Supabase account, or custom global spending ledger was added. Existing signed-in quotas and reader controls remain the reference.

The approved visual direction is [the optional account screen](05-optional-account.png). Other generated reader/tray studies were rejected. The implementation uses Leximory's real selection menus, popovers, trays, fonts, and dedicated watercolor meadow/highlight assets.

Read [the current experience](experience.md), [the guest AI implementation](guest-ai.md), and [implementation results and remaining release checks](implementation.md). The [research](research.md) records Apple's rules and the original source audit. Its pre-implementation inventory is historical.

Account settings now include native deletion. It confirms the intended account, supports recent-authentication verification, preserves a receipt before sending, and uses existing Inngest/Redis infrastructure to delete owned data and recover status after sign-out. It does not equate sign-out with completed deletion.

No live Supabase data, schema, storage bucket, production deployment, or App Store Connect setting was changed. Deployment-specific email redirects, processor retention disclosures, storage/FK behavior, and end-to-end job completion still need authorized release verification. This implementation does not guarantee App Review approval. [Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/) and [account deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) are the policy references.
