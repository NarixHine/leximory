import SwiftUI

struct LeximoryUnavailableView<Actions: View>: View {
    let title: String
    let systemImage: String
    let message: String?
    let actions: Actions

    init(_ title: String, systemImage: String, message: String? = nil, @ViewBuilder actions: () -> Actions) {
        self.title = title
        self.systemImage = systemImage
        self.message = message
        self.actions = actions()
    }

    var body: some View {
        ContentUnavailableView {
            Label {
                Text(title).font(LeximoryTypography.interface(24, semibold: true, style: .title2))
            } icon: {
                Image(systemName: systemImage)
            }
        } description: {
            if let message {
                Text(message).font(LeximoryTypography.interface(17))
            }
        } actions: {
            actions.font(LeximoryTypography.interface(17))
        }
    }
}

extension LeximoryUnavailableView where Actions == EmptyView {
    init(_ title: String, systemImage: String, message: String? = nil) {
        self.init(title, systemImage: systemImage, message: message) { EmptyView() }
    }
}

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

    static let readingInkUI = adaptive(light: 0x434943, dark: 0xC2C6BF)

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
        let name = language == "Japanese" ? "ChillDuanHeiSongProJP_Regular" : language == "Chinese" ? "ChillDuanHeiSongPro_Regular" : "EBGaramond-Regular"
        let fallback = UIFontDescriptor(name: language == "Japanese" ? "ChillDuanHeiSongProJP_Regular" : "ChillDuanHeiSongPro_Regular", size: size)
        return UIFont(descriptor: face(name, size: size).fontDescriptor.addingAttributes([.cascadeList: [UIFontDescriptor(name: "AppleColorEmoji", size: size), fallback]]), size: size)
    }
    static func proseUI(_ size: CGFloat, language: String? = nil) -> UIFont {
        let name = language == "Japanese" ? "ChillDuanHeiSongProJP_Regular" : language == "Chinese" ? "ChillDuanHeiSongPro_Regular" : "LibreBaskerville-Regular"
        return UIFont(descriptor: face(name, size: size).fontDescriptor.addingAttributes([
            .cascadeList: [UIFontDescriptor(name: "AppleColorEmoji", size: size), UIFontDescriptor(name: "ChillDuanHeiSongPro_Regular", size: size)]
        ]), size: size)
    }
    static func prose(_ size: CGFloat, language: String? = nil) -> Font {
        Font(UIFontMetrics(forTextStyle: .body).scaledFont(for: proseUI(size, language: language)))
    }
    static func interfaceUI(_ size: CGFloat, semibold: Bool = false) -> UIFont {
        let fallback = UIFontDescriptor(name: "ChillDuanHeiSongPro_Regular", size: size)
        let latin = face(semibold ? "RalewayRoman-SemiBold" : "RalewayRoman-Regular", size: size)
        return UIFont(descriptor: latin.fontDescriptor.addingAttributes([.cascadeList: [UIFontDescriptor(name: "AppleColorEmoji", size: size), fallback]]), size: size)
    }
    static func interface(_ size: CGFloat, semibold: Bool = false, style: UIFont.TextStyle = .body) -> Font {
        Font(UIFontMetrics(forTextStyle: style).scaledFont(for: interfaceUI(size, semibold: semibold)))
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
    func editorialFont(_ size: CGFloat, relativeTo style: Font.TextStyle = .title, language: String? = "Chinese", leading: Font.Leading = .standard) -> some View {
        modifier(EditorialTypography(size: size, style: style, language: language, leading: leading))
    }
}


enum LeximoryLayout {
    static let pageInset: CGFloat = 20
    static let cardInset: CGFloat = 14
    static let cardTitleBottom: CGFloat = 16
    static let cardRadius: CGFloat = 46
    static let innerCardRadius: CGFloat = 32
    static let readingMeasure: CGFloat = 560
    static let libraryMeasure: CGFloat = 640
    static let textGalleryMeasure: CGFloat = 880
}
