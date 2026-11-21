import Foundation

public enum PDFHighlightExcerpt {
    public static func reflow(_ quote: String, language: String) -> String {
        let language = learningLanguageName(language)
        let usesCJKSpacing = language == "Chinese" || language == "Japanese"

        return quote.replacing(#/(\u{00AD})?[ \t\u{3000}]*(?:\R[ \t\u{3000}]*)+/#) { match in
            let left = quote[..<match.range.lowerBound]
            guard match.1 == nil, let before = left.last, let after = quote[match.range.upperBound...].first else {
                return ""
            }

            if before.isWhitespace || after.isWhitespace || joinsWithoutSpace(before, after) {
                return ""
            }

            let cjkBefore = isHanKanaOrFullwidth(before)
            let cjkAfter = isHanKanaOrFullwidth(after)
            if cjkBefore && cjkAfter || usesCJKSpacing && (cjkBefore || cjkAfter) {
                return ""
            }

            if "-‐‑".contains(before), let preceding = left.dropLast().last,
               preceding.isLetter || preceding.isNumber, after.isLetter || after.isNumber {
                return ""
            }

            if language == "French" {
                if "'’".contains(before), after.isLetter || after == "«", endsWithFrenchElision(left.dropLast()) {
                    return ""
                }
                if "'’".contains(after), endsWithFrenchElision(left) {
                    return ""
                }
                if before == "«" || after == "»" || after == ":" {
                    return "\u{00A0}"
                }
                if ";!?".contains(after), !";!?".contains(before) {
                    return "\u{202F}"
                }
            }

            switch before.unicodeScalars.first?.properties.generalCategory {
            case .openPunctuation, .initialPunctuation: return ""
            default: break
            }
            switch after.unicodeScalars.first?.properties.generalCategory {
            case .closePunctuation, .finalPunctuation: return ""
            default: return ",.!?:;…".contains(after) ? "" : " "
            }
        }
    }

    private static func isHanKanaOrFullwidth(_ character: Character) -> Bool {
        String(character).prefixMatch(of: #/[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\u{FF01}-\u{FF60}]/#) != nil
    }

    private static func endsWithFrenchElision(_ text: Substring) -> Bool {
        text.contains(#/\b(?:[cdjlmnst]|aujourd|entr|grand|jusqu|lorsqu|presqu|prud|puisqu|qu|quelqu|quoiqu)$/#.ignoresCase())
    }

    private static func joinsWithoutSpace(_ before: Character, _ after: Character) -> Bool {
        let joiners: Set<Unicode.Scalar> = ["\u{200B}", "\u{200C}", "\u{200D}", "\u{2060}", "\u{FEFF}"]
        return before.unicodeScalars.last.map(joiners.contains) == true
            || after.unicodeScalars.first.map(joiners.contains) == true
            || String(after).prefixMatch(of: #/\p{M}/#) != nil
    }
}
