import SwiftUI

enum LeximoryPalette {
    static let sage = Color(uiColor: adaptive(light: 0x5A715A, dark: 0xA1A1AA))
    static let paperUI = adaptive(light: 0xFFFFFF, dark: 0x100F0F)
    static let paper = Color(uiColor: paperUI)
    static let ink = Color(uiColor: .label)
    static let muted = Color(uiColor: .secondaryLabel)
    static let border = Color(uiColor: adaptive(light: 0xD9E8BF, dark: 0x3F3F46))
    static let secondaryBorder = Color(uiColor: adaptive(light: 0xD0D6D8, dark: 0x3F3F46))
    static let secondaryLabel = Color(uiColor: .secondaryLabel)
    static let cover = Color(uiColor: adaptive(light: 0xF1F5F1, dark: 0x27272A))
    static let shell = Color(uiColor: adaptive(light: 0xF8FAF8, dark: 0x18181B))
    static let annotationSurface = Color(uiColor: adaptive(light: 0xFAFAFA, dark: 0x18181B))
    static let illustration = Color(uiColor: adaptive(light: 0x9CAEA1, dark: 0x878580))

    static let wordHighlightUI = adaptive(light: 0xBDD981, dark: 0x878580).withAlphaComponent(0.45)

    static let readingInkUI = adaptive(light: 0x434943, dark: 0xCECDC3)

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
    static let addressSize: CGFloat = 18
    static let chineseGlyphScale: CGFloat = 0.85
    static let chineseDisplayScale: CGFloat = 1.2
    static var addressUI: UIFont {
        UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: editorialUI(addressSize))
    }

    static func scaledChineseText(_ string: String, size: CGFloat) -> AttributedString {
        var text = AttributedString(string)
        text.font = Font(editorialUI(size))
        let chinese = Font(editorialUI(size * chineseGlyphScale, language: "Chinese"))
        for index in text.characters.indices where isChinese(text.characters[index]) {
            text[index..<text.characters.index(after: index)].font = chinese
        }
        return text
    }

    private static func isChinese(_ character: Character) -> Bool {
        character.unicodeScalars.contains {
            (0x3400...0x9FFF).contains($0.value) || (0xF900...0xFAFF).contains($0.value)
                || (0x20000...0x323AF).contains($0.value) || (0x3000...0x303F).contains($0.value)
                || (0xFF01...0xFF60).contains($0.value)
        }
    }

    static func face(_ name: String, size: CGFloat) -> UIFont {
        // Bundled faces are verified by the native test target.
        UIFont(name: name, size: size)!
    }
    static func editorialUI(_ size: CGFloat, language: String? = nil) -> UIFont {
        let fallbacks = language == "Japanese"
            ? ["ChillDuanHeiSongProJP_Regular", "ChillDuanHeiSongRegular"]
            : ["ChillDuanHeiSongRegular", "ChillDuanHeiSongProJP_Regular"]
        return UIFont(descriptor: face("EBGaramond-Regular", size: size).fontDescriptor.addingAttributes([
            .cascadeList: [UIFontDescriptor(name: "AppleColorEmoji", size: size)]
                + fallbacks.map { UIFontDescriptor(name: $0, size: size) }
        ]), size: size)
    }

    /// Only for fixed Chinese UI display labels, never user or imported content.
    static func displayUI(_ size: CGFloat) -> UIFont {
        let chinese = UIFontDescriptor(name: "Fontquan-XinYiJiXiangSong-Regular", size: size)
            .addingAttributes([.matrix: NSValue(cgAffineTransform: CGAffineTransform(scaleX: chineseDisplayScale, y: chineseDisplayScale))])
        return UIFont(descriptor: face("EBGaramond-Regular", size: size).fontDescriptor.addingAttributes([
            .cascadeList: [UIFontDescriptor(name: "AppleColorEmoji", size: size), chinese]
        ]), size: size)
    }
    static func proseUI(_ size: CGFloat, language: String? = nil, bold: Bool = false) -> UIFont {
        let name = language == "Japanese" ? "ChillDuanHeiSongProJP_Regular" : language == "Chinese" ? (bold ? "ChillDuanHeiSongBold" : "ChillDuanHeiSongRegular") : "LibreBaskerville-Regular"
        var font = face(name, size: size)
        if bold, language != "Chinese",
           let descriptor = font.fontDescriptor.withSymbolicTraits(.traitBold) {
            font = UIFont(descriptor: descriptor, size: size)
        }
        return UIFont(descriptor: font.fontDescriptor.addingAttributes([
            .cascadeList: [UIFontDescriptor(name: "AppleColorEmoji", size: size), UIFontDescriptor(name: bold ? "ChillDuanHeiSongBold" : "ChillDuanHeiSongRegular", size: size)]
        ]), size: size)
    }
    static func prose(_ size: CGFloat, language: String? = nil, bold: Bool = false) -> Font {
        Font(UIFontMetrics(forTextStyle: .body).scaledFont(for: proseUI(size, language: language, bold: bold)))
    }
    static func interfaceUI(_ size: CGFloat, semibold: Bool = false) -> UIFont {
        let latin = face(semibold ? "Urbanist-SemiBold" : "Urbanist-Regular", size: size)
        return UIFont(descriptor: latin.fontDescriptor.addingAttributes([
            .cascadeList: [UIFontDescriptor(name: "AppleColorEmoji", size: size),
                           UIFontDescriptor(name: semibold ? "ChillDuanHeiSongBold" : "ChillDuanHeiSongRegular", size: size),
                           UIFontDescriptor(name: "ChillDuanHeiSongProJP_Regular", size: size)]
        ]), size: size)
    }
    static func textStyle(_ style: UIFont.TextStyle) -> Font.TextStyle {
        switch style {
        case .largeTitle: .largeTitle
        case .title1: .title
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .subheadline: .subheadline
        case .callout: .callout
        case .footnote: .footnote
        case .caption1: .caption
        case .caption2: .caption2
        default: .body
        }
    }
}

