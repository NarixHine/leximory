import SwiftUI
import LeximoryCore

struct BrowserHomeView: View {
    let compact: Bool
    let recent: CatalogText?
    let browse: () -> Void
    let bookmarks: () -> Void
    let ebook: () -> Void
    let account: () -> Void
    let resume: (CatalogText) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.colorScheme) private var colorScheme
    var body: some View {
        GeometryReader { geometry in
            let squares = geometry.size.width >= 760 && !compact && !typeSize.isAccessibilitySize
            let folded = compact && !typeSize.isAccessibilitySize && geometry.size.height > 260
            ScrollView {
                VStack(spacing: folded ? 18 : 36) {
                    HStack(spacing: 12) {
                        if let icon = UIImage(named: "leximory-icon.png") {
                            Image(uiImage: icon).resizable().scaledToFit().frame(width: 40, height: 40)
                                .clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityHidden(true)
                        }
                        Text("Leximory").editorialFont(34, relativeTo: .title, language: nil)
                        Spacer()
                        Button("账号", systemImage: "person.crop.circle", action: account)
                            .labelStyle(.iconOnly).font(.title2).frame(width: 48, height: 48)
                    }.padding(.bottom, folded ? 0 : 18)
                    let layout = squares ? AnyLayout(HStackLayout(spacing: 24)) : AnyLayout(VStackLayout(spacing: folded ? 10 : 20))
                    layout {
                        card("浏览网页", symbol: "globe", color: tone(0xDFE7FD, 0x283244), border: tone(0x7484AD, 0x8798BF), angle: -3, folded: folded, square: squares, action: browse)
                        card("我的书签", symbol: "bookmark.fill", color: tone(0xFDE2E4, 0x442C34), border: tone(0xAC7A85, 0xC1939F), angle: 2.5, folded: folded, square: squares, action: bookmarks)
                        card("打开电子书", symbol: "book.closed.fill", color: tone(0xFFF1E6, 0x3E332C), border: tone(0xAC8A70, 0xBDA08B), angle: -1.5, folded: folded, square: squares, action: ebook)
                    }.padding(.horizontal, folded ? 0 : 8)
                    if let recent, !compact {
                        Button { resume(recent) } label: {
                            VStack(spacing: 6) {
                                Text("继续阅读").font(LeximoryTypography.interface(13, style: .caption1)).foregroundStyle(.secondary)
                                Text(recent.title).editorialFont(20, relativeTo: .headline, language: nil).foregroundStyle(.primary).lineLimit(2)
                            }.frame(maxWidth: .infinity, minHeight: 44)
                        }.buttonStyle(.plain)
                    }
                }.padding(.horizontal, 28).padding(.top, folded ? 20 : max(28, min(80, geometry.size.height * 0.10)))
                    .padding(.bottom, 110).frame(maxWidth: squares ? LeximoryLayout.textGalleryMeasure : 530).frame(maxWidth: .infinity)
            }.scrollBounceBehavior(.basedOnSize)
        }
        .animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.86), value: compact)
        .tint(.primary)
        .accessibilityIdentifier("browser-home")
    }
    private func tone(_ light: UInt32, _ dark: UInt32) -> Color {
        let value = colorScheme == .dark ? dark : light
        return Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
    private func card(_ title: String, symbol: String, color: Color, border: Color, angle: Double, folded: Bool, square: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            cardLabel(title, symbol: symbol, folded: folded, square: square)
                .foregroundStyle(LeximoryPalette.ink)
                .background(color, in: RoundedRectangle(cornerRadius: folded ? 22 : 30))
                .overlay { RoundedRectangle(cornerRadius: folded ? 22 : 30).strokeBorder(border, lineWidth: 3) }
                .shadow(color: colorScheme == .dark ? .black.opacity(0.16) : border.opacity(0.16), radius: folded ? 3 : 10, y: folded ? 2 : 6)
        }.buttonStyle(BrowserCardButtonStyle()).rotationEffect(.degrees(folded || typeSize.isAccessibilitySize ? 0 : angle))
    }
    @ViewBuilder private func cardLabel(_ title: String, symbol: String, folded: Bool, square: Bool) -> some View {
        if square {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    Image(systemName: symbol).font(.system(size: 38, weight: .medium))
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.up.right").font(.body.weight(.medium))
                }
                Spacer(minLength: 16)
                Text(title).font(LeximoryTypography.interface(24, style: .title2)).fixedSize(horizontal: false, vertical: true)
            }.padding(24).frame(maxWidth: .infinity).aspectRatio(1, contentMode: .fit)
        } else {
            HStack(spacing: 20) {
                Image(systemName: symbol).font(.system(size: folded ? 24 : 34, weight: .medium)).frame(width: 44)
                Text(title).font(LeximoryTypography.interface(folded ? 17 : 24, style: folded ? .headline : .title2))
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").font(.body.weight(.medium))
            }.padding(.horizontal, 24).padding(.vertical, folded ? 14 : 30)
                .frame(maxWidth: .infinity, minHeight: 58)
        }
    }
}

private struct BrowserCardButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .animation(reduceMotion ? nil : .spring(response: 0.22, dampingFraction: 0.75), value: configuration.isPressed)
    }
}
