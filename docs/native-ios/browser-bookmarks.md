# Browser and URL Bookmarks

The iOS library gallery has a globe button that opens one webpage at a time. The browser uses WKWebView, native selection, and Liquid Glass controls. Followed links and new-window links stay in the same page. The menu offers forward navigation, reload, sharing, saving a URL, Safari, and vocabulary settings.

Select text and choose **猫忆查** to open the existing definition tray. Its vocabulary saving, editing, and dictionary actions work as they do in the reader. Ordinary browsing shows the saving destination below the definition; tap it to change the current website's library. Selecting a library also selects its language. Jev runs only when no library is selected or mapped.

The creation dialog has **网页、文本、电子书** tabs. **存为书签** saves the URL, title, and emoji; **导入** continues the existing article import flow. Saving a Bookmark returns to the library. Tapping its card opens the original webpage. No article body or preannotations are stored. Metadata failures fall back to the hostname and globe emoji.

Opening a library Bookmark fixes its language and vocabulary destination for the entire browser visit, including followed links. An owner saves to that library. A visitor to a shared library saves to their personal shadow library in the source library's language. Personal website rules do not change these Bookmark visits.

## Storage and authorization

- `texts.bookmark_url` identifies URL Bookmarks. Article and ebook rows leave it null.
- `browser_domain_rules` stores an account's domain-to-library choices. Domains normalize lowercase, `www.`, and a trailing dot; rules match the resulting exact hostname.
- The authenticated mobile server validates ownership before changing rules or creating Bookmarks. It rechecks library access and language before defining or saving.
- Short-lived Redis receipts bind selected context, language, and destination to the account. Definition generation uses the existing allowance and cache. Mutation IDs make creation and vocabulary retries idempotent.
- Web text lists and direct reading/editing paths exclude URL Bookmarks. No Bookmark creation option is added to Web.

The WebKit selection script runs in an isolated content world and reads only a bounded context around the selection. It excludes editable fields and ruby pronunciations. Websites receive no Leximory bearer token or native message bridge. Arbitrary HTTP access is permitted only for WebKit content through the scoped App Transport Security setting; native API requests retain their transport restrictions.

This version does not persist webpage highlights or import a browser visit as an article. Ebook quote marking is labeled **🖍️荧光笔** to distinguish it from URL Bookmarks; its saved data and navigation remain compatible.

## Verification

Run `pnpm --dir apps/leximory run check-types` and `pnpm --dir apps/leximory run test:mobile`. Swift client coverage is in `BrowserClientTests`, WebKit coverage in `TextBrowserTests`, and the mock creation/navigation flow in `TextBrowserUITests`. The UI test resets its launch arguments and returns to normal account mode.
