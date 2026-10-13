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
    var body: some View {
        GeometryReader { geometry in
            let folded = compact && !typeSize.isAccessibilitySize && geometry.size.height > 260
            ScrollView {
                VStack(spacing: folded ? 18 : 36) {
                    HStack(spacing: 12) {
                        if let icon = UIImage(named: "leximory-icon.png") {
                            Image(uiImage: icon).resizable().scaledToFit().frame(width: 40, height: 40)
                                .clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityHidden(true)
                        }
                        Text("Leximory").font(LeximoryTypography.interface(30, semibold: true, style: .title1))
                        Spacer()
                        Button("账号", systemImage: "person.crop.circle", action: account)
                            .labelStyle(.iconOnly).font(.title2).frame(width: 48, height: 48)
                    }.padding(.bottom, folded ? 0 : 18)
                    VStack(spacing: folded ? 10 : 20) {
                        card("浏览网页", symbol: "globe", color: .init(red: 0.74, green: 0.83, blue: 1), border: .init(red: 0.38, green: 0.47, blue: 0.85), angle: -3, folded: folded, action: browse)
                        card("我的书签", symbol: "bookmark.fill", color: .init(red: 0.89, green: 0.79, blue: 1), border: .init(red: 0.62, green: 0.40, blue: 0.80), angle: 2.5, folded: folded, action: bookmarks)
                        card("打开电子书", symbol: "book.closed.fill", color: .init(red: 1, green: 0.86, blue: 0.64), border: .init(red: 0.84, green: 0.52, blue: 0.24), angle: -1.5, folded: folded, action: ebook)
                    }.padding(.horizontal, folded ? 0 : 8)
                    if let recent, !compact {
                        Button { resume(recent) } label: {
                            VStack(spacing: 6) {
                                Text("继续阅读").font(.caption).foregroundStyle(.secondary)
                                Text(recent.title).font(.subheadline).foregroundStyle(.primary).lineLimit(2)
                            }.frame(maxWidth: .infinity, minHeight: 44)
                        }.buttonStyle(.plain)
                    }
                }.padding(.horizontal, 28).padding(.top, folded ? 20 : max(28, min(80, geometry.size.height * 0.10)))
                    .padding(.bottom, 110).frame(maxWidth: 530).frame(maxWidth: .infinity)
            }.scrollBounceBehavior(.basedOnSize)
        }
        .animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.86), value: compact)
        .tint(.primary)
        .accessibilityIdentifier("browser-home")
    }
    private func card(_ title: String, symbol: String, color: Color, border: Color, angle: Double, folded: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 20) {
                Image(systemName: symbol).font(.system(size: folded ? 24 : 34, weight: .medium)).frame(width: 44)
                Text(title).font(.system(folded ? .headline : .title2, design: .rounded, weight: .semibold))
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").font(.body.weight(.medium))
            }
            .foregroundStyle(Color(red: 0.16, green: 0.15, blue: 0.20))
            .padding(.horizontal, 24).padding(.vertical, folded ? 14 : 30)
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(color, in: RoundedRectangle(cornerRadius: folded ? 22 : 30))
            .overlay { RoundedRectangle(cornerRadius: folded ? 22 : 30).strokeBorder(border, lineWidth: 3) }
            .shadow(color: border.opacity(0.16), radius: folded ? 3 : 10, y: folded ? 2 : 6)
        }.buttonStyle(BrowserCardButtonStyle()).rotationEffect(.degrees(folded || typeSize.isAccessibilitySize ? 0 : angle))
    }
}

private struct BrowserCardButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .animation(reduceMotion ? nil : .spring(response: 0.22, dampingFraction: 0.75), value: configuration.isPressed)
    }
}
