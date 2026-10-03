# Bundled typography

Font roles follow `apps/leximory/lib/fonts/index.ts` and the web components, rather than a system-font substitution.

| Role | Native faces | Source |
| --- | --- | --- |
| Latin editorial titles | EB Garamond, with real italic and OpenType small caps | Google Fonts `ofl/ebgaramond` |
| English/French reading and definition prose | Libre Baskerville Regular and Italic | Google Fonts `ofl/librebaskerville` |
| Chinese serif and Chinese UI fallback | Noto Serif SC Medium 500 and SemiBold 600 | Google Fonts `ofl/notoserifsc` |
| Japanese serif and ruby | Noto Serif JP Regular | Google Fonts `ofl/notoserifjp` |
| Library page heading, hero slogan, topic pills | LXGW WenKai Screen | Converted from the repository's `lib/fonts/kaiti.woff2` |
| Latin interface labels | Raleway Regular and SemiBold | Google Fonts `ofl/raleway` |
| Libraries eyebrow | Space Mono Regular | Google Fonts `ofl/spacemono` |
| IPA and code | Source Code Pro Medium | Google Fonts `ofl/sourcecodepro` |

Noto Serif SC is the mobile substitute for the web's LXGW Neo ZhiSong Screen. There is no Chinese serif face below weight 500 in the bundle. Latin faces cascade to the appropriate Chinese or Japanese face, so mixed-language titles retain editorial typography. Variable fonts were instantiated with FontTools and updated PostScript names; native tests verify their registration. Full SIL Open Font Licenses accompany every family.

App-authored text uses these faces, including buttons and navigation headings. SF Symbols, emoji, and operating-system text-selection controls retain their platform rendering. Dynamic Type scales the app's typography. Reader font changes do not alter the canonical UTF-16 text or selection ranges.
