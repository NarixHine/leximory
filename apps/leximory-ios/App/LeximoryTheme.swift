import SwiftUI

enum LeximoryPalette {
    static let sage = Color(uiColor: adaptive(light: 0x5A715A, dark: 0xA7B9AB))
    static let paperUI = adaptive(light: 0xFFFFFF, dark: 0x100F0F)
    static let paper = Color(uiColor: paperUI)
    static let ink = Color(uiColor: adaptive(light: 0x192024, dark: 0xF1F3EF))
    static let muted = Color(uiColor: adaptive(light: 0x67787C, dark: 0xADBBB0))
    static let border = Color(uiColor: adaptive(light: 0xD9E8BF, dark: 0x4A6039))
    static let secondaryBorder = Color(uiColor: adaptive(light: 0xD0D6D8, dark: 0x445052))
    static let secondaryLabel = Color(uiColor: adaptive(light: 0x9CA8AB, dark: 0xADBBB0))
    static let cover = Color(uiColor: adaptive(light: 0xF1F5F1, dark: 0x222A24))
    static let shell = Color(uiColor: adaptive(light: 0xF8FAF8, dark: 0x1A211C))
    static let illustration = Color(uiColor: adaptive(light: 0x9CAEA1, dark: 0x90A695))

    static let wordHighlightUI = adaptive(light: 0xBDD981, dark: 0x91B75B).withAlphaComponent(0.45)

    static var readingFont: UIFont {
        UIFontMetrics(forTextStyle: .body).scaledFont(for: LeximoryTypography.proseUI(20))
    }

    static func serif(_ style: UIFont.TextStyle) -> UIFont {
        let size: CGFloat = style == .largeTitle ? 34 : style == .title2 ? 24 : 20
        return UIFontMetrics(forTextStyle: style).scaledFont(for: LeximoryTypography.editorialUI(size))
    }

    private static func adaptive(light: UInt32, dark: UInt32) -> UIColor {
        UIColor { traits in
            let value = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((value >> 16) & 255) / 255,
                           green: CGFloat((value >> 8) & 255) / 255,
                           blue: CGFloat(value & 255) / 255, alpha: 1)
        }
    }
}

enum LeximoryTypography {
    static func face(_ name: String, size: CGFloat) -> UIFont {
        // Bundled faces are verified by the native test target.
        UIFont(name: name, size: size)!
    }
    static func editorialUI(_ size: CGFloat, language: String? = nil) -> UIFont {
        let name = language == "Japanese" ? "NotoSerifJP-Regular" : language == "Chinese" ? "NotoSerifSC-Medium" : "EBGaramond-Regular"
        let fallback = UIFontDescriptor(name: language == "Japanese" ? "NotoSerifJP-Regular" : "NotoSerifSC-Medium", size: size)
        return UIFont(descriptor: face(name, size: size).fontDescriptor.addingAttributes([.cascadeList: [fallback]]), size: size)
    }
    static func proseUI(_ size: CGFloat, language: String? = nil) -> UIFont {
        let name = language == "Japanese" ? "NotoSerifJP-Regular" : language == "Chinese" ? "NotoSerifSC-Medium" : "LibreBaskerville-Regular"
        return UIFont(descriptor: face(name, size: size).fontDescriptor.addingAttributes([
            .cascadeList: [UIFontDescriptor(name: "NotoSerifSC-Medium", size: size)]
        ]), size: size)
    }
    static func prose(_ size: CGFloat, language: String? = nil) -> Font {
        Font(UIFontMetrics(forTextStyle: .body).scaledFont(for: proseUI(size, language: language)))
    }
    static func interfaceUI(_ size: CGFloat, semibold: Bool = false) -> UIFont {
        let fallback = UIFontDescriptor(name: semibold ? "NotoSerifSC-SemiBold" : "NotoSerifSC-Medium", size: size)
        let latin = face(semibold ? "RalewayRoman-SemiBold" : "RalewayRoman-Regular", size: size)
        return UIFont(descriptor: latin.fontDescriptor.addingAttributes([.cascadeList: [fallback]]), size: size)
    }
    static func interface(_ size: CGFloat, semibold: Bool = false, style: UIFont.TextStyle = .body) -> Font {
        Font(UIFontMetrics(forTextStyle: style).scaledFont(for: interfaceUI(size, semibold: semibold)))
    }
}

private struct EditorialTypography: ViewModifier {
    @ScaledMetric private var size: CGFloat
    let language: String?
    init(size: CGFloat, style: Font.TextStyle, language: String?) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.language = language
    }
    func body(content: Content) -> some View {
        content.font(Font(LeximoryTypography.editorialUI(size, language: language)))
    }
}

extension View {
    func editorialFont(_ size: CGFloat, relativeTo style: Font.TextStyle = .title, language: String? = "Chinese") -> some View {
        modifier(EditorialTypography(size: size, style: style, language: language))
    }
}


enum LeximoryLayout {
    static let pageInset: CGFloat = 20
    static let cardInset: CGFloat = 14
    static let cardTitleBottom: CGFloat = 16
    static let cardRadius: CGFloat = 46
    static let innerCardRadius: CGFloat = 32
    static let readingMeasure: CGFloat = 680
}
