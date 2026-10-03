# Leximory native design direction

The original four Leximory screenshots, its library and text components, and the user's Family app reference establish the direction. The latest feedback supersedes the earlier move to standard grouped lists. Libraries and Texts need Leximory's own visual language; native controls should support that language where they improve interaction.

## Identity and composition

Use EB Garamond for display titles, as the web app does. Chinese display text uses the web's LXGW WenKai Screen asset, converted to TrueType. Japanese display text uses Noto Serif JP for the Mincho character, while native controls retain system fonts. Keep the near-white canvas, pale sage surfaces, dark ink, generous spacing, and quiet outlined artwork. Library cards should feel like collections, with language, expressive title, and actual text count. Texts should feel like a small publication, with one prominent cover and smaller supporting entries. A featured entry is a presentation choice, not a claim about reading history.

The Family reference informs the balance between expressive card layouts and compact familiar controls. It does not introduce a bright wallet palette, balances, a tab bar without destinations, or unrelated functionality.

| Before | After | Why |
| --- | --- | --- |
| Standard grouped fixture list | Pale sage collection cards with editorial typography | Restore the library's identity and make collections distinct from texts. |
| Direct fixture-to-reader route | Library → Texts → Reader | Match the web product's information structure. |
| System serif for every title | Bundled EB Garamond display font | Preserve the original letterforms rather than approximating the style. |
| Equal list rows for every text | Illustrated featured text and compact supporting entries | Preserve the web's editorial hierarchy while recomposing it for phone widths. |
| Native controls as the entire visual design | Native back navigation, menus, trays, sheets, and popovers around custom content | Keep familiar interaction without flattening the product's identity. |

## Source audit

The source references are `apps/leximory/components/library-card/index.tsx`, `app/library/page.tsx`, `app/library/[lib]/page.tsx`, `app/library/[lib]/components/text-list/index.tsx`, `components/emoji-cover/index.tsx`, `lib/fonts/index.ts`, and `tailwind.config.ts`.

The library card preserves the original relationship between a pale outer shell and an inset title surface. The two layers have concentric corner radii and no heavy shadow. This grouping has a purpose on the collection screen; it does not justify nesting cards inside every sheet or wrapping all text in boxes.

Cover illustrations use sage outlines with motifs from the actual sample passages. Their canvas is quiet and matte. Topic labels describe sample content and do not pretend to be live account metadata. The preview deliberately uses original synthetic passages instead of placing the reference screenshots' article titles over unrelated fixture text.

## Navigation and interaction

On iPhone, the navigation stack has separate library, text gallery, and reader destinations. On iPad, the library collection remains in a split-view column. The detail stack opens the text gallery, then the reader. The reader expands into the detail area; returning restores the collection context. Both adaptations use the same typed route path, so rotation does not invent a different reader identity.

Cards and text entries are buttons with accessible names and stable identifiers. Press feedback is brief and restrained. Reduced Motion removes the scale effect. Large accessibility text changes the library grid to one column; long titles expand rather than truncate. Small icon controls retain system hit targets. The light secondary text is `#607264`, with a measured 4.66:1 contrast against the `#F1F5F1` card face. Dark secondary text is `#ADBBB0`, with 7.38:1 contrast against `#222A24`. These color checks do not constitute a complete accessibility audit.

Keep native selection handles and Copy. Define belongs in the selection menu and paragraph accessibility actions. Compact definitions use a native sheet; iPad definitions use an anchored popover. Presentations preserve the reader and playback state. Leaving the source reader stops playback.

## Scope and verification

Libraries and texts are explicitly local preview data. Sign-in, account libraries, contextual generation, vocabulary saving, imports, and production recordings are not connected. Do not add nonfunctional create/import/print/share controls merely because they appear on the web.

Review actual iPhone and iPad screenshots, long titles, large text, dark appearance, selection, and back navigation. Automated accessibility queries do not replace a physical VoiceOver review. Current results and remaining delivery gates belong in `verification.md`.
