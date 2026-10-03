# Display fonts

EB Garamond is Leximory's original web display family. `EBGaramond.ttf` comes from the official Google Fonts `ofl/ebgaramond` directory. SHA-256: `ef9512f92f6d579e5dc75af59a5a4b1b8b47d2eda89e00b954d44520e5369027`.

LXGW WenKai Screen is converted from the repository's existing `apps/leximory/lib/fonts/kaiti.woff2`. FontTools decompressed its WOFF2 container to TrueType without changing glyphs or names. It supplies the original handwritten Chinese display treatment.

Noto Serif JP provides Japanese Mincho-style display typography. `NotoSerifJP.ttf` comes from the official Google Fonts `ofl/notoserifjp` directory. The variable font is instantiated at weight 400 with FontTools, preserving its regular face name. It uses the SIL Open Font License, as do the other two bundled fonts. The web's different Mincho asset remains unchanged.

The corresponding complete licenses are included beside the font files. Native interface controls retain system fonts, and the reader retains its tested native text font and canonical offset mapping.

## Bundled file checksums

- LXGWWenKaiScreen.ttf: `b92be8498f2c77af1b6c95306b684a0d51517e8962401e41687a23cf481e8116`
- NotoSerifJP.ttf: `434a003c93db766b274ab912c1febdf1815d7dd3aab14437f407e7900b45383c`
