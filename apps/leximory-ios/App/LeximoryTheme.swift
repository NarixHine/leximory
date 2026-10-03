import SwiftUI

enum LeximoryPalette {
    static let sage = Color(uiColor: adaptive(light: 0x5A715A, dark: 0xA7B9AB))
    static let paperUI = adaptive(light: 0xFFFFFF, dark: 0x100F0F)
    static let paper = Color(uiColor: paperUI)
    static let ink = Color(uiColor: adaptive(light: 0x192024, dark: 0xF1F3EF))
    static let muted = Color(uiColor: adaptive(light: 0x607264, dark: 0xADBBB0))
    static let cover = Color(uiColor: adaptive(light: 0xF1F5F1, dark: 0x222A24))
    static let shell = Color(uiColor: adaptive(light: 0xF8FAF8, dark: 0x1A211C))
    static let illustration = Color(uiColor: adaptive(light: 0x9CAEA1, dark: 0x90A695))

    static func editorial(_ size: CGFloat, relativeTo style: Font.TextStyle = .title, language: String? = nil) -> Font {
        let name = language == "Japanese" ? "NotoSerifJP-Regular" : language == "Chinese" ? "LXGWWenKaiScreen" : "EBGaramond-Regular"
        return .custom(name, size: size, relativeTo: style)
    }
    static let wordHighlightUI = adaptive(light: 0xE7ECE7, dark: 0x343C35)

    static var readingFont: UIFont {
        let descriptor = UIFont.systemFont(ofSize: 20).fontDescriptor
        let serif = UIFont(descriptor: descriptor.withDesign(.serif) ?? descriptor, size: 20)
        return UIFontMetrics(forTextStyle: .body).scaledFont(for: serif)
    }

    static func serif(_ style: UIFont.TextStyle) -> UIFont {
        let base = UIFont.preferredFont(forTextStyle: style)
        return UIFont(descriptor: base.fontDescriptor.withDesign(.serif) ?? base.fontDescriptor, size: 0)
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
