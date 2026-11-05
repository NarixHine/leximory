# Review meadow artwork

The built-in image generation tool created the opaque day/night pair on 2026-11-05, using the Home wallpapers for style and the approved lawn palette for color. Both masters are landscape 4:3, with grass continuing through every edge. They replace the transparent cutout assets.

## Files and adaptation

- Day: `apps/leximory-ios/App/Resources/Assets.xcassets/ReviewMeadowLight.imageset/meadow.png`
- Night: `apps/leximory-ios/App/Resources/Assets.xcassets/ReviewMeadowDark.imageset/meadow.png`

Use aspect-fill without extra zoom. Rotate the master 90 degrees for portrait, producing a 3:4 iPad composition. Taller iPhones and narrower windows use its center crop. The middle 60% remains quiet and contains a few small botanical details so the phone crop is a complete composition. The background remains stationary when tasks scroll or the keyboard opens; task and cat bounds stay independent of artwork cropping.

## Day prompt

References: HomeWallpaperLight and the approved lighter review lawn.

> Create a production FULL-SCREEN overhead meadow background for Leximory iOS, landscape iPad master canvas, 4:3 aspect ratio, ideally 2048x1536. Image 1 is the original Home wallpaper: match its refined painterly environmental illustration style and fine observed botanical detail. Image 2 is the approved lawn color reference: retain its airy luminous spring celadon, pale yellow-green and sunlit cream palette with very restrained cool sage shadows. Completely new rectangular edge-to-edge composition, not a cutout. True straight-down birds-eye view of continuous short soft grass, naturally varied fine tapered blades, scattered delicate white wildflowers and a few tiny clover clusters. Fresh gentle morning light; quiet low-contrast spacious center under floating word pills and a walking cat. Slightly more botanical detail toward the outer thirds, without a dense flower frame. Grass must continue naturally through all FOUR canvas edges, fully opaque, no pale perimeter, no white margin, no irregular silhouette, no transparency, no vignette, no fading. Do not copy the old cutout boundary. Avoid dull olive/khaki, heavy grey-green midtones, repetitive diagonal bands, giant plants, coarse texture, blurry watercolor washes. This master is also rotated 90 degrees for portrait iPad and center-cropped for tall iPhones: keep the middle 60% composition self-contained and restful, with a few restrained botanical details still visible there; do not put all flowers in the extreme corners. Consistent small botanical scale throughout. No sky, horizon, hills, paths, rocks, cats, animals, text, interface or border. Deliver a polished opaque PNG with the entire 4:3 rectangle painted. Save output and report its local file path.

## Night prompt

References: finished day master, HomeWallpaperDark and the approved blue-slate review lawn.

> Create the matching NIGHT appearance of image 1, the finished Leximory full-screen overhead meadow. Image 2 is Leximory's Home night wallpaper and sets the rendering and nighttime light; image 3 is the approved review night palette reference, retain its clear atmospheric blue-slate/indigo and delicate warm ivory flower accents, avoiding muddy green-black. Keep image 1's exact 4:3 landscape composition, grass scale, plant and flower positions, quiet center and continuous edge-to-edge field. Fully opaque rectangular full-screen iPad wallpaper, ideally 2048x1536, no transparent exterior, no cutout, no pale border, no edge treatment, no vignette or opacity fade. Fine blue-sage grass under soft cool ambient night light; readable but restrained midtones, small subtle warm accents on a few flowers. Do not crush the grass to black, oversaturate cyan or add dramatic beams. The center and middle 60% must remain restful and self-contained when rotated for portrait iPad and center-cropped for tall iPhones. Natural botanical detail should run through all four canvas edges. Straight-down overhead view only, no sky, horizon, hills, paths, rocks, cats, text or UI. Same painterly artist as the Home wallpaper and same field as image 1. Deliver a polished opaque PNG and report local saved path.
