# App Store readiness and account experience

Research and design proposal, 1 November 2026. No production implementation or database operations are included.

Start with [the revised free-AI proposal](guest-ai.md), then [the compliance research](research.md) and [the proposed experience and implementation plan](experience.md).

## Recommended decision

Open directly into the existing Home. Let everyone browse websites, open EPUB/PDF files, use a small free contextual AI allowance, and keep chosen words locally. Offer an account for cloud libraries, personal review and saving local words into the account. Use existing Redis metering and a Keychain guest credential, accepting a resettable guest identity. Vercel budget protection is already handled by the user; do not build a second global spend system. Add an accessible deletion route with one explanation page and one final native confirmation.

This is a product recommendation based on Apple policy and the current source. Apple does not publish a feature count that guarantees approval. An anonymous account, a hidden skip link, or calling a feature "cloud" does not by itself establish compliance.

## Revised screen studies

The revised direction puts the definition and the reader's own words first. It replaces the previous generic authentication framing.

| Free contextual AI | Optional account | Allowance exhausted |
| --- | --- | --- |
| [Open screen](04-free-ai-reading.png) | [Open screen](05-optional-account.png) | [Open screen](06-allowance-state.png) |

These studies use the actual lawn/cat assets as references. The optional account sheet carries the chosen word and source sentence into authentication. Ordinary reading and local vocabulary remain usable after the free AI allowance is exhausted. [Technical feasibility and revised UX](guest-ai.md).

## Earlier screen studies

Retained for comparison. The sign-in framing is superseded by the revised optional account study. All studies were generated with the built-in Image Gen tool. These are visual concepts, not simulator screenshots, production components, or accessibility verification. Exact dimensions, fonts, states, and copy must follow the native source and current specifications.

| Home without an account | Contextual sign-in | Account deletion |
| --- | --- | --- |
| [Open screen](01-home.png) | [Open screen](02-sign-in.png) | [Open screen](03-delete-account.png) |

Home keeps the existing four-card composition and wallpaper. The form and deletion screen use native semantic backgrounds and neutral controls. No new introductory carousel is proposed. [Generation notes and prompts](generation-notes.md) record the references and visual limitations.

## Evidence and limits

The repository review covered account routing, sign-in, import, ebook rendering, local storage, membership, mobile authorization, account endpoints, and the administrator deletion action. The live simulator was only observed, without navigation or relaunch. Its existing PDF state was not used as evidence for an onboarding audit. Existing user edits were left alone.

No live Supabase schema, storage inventory, App Store Connect configuration, AI processor retention contracts, or complete signup/deletion journey was verified. Those remain implementation prerequisites, not claims of completed compliance.

Only this documentation directory was added by this task. No app or backend behavior was changed.
