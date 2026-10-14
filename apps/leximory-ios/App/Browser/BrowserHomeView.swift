import SwiftUI
import LeximoryCore

struct BrowserHomeView: View {
    let compact: Bool
    let recent: [CatalogText]
    let browse: () -> Void
    let paste: () -> Void
    let recentWebpages: [RecentWebpage]
    let openWebpage: (RecentWebpage) -> Void
    let bookmarks: () -> Void
    let ebook: () -> Void
    let account: () -> Void
    var review: () -> Void = {}
    var avatarImage: UIImage? = nil
    let resume: (CatalogText) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.colorScheme) private var colorScheme
    @Namespace private var cardNamespace
    var body: some View {
        Group {
            if compact {
                homeCards(squares: false, folded: true)
                    .padding(.horizontal, 28)
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
                            Group {
                                if let avatarImage { Image(uiImage: avatarImage).resizable().scaledToFill() }
                                else { Image(systemName: "person.crop.circle").resizable().scaledToFit().foregroundStyle(.secondary) }
                            }.frame(width: 36, height: 36).clipShape(Circle())
                                .frame(width: 48, height: 48).contentShape(Circle())
                        }.buttonStyle(.plain).accessibilityLabel("账号")
                    }.padding(.bottom, 18)
                    homeCards(squares: squares, folded: false)
                    if !readingResources.isEmpty || recentWebpage != nil {
                        VStack(spacing: 3) {
                            Text("继续浏览").editorialFont(16, relativeTo: .headline).foregroundStyle(.secondary)
                            ForEach(readingResources) { text in
                                let ebook = text.format == "ebook"
                                recentLink(text.title, symbol: ebook ? "book.closed" : "doc.text", type: ebook ? "电子书" : "文章") { resume(text) }
                                    .accessibilityIdentifier("browser-resume-" + text.id)
                            }
                            if let page = recentWebpage {
                                recentLink(page.domain, symbol: "globe", type: "网页") { openWebpage(page) }
                                    .accessibilityIdentifier("browser-recent-webpage-" + page.url.absoluteString)
                            }
                        }.frame(maxWidth: 360).frame(maxWidth: .infinity).padding(.top, 8)
                    }

                }.padding(.horizontal, 28).padding(.top, 32)
                    .padding(.bottom, 110).frame(maxWidth: squares ? 740 : 360).frame(maxWidth: .infinity, minHeight: max(0, geometry.size.height - 80), alignment: .center)
            }.scrollBounceBehavior(.basedOnSize)
        }
            }
        }
        .animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.86), value: compact)
        .tint(.primary)
        .accessibilityIdentifier("browser-home")
    }
    private var readingResources: [CatalogText] {
        var seen = Set<String>()
        return Array(recent.filter { $0.format != "bookmark" && seen.insert($0.id).inserted }.prefix(3))
    }
    private var recentWebpage: RecentWebpage? {
        if let page = recentWebpages.first { return page }
        guard let text = recent.first(where: { $0.format == "bookmark" }),
              let url = text.bookmarkURL.flatMap(TextBrowserModel.address) else { return nil }
        return RecentWebpage(url: url, bookmarkID: text.id)
    }
    private func recentLink(_ title: String, symbol: String, type: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: symbol).symbolVariant(.none).font(.system(size: 16, weight: .regular))
                    .foregroundStyle(.secondary).accessibilityHidden(true)
                Text(title).editorialFont(20, relativeTo: .headline, language: nil).foregroundStyle(.primary)
                    .multilineTextAlignment(.center).lineLimit(2)
            }.frame(maxWidth: .infinity, minHeight: 44).contentShape(.rect)
        }.buttonStyle(.plain).accessibilityLabel("\(title)，\(type)")
    }
    private func homeCards(squares: Bool, folded: Bool) -> some View {
        let layout = squares ? AnyLayout(HStackLayout(spacing: -18)) : AnyLayout(VStackLayout(spacing: folded ? 8 : -6))
        return layout {
            card(compact ? "跳转到剪贴板" : "浏览网页", symbol: "globe.asia.australia.fill", color: tone(0xDFE7FD, 0x22252D), border: tone(0xCDDAFD, 0x535A6C), angle: -7, folded: folded, square: squares, action: compact ? paste : browse).accessibilityIdentifier("browser-browse")
            card("我的书签", symbol: "bookmark.fill", color: tone(0xFDE2E4, 0x2B2427), border: tone(0xFAD2E1, 0x6B555F), angle: 5, folded: folded, square: squares, action: bookmarks).accessibilityIdentifier("browser-bookmarks")
            card("打开电子书", symbol: "book.closed.fill", color: tone(0xFFF1E6, 0x292723), border: tone(0xEAE4E9, 0x615B60), angle: -4, folded: folded, square: squares, action: ebook).accessibilityIdentifier("browser-ebook")
            card("每日复习", symbol: "leaf.fill", color: tone(0xE7EEDB, 0x242921), border: tone(0xD9E8BF, 0x535F48), angle: 3, folded: folded, square: squares, action: review)
                .accessibilityIdentifier("browser-review")
        }.padding(.horizontal, folded ? 0 : 8)
    }
    private func tone(_ light: UInt32, _ dark: UInt32) -> Color {
        let value = colorScheme == .dark ? dark : light
        return Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
    private func card(_ title: String, symbol: String, color: Color, border: Color, angle: Double, folded: Bool, square: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            cardLabel(title, symbol: symbol, iconColor: border.mix(with: LeximoryPalette.ink, by: colorScheme == .dark ? 0.35 : 0.2), folded: folded, square: square)
                .foregroundStyle(LeximoryPalette.ink)
                .background(color.opacity(colorScheme == .dark ? 1 : 0.3), in: RoundedRectangle(cornerRadius: folded ? 22 : 30))
                .background(LeximoryPalette.paper, in: RoundedRectangle(cornerRadius: folded ? 22 : 30))
                .overlay { RoundedRectangle(cornerRadius: folded ? 22 : 30).strokeBorder(border, lineWidth: folded ? 4 : 6) }
                .shadow(color: .black.opacity(0.04), radius: 4, y: 3)
        }.buttonStyle(BrowserCardButtonStyle()).matchedGeometryEffect(id: symbol, in: cardNamespace).rotationEffect(.degrees(folded || typeSize.isAccessibilitySize ? 0 : angle))
    }
    @ViewBuilder private func cardLabel(_ title: String, symbol: String, iconColor: Color, folded: Bool, square: Bool) -> some View {
        if square {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    Image(systemName: symbol).font(.system(size: 28, weight: .medium)).foregroundStyle(iconColor)
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.up.right").font(.body.weight(.medium)).foregroundStyle(iconColor)
                }
                Spacer(minLength: 16)
                Text(title).font(LeximoryTypography.interface(24, style: .title2)).fixedSize(horizontal: false, vertical: true)
            }.padding(20).frame(width: 180, height: 180)
        } else {
            HStack(spacing: 20) {
                Image(systemName: symbol).font(.system(size: folded ? 22 : 26, weight: .medium)).foregroundStyle(iconColor).frame(width: 44)
                Text(title).font(LeximoryTypography.interface(folded ? 17 : 20, style: folded ? .headline : .title2))
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").font(.body.weight(.medium)).foregroundStyle(iconColor)
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
