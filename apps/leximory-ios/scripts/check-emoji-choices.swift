// Run: swift scripts/check-emoji-choices.swift App/Resources/Fonts/LeximoryNotoEmoji.ttf ../leximory/lib/emoji.ts
import Foundation
import CoreText
let fontURL = URL(fileURLWithPath: CommandLine.arguments[1])
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
let font = CTFontCreateWithName("LeximoryNotoEmoji" as CFString, 60, nil)
let source = try String(contentsOfFile: CommandLine.arguments[2], encoding: .utf8)
let regex = try NSRegularExpression(pattern: "'([^']+)'")
var unsupported: [String] = []
for match in regex.matches(in: source, range: NSRange(source.startIndex..., in: source)) {
    let emoji = String(source[Range(match.range(at: 1), in: source)!])
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: emoji, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font]))
    var supported = true
    for run in CTLineGetGlyphRuns(line) as! [CTRun] {
        let usedFont = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
        var glyphs = [CGGlyph](repeating: 0, count: CTRunGetGlyphCount(run))
        CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
        if CTFontCopyPostScriptName(usedFont) != CTFontCopyPostScriptName(font) || glyphs.contains(0) { supported = false }
    }
    if !supported { unsupported.append(emoji) }
}

if !unsupported.isEmpty {
    print("Candidates that fall back outside the bundled font: \(unsupported.joined(separator: ", "))")
    exit(1)
}
print("All emoji candidates render in the bundled monochrome font.")
