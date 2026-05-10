<!-- BEGIN:nextjs-agent-rules -->
 
# Next.js: ALWAYS read docs before coding
 
Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
 
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:type-check-agent-rules -->
 
# Type Check: ALWAYS use turbo or pnpm to type-check

If you need to type-check, use `pnpm run check-types` (in an app directory) or `turbo check-types` (for the entire Turborepo) instead of `npm` or `tsc`.
 
<!-- END:type-check-agent-rules -->