private struct InterfaceTypography: ViewModifier {
    @ScaledMetric private var size: CGFloat
    let semibold: Bool

    init(size: CGFloat, semibold: Bool, style: UIFont.TextStyle) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: LeximoryTypography.textStyle(style))
        self.semibold = semibold
    }

    func body(content: Content) -> some View {
        content.font(Font(LeximoryTypography.interfaceUI(size, semibold: semibold)))
    }
}

private struct DisplayTypography: ViewModifier {
    @ScaledMetric private var size: CGFloat

    init(size: CGFloat, style: Font.TextStyle) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
    }

    func body(content: Content) -> some View {
        content.font(Font(LeximoryTypography.displayUI(size)))
    }
}

private struct EditorialTypography: ViewModifier {
    @ScaledMetric private var size: CGFloat
    let language: String?
    let leading: Font.Leading
    init(size: CGFloat, style: Font.TextStyle, language: String?, leading: Font.Leading) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.language = language
        self.leading = leading
    }
    func body(content: Content) -> some View {
        content.font(Font(LeximoryTypography.editorialUI(size, language: language)).leading(leading))
    }
}

extension View {
    /// Fixed Chinese UI headings and action-card labels only.
    func displayFont(_ size: CGFloat, relativeTo style: Font.TextStyle = .title) -> some View {
        modifier(DisplayTypography(size: size, style: style))
    }

    func interfaceFont(_ size: CGFloat, semibold: Bool = false, style: UIFont.TextStyle = .body) -> some View {
        modifier(InterfaceTypography(size: size, semibold: semibold, style: style))
    }

    func addressFont() -> some View {
        editorialFont(LeximoryTypography.addressSize, relativeTo: .subheadline, language: nil)
    }

    func editorialFont(_ size: CGFloat, relativeTo style: Font.TextStyle = .title, language: String? = "Chinese", leading: Font.Leading = .standard) -> some View {
        modifier(EditorialTypography(size: size, style: style, language: language, leading: leading))
    }
}

/// Settings-style group titles stay subordinate to the 17-point row labels.
struct LeximorySectionHeader: View {
    let title: String
    init(_ title: String) { self.title = title }
    var body: some View {
        Text(title)
            .interfaceFont(15, semibold: true, style: .subheadline)
            .foregroundStyle(.secondary)
            .textCase(nil)
            .accessibilityAddTraits(.isHeader)
    }
}
