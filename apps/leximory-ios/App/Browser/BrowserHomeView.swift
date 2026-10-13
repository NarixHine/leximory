import SwiftUI
import LeximoryCore

struct BrowserHomeView: View {
    let compact: Bool
    let recent: CatalogText?
    let browse: () -> Void
    let paste: () -> Void
    let recentWebpage: RecentWebpage?
    let openWebpage: (RecentWebpage) -> Void
    let bookmarks: () -> Void
    let ebook: () -> Void
    let account: () -> Void
    var avatarURL: URL? = nil
    let resume: (CatalogText) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.colorScheme) private var colorScheme
    @Namespace private var cardNamespace
    var body: some View {
        Group {
            if compact {
                homeCards(squares: false, folded: true)
                    .padding(.horizontal, 28).padding(.top, 20)
                    .frame(maxWidth: 360).frame(maxWidth: .infinity)
            } else {
        GeometryReader { geometry in
            let squares = geometry.size.width >= 760 && !typeSize.isAccessibilitySize
            ScrollView {
                VStack(spacing: 28) {
                    HStack(spacing: 12) {
                        if let icon = UIImage(named: "leximory-icon.png") {
                            Image(uiImage: icon).resizable().scaledToFit().frame(width: 40, height: 40)
                                .clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityHidden(true)
                        }
                        ViewThatFits(in: .horizontal) {
                            Text("Leximory Browser").fixedSize()
                            Text("Leximory").fixedSize()
                        }.editorialFont(34, relativeTo: .title, language: nil)
                        Spacer()
                        Button(action: account) {
                            AsyncImage(url: avatarURL) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                Image(systemName: "person.crop.circle").resizable().scaledToFit().foregroundStyle(.secondary)
                            }.frame(width: 36, height: 36).clipShape(Circle())
                                .frame(width: 48, height: 48).contentShape(Circle())
                        }.buttonStyle(.plain).accessibilityLabel("账号")
                    }.padding(.bottom, 18)
                    homeCards(squares: squares, folded: false)
                    if let recent, !compact {
                        Button { resume(recent) } label: {
                            VStack(spacing: 6) {
                                Text("继续阅读").editorialFont(16, relativeTo: .headline).foregroundStyle(.secondary)
                                Text(recent.title).editorialFont(20, relativeTo: .headline, language: nil).foregroundStyle(.primary).lineLimit(2)
                            }.multilineTextAlignment(.center).frame(maxWidth: .infinity, minHeight: 44)
                        }.buttonStyle(.plain).accessibilityIdentifier("browser-resume")
                    }
                    if let recentWebpage, !compact {
                        Button { openWebpage(recentWebpage) } label: {
                            VStack(spacing: 6) {
                                Text("最近浏览").editorialFont(16, relativeTo: .headline).foregroundStyle(.secondary)
                                Text(recentWebpage.title).editorialFont(20, relativeTo: .headline, language: nil)
                                    .foregroundStyle(.primary).lineLimit(2)
                            }.multilineTextAlignment(.center).frame(maxWidth: .infinity, minHeight: 44).contentShape(Rectangle())
                        }.buttonStyle(.plain).accessibilityIdentifier("browser-recent-webpage")
                    }

                }.padding(.horizontal, 28).padding(.top, 32)
                    .padding(.bottom, 110).frame(maxWidth: squares ? 560 : 360).frame(maxWidth: .infinity, minHeight: max(0, geometry.size.height - 80), alignment: .center)
            }.scrollBounceBehavior(.basedOnSize)
        }
            }
        }
        .animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.86), value: compact)
        .tint(.primary)
        .accessibilityIdentifier("browser-home")
    }
    private func homeCards(squares: Bool, folded: Bool) -> some View {
        let layout = squares ? AnyLayout(HStackLayout(spacing: -18)) : AnyLayout(VStackLayout(spacing: folded ? 8 : -6))
        return layout {
            card(compact ? "跳转到剪贴板" : "浏览网页", symbol: "globe", color: tone(0xDFE7FD, 0x22252D), border: tone(0xCDDAFD, 0x535A6C), angle: -7, folded: folded, square: squares, action: compact ? paste : browse)
            card("我的书签", symbol: "bookmark.fill", color: tone(0xFDE2E4, 0x2B2427), border: tone(0xFAD2E1, 0x6B555F), angle: 5, folded: folded, square: squares, action: bookmarks)
            card("打开电子书", symbol: "book.closed.fill", color: tone(0xFFF1E6, 0x292723), border: tone(0xEAE4E9, 0x615B60), angle: -4, folded: folded, square: squares, action: ebook)
        }.padding(.horizontal, folded ? 0 : 8)
    }
    private func tone(_ light: UInt32, _ dark: UInt32) -> Color {
        let value = colorScheme == .dark ? dark : light
        return Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
    private func card(_ title: String, symbol: String, color: Color, border: Color, angle: Double, folded: Bool, square: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            cardLabel(title, symbol: symbol, folded: folded, square: square)
                .foregroundStyle(LeximoryPalette.ink)
                .background(color.opacity(colorScheme == .dark ? 1 : 0.3), in: RoundedRectangle(cornerRadius: folded ? 22 : 30))
                .background(LeximoryPalette.paper, in: RoundedRectangle(cornerRadius: folded ? 22 : 30))
                .overlay { RoundedRectangle(cornerRadius: folded ? 22 : 30).strokeBorder(border, lineWidth: folded ? 4 : 6) }
                .shadow(color: .black.opacity(0.04), radius: 4, y: 3)
        }.buttonStyle(BrowserCardButtonStyle()).matchedGeometryEffect(id: symbol, in: cardNamespace).rotationEffect(.degrees(folded || typeSize.isAccessibilitySize ? 0 : angle))
    }
    @ViewBuilder private func cardLabel(_ title: String, symbol: String, folded: Bool, square: Bool) -> some View {
        if square {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    Image(systemName: symbol).font(.system(size: 28, weight: .medium))
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.up.right").font(.body.weight(.medium))
                }
                Spacer(minLength: 16)
                Text(title).font(LeximoryTypography.interface(24, style: .title2)).fixedSize(horizontal: false, vertical: true)
            }.padding(20).frame(width: 180, height: 180)
        } else {
            HStack(spacing: 20) {
                Image(systemName: symbol).font(.system(size: folded ? 22 : 26, weight: .medium)).frame(width: 44)
                Text(title).font(LeximoryTypography.interface(folded ? 17 : 20, style: folded ? .headline : .title2))
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").font(.body.weight(.medium))
            }.padding(.horizontal, 24).padding(.vertical, folded ? 12 : 22)
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
