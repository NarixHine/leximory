# Article import recovery

The native message `未能确认导入结果` was a catch-all for a failed or undecodable import response. It did not establish whether the text was saved. Both import sheets then disabled retry and asked the user to inspect their folders manually.

Text imports previously generated a new text ID per request. If annotation scheduling failed, the backend deleted the text even though the scheduler might already have accepted its job. Retrying the original operation could create another text or charge annotation quota again.

Text import requests now carry a stable request ID. The server derives the saved text identity from the account, folder, request ID, and canonical import fields. It inserts without overwriting an existing text, returns the stored metadata on replay, and uses the same identities for quota charging and annotation scheduling. It keeps saved source text if an acknowledgement fails. Confirmed annotation submissions have a seven-day receipt. Inngest's event ID deduplication covers 24 hours, as described in its [idempotency documentation](https://www.inngest.com/docs/durable-execution/guides-and-advanced/idempotency). These are bounded retry protections, not a permanent exactly-once guarantee.

The native client retries temporary failures three times with one identity. After exhaustion, both text import sheets retain the draft and allow retry with that identity. Editing the content or import options represents a separate import intent. Ebook upload behavior remains separate.

The regression `articleImportRecoversWithOneRequestIdentity` failed before the client change with the first temporary service error. It now passes. The production database adapter tests use the installed Supabase client with fixture I/O and cover lost database responses, lost scheduler acknowledgements, receipt failures, progress failures, concurrent requests, replay after completion, and rejected replay after deletion. They verify that saved source text survives these failures.

Verification passed for all 272 mobile backend tests, all 104 Swift Core tests, the required type check, contract and route checks, and the iOS Simulator build. The Simulator check compiled the app without installing or launching it. No live account data or database schema was changed. The backend and native changes require deployment and an updated app; the outcome of the user's previously reported import remains unknown.
