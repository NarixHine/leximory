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
    static let sage = Color(uiColor: adaptive(light: 0x5A715A, dark: 0xA1A1AA))
    static let paperUI = adaptive(light: 0xFFFFFF, dark: 0x100F0F)
    static let paper = Color(uiColor: paperUI)
    static let ink = Color(uiColor: adaptive(light: 0x192024, dark: 0xCECDC3))
    static let muted = Color(uiColor: adaptive(light: 0x67787C, dark: 0xA1A1AA))
    static let border = Color(uiColor: adaptive(light: 0xD9E8BF, dark: 0x3F3F46))
    static let secondaryBorder = Color(uiColor: adaptive(light: 0xD0D6D8, dark: 0x3F3F46))
    static let secondaryLabel = Color(uiColor: adaptive(light: 0x9CA8AB, dark: 0xA1A1AA))
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
        let font = editorialUI(size)
        guard semibold, let descriptor = font.fontDescriptor.withSymbolicTraits(.traitBold) else { return font }
        return UIFont(descriptor: descriptor, size: size)
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
    static let readingMeasure: CGFloat = 640
    static let annotationMeasure: CGFloat = 512
    static let libraryMeasure: CGFloat = 640
    static let textGalleryMeasure: CGFloat = 880
}

/// Uses the web's lawn artwork and three running sprite frames.
struct ReadingLoadingIndicator: View {
    let label: String
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var origin = Date()
    @State private var showsScene = false
    init(_ label: String) { self.label = label }

    var body: some View {
        GeometryReader { geometry in
            let width = min(560, geometry.size.width * 0.8, max(224, geometry.size.height * 0.58))
            VStack(spacing: 20) {
                if showsScene { lawn(width: width); caption }
            }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityIdentifier(showsScene ? "reading-loading-scene" : "reading-loading-pending")
        .task {
            do { try await Task.sleep(for: .milliseconds(200)) } catch { return }
            guard !Task.isCancelled else { return }
            origin = Date()
            showsScene = true
        }
    }
    private var caption: some View {
        Text(label).font(LeximoryTypography.interface(17))
            .foregroundStyle(LeximoryPalette.muted)
            .fixedSize(horizontal: true, vertical: false)
    }
    private func lawn(width: CGFloat) -> some View {
        let height = width * 0.56
        return TimelineView(.animation(minimumInterval: 1.0 / 30,
            paused: reduceMotion || scenePhase != .active)) { context in
            let time = reduceMotion ? 0 : context.date.timeIntervalSince(origin)
            let phase = time.truncatingRemainder(dividingBy: 4)
            let outward = phase < 2
            let distance = (1 - cos(phase * .pi / 2)) / 2
            let turn = min(1, max(0, (phase.truncatingRemainder(dividingBy: 2) - 1.8) / 0.2))
            let facing = outward ? turn * 180 : 180 - turn * 180
            ZStack {
                Image(uiImage: UIImage(named: scheme == .dark ? "lawn-night.png" : "lawn.png") ?? UIImage())
                    .resizable().scaledToFit()
                if let image = CatFrames.frames[reduceMotion ? 0 : 3 + Int(time * 8) % 3] {
                    Image(uiImage: image).resizable().scaledToFit()
                        .frame(width: width * 0.32, height: width * 0.32 * 256 / 469)
                        .rotation3DEffect(.degrees(facing), axis: (x: 0, y: 1, z: 0))
                        .position(x: width * (0.27 + distance * 0.46), y: height * 0.63)
                }
            }.frame(width: width, height: height)
        }.accessibilityHidden(true)
    }
}
