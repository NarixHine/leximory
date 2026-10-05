# Bundled typography

Font roles follow `apps/leximory/lib/fonts/index.ts` and the web components, rather than a system-font substitution.

| Role | Native faces | Source |
| --- | --- | --- |
| Latin editorial titles | EB Garamond, with real italic and OpenType small caps | Google Fonts `ofl/ebgaramond` |
| English/French reading and definition prose | Libre Baskerville Regular and Italic | Google Fonts `ofl/librebaskerville` |
| Chinese serif and Chinese UI fallback | ChillDuanHeiSongPro Regular | User-supplied OTF, SIL OFL 1.1 |
| Japanese serif and ruby | ChillDuanHeiSongProJP Regular | User-supplied OTF, SIL OFL 1.1 |
| Library page heading, hero slogan, topic pills | LXGW WenKai Screen | Converted from the repository's `lib/fonts/kaiti.woff2` |
| Latin interface labels | Raleway Regular and SemiBold | Google Fonts `ofl/raleway` |
| Libraries eyebrow | Space Mono Regular | Google Fonts `ofl/spacemono` |
| Text cover emoji | Noto Emoji regular outlines, renamed | Google Fonts `ofl/notoemoji`, SIL OFL 1.1 |
| IPA and code | Source Code Pro Medium | Google Fonts `ofl/sourcecodepro` |

The supplied Chinese and Japanese Chill fonts replace the Noto serif faces. Both ship at their original Regular weight, including EPUB reading. Their embedded copyright notices and SIL OFL 1.1 license are preserved in `OFL-ChillDuanHeiSongPro.txt`. Latin faces cascade to the appropriate Chinese or Japanese face, so mixed-language titles retain editorial typography. Variable fonts were instantiated with FontTools and updated PostScript names; native tests verify their registration. Full SIL Open Font Licenses accompany every family.

App-authored text uses these faces, including buttons and navigation headings. SF Symbols, inline emoji, and operating-system text-selection controls retain their platform rendering. Dynamic Type scales the app's typography. Reader font changes do not alter the canonical UTF-16 text or selection ranges.

Text covers explicitly use `LeximoryNotoEmoji.ttf`, the monochrome Noto Emoji outlines the web loads through `next/font/google` as `EMOJI`. The emoji renders in the web's `text-default-400` family, with the hue nudged toward each cover's identity-derived paper so a collection stays chromatic while every cover varies subtly. The bundling script verifies the upstream Google Fonts SHA-256 and renames the family, so covers work offline and cannot depend on downloaded fonts. The full OFL accompanies the font.
