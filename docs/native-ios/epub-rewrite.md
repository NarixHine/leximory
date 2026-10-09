# Native EPUB rendering

Readium Shared and Streamer can supply EPUB resources, metadata, spine order and locators. Its stock EPUB navigator still uses WebKit and does not support paginated vertical text, so it cannot replace Leximory's reader directly.

A native renderer would need structured XHTML/CSS layout, Japanese vertical text and ruby, selection, and mappings between source ranges and existing CFIs. Prove those with real books before switching engines. Keep authorization, bookmarks and reading-position sync in the existing app services.

Tap navigation is unanimated; swipes use native slides. Incoming pages can still appear empty during swipes; the preload changes have not resolved the reported issue.

Reference: [Readium Swift Toolkit](https://github.com/readium/swift-toolkit/tree/ad3a23d8550810b3edcfa66e5be54f1b5a805f6a).
