# Mobile server refactoring

## Definition of done

Every mobile API endpoint has a native Next.js route file and a named operation. No production mobile module dispatches by URL path. Shared HTTP handling authenticates before work, bounds request bodies, returns private responses and typed failures, and preserves cancellation. The generated Swift API and actual route exports agree. Existing authorization, ownership, quotas, provenance, upload bounds, and retry tests pass. The Shortcut uses one request. Type checks and native build/tests pass. No database schema changes or live database writes are part of verification.

## Plan

- [x] Read workflow principles, repository instructions, and installed Next.js route documentation.
- [x] Capture existing mobile-test and type-check baseline.
- [x] Audit 24 mobile modules, about 1,800 lines, for duplicated transport policy and misplaced logic.
- [x] Introduce one HTTP boundary and explicit named domain operations, migrating all callers and deleting the custom router.
- [x] Replace duplicate definition streaming/generation and shadow-library creation with shared services.
- [x] Give Shortcut saving its own domain operation and one idempotent request; migrate Swift and delete the old Shortcut API.
- [x] Add a rerunnable route/contract consistency gate and architecture guide.
- [x] Run server regression tests, type checking, Swift tests/build, and independent review; resolve findings.

## Choices

Use native route files, not Hono. Centralize shared policy, not endpoint dispatch. Next owns HTTP methods and parameter extraction. Each route reexports an operation with the same name as its API contract. Keep production dependency composition per feature so importing one endpoint does not import every feature. Test named operations through the same HTTP boundary with injected external services.

Preserve endpoint paths except the Shortcut selection endpoint, whose sole native caller is migrated in the same change. Vocabulary saves now require request IDs; the native client already supplies them. Preserve streaming frame and cache-key formats. Measure structural improvements and request count; do not claim unmeasured production latency gains.

## Verification

`pnpm --dir apps/leximory run test:mobile`

`pnpm --dir apps/leximory run check-types`

`pnpm --dir apps/leximory run check:mobile-routes`

`swift test --package-path apps/leximory-ios/Core`

Simulator app build, with no account mutation or device installation.
