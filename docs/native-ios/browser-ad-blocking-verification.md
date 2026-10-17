# Browser ad blocking handoff

Implemented on 2026-10-17. The user requested that remaining verification be performed by a human. Automated verification has stopped. The simulator app was relaunched without fixture arguments in normal account mode.

## Delivered

- Browser-local WebKit request blocking and cosmetic filtering from bundled EasyList and EasyPrivacy data.
- More → 广告拦截 and the same entry in standalone webpage options.
- A global switch, current-host switch, and an exception list shown only when needed.
- Draft settings, cancellation, explicit reload confirmation, and protection against replaying form submissions.
- Local persistence, exception clearing with browsing data, and browser-only rule ownership.
- Pinned source snapshots, converter provenance, redistribution notices, license text, and a maintainer preparation/check script.

## Completed checks

The simulator and Mac Catalyst builds succeeded. Six native blocker tests passed on iOS 27, covering native list compilation, actual blocked requests, ordinary resources, cosmetic hiding, exceptions across frames and hosts, global disabling, preference persistence, stale drafts, preparation failure, unrelated rule preservation, and POST behavior.

The website settings UI test passed after targeting the native switch thumb. The Home settings UI test passed after placing the action before the search submenu. The latter was the last automated run, which completed before the verification stop request was handled. These two UI cases passed in separate runs.

The preparation script reproduced its generated artifact after enabling deterministic Swift hashing in the offline converter. The final generated rules restrict network blocking to subresource types, preserving document navigation without a document-wide exception that could also disable cosmetic rules. This last data transformation still needs a fresh native behavior run. The additional concurrent-preparation test compiles but has not been executed.

No new test, build, or manual runtime verification was started after the stop request. Earlier results do not constitute full release validation of the final diff.

## Human checks remaining

1. Open More → 广告拦截 on Home and a webpage. Check the layout on phone and iPad, including dark appearance and large text.
2. Change a switch and cancel. Reopen and confirm the saved choice did not change.
3. Apply a website exception, confirm the explicit reload, and reopen settings. Restore blocking through 网站例外. Confirm clearing browser data removes exceptions and preserves the global switch.
4. Compare an ad-bearing page with blocking enabled and disabled. Check request blocking and visible ad hiding separately. Confirm ordinary content, login, consent, embedded frames, media, selection lookup, imports, and PDF opening remain usable.
5. Change settings on a form-result page. Confirm no resubmission or forced reload occurs. Exercise links, redirects, back/forward, session restoration, and rapid navigation during initial preparation.
6. Run the final native blocker and existing browser regression suites, including the added concurrency test. Check iOS 26, which was not installed in the verification environment, and exercise Mac Catalyst at runtime before release.

No App Store submission, deployment, physical-device installation, database change, or Supabase mutation was performed.
