# Bundled typography

Native typography separates interface, display and reading roles.

| Role | Native faces | Source |
| --- | --- | --- |
| Fixed Chinese UI display labels | 欣意吉祥宋 | User-supplied `jixiangsong.ttf`; accompanying notice preserved |
| Latin editorial titles | EB Garamond, with real italic and OpenType small caps | Google Fonts `ofl/ebgaramond` |
| English/French reading and definition prose | Libre Baskerville Regular and Italic | Google Fonts `ofl/librebaskerville` |
| Chinese reading serif | ChillDuanHeiSongPro Regular | User-supplied OTF, SIL OFL 1.1 |
| Japanese serif and ruby | ChillDuanHeiSongProJP Regular | User-supplied OTF, SIL OFL 1.1 |
| Latin interface labels | Urbanist Regular and SemiBold | [Urbanist upstream](https://github.com/coreyhu/Urbanist/tree/main/fonts/ttf) |
| Libraries eyebrow | Space Mono Regular | Google Fonts `ofl/spacemono` |
| Text cover emoji | Noto Emoji regular outlines, renamed | Google Fonts `ofl/notoemoji`, SIL OFL 1.1 |
| IPA and code | Source Code Pro Medium | Google Fonts `ofl/sourcecodepro` |

The supplied Chinese and Japanese Chill fonts replace the Noto serif faces. Both ship at their original Regular weight, including EPUB reading. Their embedded copyright notices and SIL OFL 1.1 license are preserved in `OFL-ChillDuanHeiSongPro.txt`. Latin faces cascade to the appropriate Chinese or Japanese face, so mixed-language titles retain editorial typography. Variable fonts were instantiated with FontTools and updated PostScript names; native tests verify their registration. Font licenses and the supplied display font’s notice accompany their respective files.

Interface labels pair Urbanist with the original ChillDuanHeiSong Chinese serif, explicitly selected even on Japanese-language devices. Garamond pairs with the original Chinese/Japanese serif for library names, text titles and arbitrary content. The separate display font API reserves 欣意吉祥宋, optically enlarged to 120%, for fixed Chinese UI labels such as Home cards, page headings and slogans. Library/text titles and potentially Japanese or multilingual strings never use 吉祥宋. Address labels, recents and autocomplete retain the original 85% per-character size for Han and Chinese/full-width punctuation, leaving Latin, kana and emoji at full size. SF Symbols, inline emoji and system text-selection controls retain their platform rendering. Dynamic Type scales the app's typography. Reader font changes do not alter canonical UTF-16 text or selection ranges.

Text covers explicitly use `LeximoryNotoEmoji.ttf`, the monochrome Noto Emoji outlines the web loads through `next/font/google` as `EMOJI`. The emoji renders in the web's `text-default-400` family, with the hue nudged toward each cover's identity-derived paper so a collection stays chromatic while every cover varies subtly. The bundling script verifies the upstream Google Fonts SHA-256 and renames the family, so covers work offline and cannot depend on downloaded fonts. The full OFL accompanies the font.
