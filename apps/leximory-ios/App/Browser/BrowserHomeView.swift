import SwiftUI
import LeximoryCore

struct BrowserHomeView: View {
    var pins: [BrowserHomePin] = []
    var pinImages: [URL: UIImage] = [:]
    var openPin: (BrowserHomePin) -> Void = { _ in }
    var editPin: (BrowserHomePin) -> Void = { _ in }
    var deletePin: (BrowserHomePin) -> Void = { _ in }
    var hiddenRecentTextIDs: Set<String> = []
    var hiddenRecentWebURLs: Set<URL> = []
    var hideRecentText: (CatalogText) -> Void = { _ in }
    var hideRecentWebpage: (RecentWebpage) -> Void = { _ in }
    let compact: Bool
    let recent: [CatalogText]
    var recentImages: [URL: UIImage] = [:]
    var libraryName: (CatalogText) -> String = { _ in "" }
    let browse: () -> Void
    let paste: () -> Void
    let recentWebpages: [RecentWebpage]
    let openWebpage: (RecentWebpage) -> Void
    let bookmarks: () -> Void
    let ebook: () -> Void
    let account: () -> Void
    var review: () -> Void = {}
    var avatarImage: UIImage? = nil
    var addressQuery = ""
    var addressMatches: (String, Int) -> [BrowserAddressMatch] = { _, _ in [] }
    var openAddressMatch: (BrowserAddressMatch) -> Void = { _ in }
    let resume: (CatalogText) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.hasHomeWallpaper) private var hasWallpaper
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.browserChromeHeight) private var chromeHeight
    @ScaledMetric(relativeTo: .headline) private var recentTitleSize: CGFloat = 20
    @ScaledMetric(relativeTo: .headline) private var matchRowHeight: CGFloat = 44
    @State private var compactCardsHeight: CGFloat = 256
    @Namespace private var cardNamespace
    private var translucentBackgrounds: Bool { hasWallpaper && !reduceTransparency }
    var body: some View {
        Group {
            if compact {
                GeometryReader { geometry in
                    let horizontal = geometry.size.width >= 760 && !typeSize.isAccessibilitySize
                    let matchCount = max(0, min(BrowserWorkspaceModel.maximumAddressMatches,
                        Int((geometry.size.height - compactCardsHeight - 24 - 32) / matchRowHeight)))
                    let cardsHeight = max(0, geometry.size.height - CGFloat(matchCount) * matchRowHeight - (matchCount > 0 ? 32 : 0))
                    VStack(spacing: matchCount > 0 ? 32 : 0) {
                        ScrollView {
                            homeCards(squares: horizontal, folded: true)
                                .fixedSize(horizontal: false, vertical: true)
                                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { compactCardsHeight = $0 }
                                .padding(.horizontal, 28).padding(.vertical, 12)
                                .frame(maxWidth: horizontal ? 740 : 360, minHeight: cardsHeight).frame(maxWidth: .infinity)
                        }.scrollBounceBehavior(.basedOnSize).frame(height: cardsHeight)
                        VStack(spacing: 0) {
                            ForEach(addressMatches(addressQuery, matchCount)) { match in
                                Button { openAddressMatch(match) } label: {
                                    HStack(spacing: 8) {
                                        Group {
                                            switch match {
                                            case .text(let text): BrowserTextIcon(text: text)
                                            case .webpage: Image(systemName: "globe")
                                            }
                                        }.font(.system(size: 16, weight: .regular))
                                            .homeWallpaperInk(secondary: true).accessibilityHidden(true)
                                        Text(LeximoryTypography.scaledChineseText(match.title, size: recentTitleSize))
                                            .homeWallpaperInk().lineLimit(1).truncationMode(.tail)
                                    }.frame(maxWidth: .infinity).frame(height: matchRowHeight).contentShape(.rect)
                                }.buttonStyle(.plain).accessibilityLabel(match.title)
                                    .accessibilityIdentifier("browser-address-match-" + match.id)
                            }
                        }.frame(height: CGFloat(matchCount) * matchRowHeight, alignment: .bottom)
                            .frame(maxWidth: 400).padding(.horizontal, LeximoryLayout.pageInset).frame(maxWidth: .infinity)
                    }
                }
            } else {
        GeometryReader { geometry in
            let squares = geometry.size.width >= 760 && UIDevice.current.userInterfaceIdiom != .phone && !typeSize.isAccessibilitySize
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
                        }.editorialFont(34, relativeTo: .title, language: nil).homeWallpaperInk()
                        Spacer()
                        Button(action: account) {
                            Group {
                                if let avatarImage { Image(uiImage: avatarImage).resizable().scaledToFill() }
                                else { Image(systemName: "person.crop.circle").resizable().scaledToFit().homeWallpaperInk(secondary: true) }
                            }.frame(width: 36, height: 36).clipShape(Circle())
                                .frame(width: 48, height: 48).contentShape(Circle())
                        }.buttonStyle(.plain).accessibilityLabel("账号")
                    }.padding(.bottom, 18).frame(maxWidth: squares ? nil : 304)
                    homeCards(squares: squares, folded: false).frame(maxWidth: squares ? nil : 304)
                    if !pins.isEmpty { pinnedPages }
                    if !readingResources.isEmpty || recentWebpage != nil {
                        VStack(spacing: 12) {
                            Text("继续浏览").editorialFont(16, relativeTo: .headline)
                                .homeWallpaperInk(secondary: true, shadow: false)
                            BrowserRecentLayout {
                                if let page = recentWebpage {
                                    Button { openWebpage(page) } label: {
                                        BrowserRecentCard(title: page.displayTitle, byline: page.url.host ?? "", identity: page.url.absoluteString,
                                            favicon: page.iconURL.flatMap { recentImages[$0] },
                                            photograph: page.previewImageURL.flatMap { recentImages[$0] })
                                    }.buttonStyle(.plain).accessibilityLabel("\(page.displayTitle)，网页")
                                        .accessibilityValue(page.url.host ?? "")
                                        .accessibilityIdentifier("browser-recent-webpage-" + page.url.absoluteString)
                                        .contextMenu {
                                            Button("从主页隐藏", systemImage: "eye.slash") { hideRecentWebpage(page) }
                                        }
                                }
                                ForEach(readingResources) { text in
                                    let savedEmoji = text.emoji?.trimmingCharacters(in: .whitespacesAndNewlines)
                                    let emoji = (savedEmoji?.isEmpty == false ? savedEmoji : nil) ?? (text.format == "ebook" ? "📖" : "📄")
                                    Button { resume(text) } label: {
                                        BrowserRecentCard(title: text.title, byline: libraryName(text), identity: text.id, emoji: emoji)
                                    }.buttonStyle(.plain).accessibilityLabel("\(text.title)，\(text.format == "ebook" ? "电子书" : "文章")")
                                        .accessibilityValue(libraryName(text))
                                        .accessibilityIdentifier("browser-resume-" + text.id)
                                        .contextMenu {
                                            Button("从主页隐藏", systemImage: "eye.slash") { hideRecentText(text) }
                                        }
                                }
                            }
                        }.frame(maxWidth: squares ? 680 : 304).frame(maxWidth: .infinity).padding(.top, 8)
                    }

                }.padding(.horizontal, 28).padding(.vertical, 24)
                    .frame(maxWidth: squares ? 740 : 456, minHeight: max(0, geometry.size.height - chromeHeight), alignment: .center)
                    .frame(maxWidth: .infinity).padding(.bottom, chromeHeight)
            }.scrollBounceBehavior(.basedOnSize)
        }
            }
        }
        .animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.86), value: compact)
        .tint(.primary)
    }
    private var pinnedPages: some View {
        BrowserPinLayout {
            ForEach(pins) { pin in
                Button { openPin(pin) } label: {
                    VStack(spacing: 8) {
                        pinIcon(pin)
                        Text(pin.title).font(LeximoryTypography.interface(13, style: .footnote))
                            .homeWallpaperInk()
                            .lineLimit(1).truncationMode(.tail)
                            .frame(maxWidth: .infinity).multilineTextAlignment(.center)
                    }.foregroundStyle(.primary).frame(maxWidth: .infinity).contentShape(.rect)
                }.buttonStyle(.plain)
                    .accessibilityLabel(pin.title)
                    .accessibilityIdentifier("browser-pin-" + pin.id.uuidString)
                    .contextMenu {
                        Button("编辑", systemImage: "pencil") { editPin(pin) }
                        Button("删除", systemImage: "trash", role: .destructive) { deletePin(pin) }
                    }
            }
        }.frame(maxWidth: 400).frame(maxWidth: .infinity)
    }
    private func pinIcon(_ pin: BrowserHomePin) -> some View {
        Group {
            if let url = pin.iconURL, let image = pinImages[url] {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                Image(systemName: pin.symbol).font(.system(size: 26, weight: .regular))
            }
        }
        .opacity(translucentBackgrounds ? 0.7 : 1)
        .frame(width: 32, height: 32)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .circular))
        .padding(12)
        .background(LeximoryPalette.shell.opacity(translucentBackgrounds ? 0.18 : 1), in: RoundedRectangle(cornerRadius: 20, style: .circular))
        .background {
            if translucentBackgrounds {
                RoundedRectangle(cornerRadius: 20, style: .circular).fill(.ultraThinMaterial).opacity(0.7)
            }
        }
        .accessibilityHidden(true)
    }
    private var readingResources: [CatalogText] {
        var seen = Set<String>()
        return Array(recent.filter { $0.format != "bookmark" && !hiddenRecentTextIDs.contains($0.id) && seen.insert($0.id).inserted }.prefix(3))
    }
    private var recentWebpage: RecentWebpage? {
        if var page = recentWebpages.first {
            guard !hiddenRecentWebURLs.contains(page.url),
                  page.bookmarkID.map({ !hiddenRecentTextIDs.contains($0) }) ?? true else { return nil }
            if RecentWebpage.normalizedTitle(page.title) == nil {
                page.title = recent.first { $0.id == page.bookmarkID || $0.bookmarkURL == page.url.absoluteString }?.title
            }
            return page
        }
        guard let text = recent.first(where: {
            $0.format == "bookmark" && !hiddenRecentTextIDs.contains($0.id)
                && $0.bookmarkURL.flatMap(TextBrowserModel.address).map({ !hiddenRecentWebURLs.contains($0) }) == true
        }), let url = text.bookmarkURL.flatMap(TextBrowserModel.address) else { return nil }
        return RecentWebpage(url: url, title: text.title, bookmarkID: text.id)
    }
    @ViewBuilder private func homeCards(squares: Bool, folded: Bool) -> some View {
        if !squares && !folded && !typeSize.isAccessibilitySize {
            BrowserHomeCardGrid {
                homeCardButtons(squares: true, folded: false, grid: true)
            }
        } else {
            let layout = squares ? AnyLayout(HStackLayout(spacing: folded ? 12 : -18)) : AnyLayout(VStackLayout(spacing: folded ? 8 : -6))
            layout {
                homeCardButtons(squares: squares, folded: folded, grid: false)
            }.padding(.horizontal, folded ? 0 : 8)
        }
    }
    @ViewBuilder private func homeCardButtons(squares: Bool, folded: Bool, grid: Bool) -> some View {
        card(compact ? "跳转到剪贴板" : "浏览网页", symbol: "globe.asia.australia.fill", color: tone(0xFAFCF8, 0x1D2925), border: tone(0x98C9A3, 0x98C9A3), label: tone(0x2D493F, 0xDDE7C7), angle: -7, folded: folded, square: squares, grid: grid, action: compact ? paste : browse).accessibilityIdentifier("browser-browse")
        card("我的书签", symbol: "bookmark.fill", color: tone(0xF8FBF7, 0x1D2925), border: tone(0xBFD8BD, 0xBFD8BD), label: tone(0x2D493F, 0xDDE7C7), angle: 5, folded: folded, square: squares, grid: grid, action: bookmarks).accessibilityIdentifier("browser-bookmarks")
        card("打开电子书", symbol: "book.closed.fill", color: tone(0xFDFDF8, 0x1D2930), border: tone(0xB5D2D6, 0xA5D1DA), label: tone(0x2D493F, 0xD2E6EC), angle: -4, folded: folded, square: squares, grid: grid, action: ebook).accessibilityIdentifier("browser-ebook")
        card("每日复习", symbol: "leaf.fill", color: tone(0xFCFDF8, 0x242B38), border: tone(0xB2C4DB, 0xB1C3E5), label: tone(0x2D493F, 0xD7E1F3), angle: 3, folded: folded, square: squares, grid: grid, action: review)
            .accessibilityIdentifier("browser-review")
    }
    private func tone(_ light: UInt32, _ dark: UInt32) -> Color {
        let value = colorScheme == .dark ? dark : light
        return Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
    private func card(_ title: String, symbol: String, color: Color, border: Color, label: Color, angle: Double, folded: Bool, square: Bool, grid: Bool, action: @escaping () -> Void) -> some View {
        let radius: CGFloat = folded ? 22 : grid ? 24 : 30
        return Button(action: action) {
            cardLabel(title, symbol: symbol,
                iconColor: colorScheme == .dark ? border : border.mix(with: label, by: 0.35),
                folded: folded, square: square, grid: grid)
                .foregroundStyle(label)
                .background(color.opacity(translucentBackgrounds ? (colorScheme == .dark ? 0.18 : 0.82) : 1), in: RoundedRectangle(cornerRadius: radius))
                .background {
                    RoundedRectangle(cornerRadius: radius)
                        .fill(LeximoryPalette.paper.opacity(translucentBackgrounds ? (colorScheme == .dark ? 0.12 : 0) : 1))
                        .shadow(color: (colorScheme == .dark ? label : border)
                            .opacity(folded ? 0.12 : colorScheme == .dark ? 0.18 : 0.16),
                            radius: folded ? 8 : 16, y: folded ? 2 : 4)
                }
                .background {
                    if colorScheme == .dark && translucentBackgrounds {
                        RoundedRectangle(cornerRadius: radius).fill(.thinMaterial).opacity(0.75)
                    }
                }
                .overlay { RoundedRectangle(cornerRadius: radius).strokeBorder(border, lineWidth: folded ? 4 : grid ? 5 : 6) }
                .shadow(color: .black.opacity(0.04), radius: 4, y: 3)
                .contentShape(RoundedRectangle(cornerRadius: radius))
        }.buttonStyle(BrowserCardButtonStyle()).accessibilityLabel(title)
            .matchedGeometryEffect(id: symbol, in: cardNamespace).rotationEffect(.degrees(folded || grid || typeSize.isAccessibilitySize ? 0 : angle))
    }
    @ViewBuilder private func cardLabel(_ title: String, symbol: String, iconColor: Color, folded: Bool, square: Bool, grid: Bool) -> some View {
        if square && folded {
            VStack(spacing: 8) {
                Image(systemName: symbol).font(.system(size: 22, weight: .medium)).foregroundStyle(iconColor)
                Text(title).font(LeximoryTypography.interface(17, style: .headline))
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            }.padding(.horizontal, 12).padding(.vertical, 12)
                .frame(maxWidth: .infinity, minHeight: 96)
        } else if square {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center, spacing: 0) {
                    Image(systemName: symbol).font(.system(size: grid ? 26 : 28, weight: .medium)).foregroundStyle(iconColor)
                        .frame(width: 32, height: 32, alignment: .leading)
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.up.right").font(.system(size: grid ? 15 : 17, weight: .medium)).foregroundStyle(iconColor)
                        .frame(width: 32, height: 32, alignment: .trailing)
                }
                Spacer(minLength: 12)
                Text(title).font(LeximoryTypography.interface(grid ? 19 : 24, style: grid ? .headline : .title2))
                    .lineLimit(1).minimumScaleFactor(0.65).allowsTightening(true)
                    .fixedSize(horizontal: false, vertical: true)
            }.padding(grid ? 18 : 20)
                .frame(width: grid ? nil : 180, height: grid ? nil : 180)
                .frame(maxWidth: grid ? .infinity : nil, maxHeight: grid ? .infinity : nil, alignment: .topLeading)
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

private struct BrowserHomeCardGrid: Layout {
    private func side(for width: CGFloat) -> CGFloat { max(0, (width - 12) / 2) }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 304
        return CGSize(width: width, height: side(for: width) * 2 + 12)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let side = side(for: bounds.width)
        for index in subviews.indices {
            let column = index % 2
            let row = index / 2
            let x = bounds.minX + CGFloat(column) * (side + 12)
            let y = bounds.minY + CGFloat(row) * (side + 12)
            subviews[index].place(at: CGPoint(x: x, y: y), anchor: .topLeading,
                proposal: ProposedViewSize(width: side, height: side))
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

struct BrowserPinEditor: View {
    let pin: BrowserHomePin
    let save: (BrowserHomePin) -> Void
    @State private var title: String
    @State private var address: String
    @ScaledMetric(relativeTo: .body) private var sectionHeight: CGFloat = 104
    @Environment(\.dismiss) private var dismiss

    init(pin: BrowserHomePin, save: @escaping (BrowserHomePin) -> Void) {
        self.pin = pin
        self.save = save
        _title = State(initialValue: pin.title)
        if case .webpage(let url, _) = pin.destination { _address = State(initialValue: url.absoluteString) }
        else { _address = State(initialValue: "") }
    }
    private var isWebpage: Bool { if case .webpage = pin.destination { true } else { false } }
    private var valid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && (!isWebpage || TextBrowserModel.address(address) != nil)
    }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("名称", text: $title)
                } header: {
                    Text("名称").foregroundStyle(.primary)
                }
                if isWebpage {
                    Section {
                        TextField("网址", text: $address).keyboardType(.URL)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                    } header: {
                        Text("网址").foregroundStyle(.primary)
                    }
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .font(LeximoryTypography.interface(17, style: .body))
            .navigationTitle("主页快捷方式").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        var updated = pin
                        updated.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        if case .webpage(let originalURL, let bookmarkID) = pin.destination,
                           let url = TextBrowserModel.address(address) {
                            updated.destination = .webpage(url, bookmarkID: url == originalURL ? bookmarkID : nil)
                            if url != originalURL { updated.faviconURL = nil; updated.faviconData = nil }
                        }
                        save(updated)
                        dismiss()
                    }.disabled(!valid)
                }
            }
        }.leximorySheetStyle().presentationDetents([.height(sectionHeight * (isWebpage ? 2 : 1) + 88), .large])
    }
}

private struct BrowserPinLayout: Layout {
    private func columns(_ width: CGFloat) -> Int { max(1, Int((width + 12) / 88)) }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = min(proposal.width ?? 400, 400)
        let count = columns(width)
        let itemWidth = min(76, width)
        let height = subviews.map { $0.sizeThatFits(.init(width: itemWidth, height: nil)).height }.max() ?? 0
        let rows = (subviews.count + count - 1) / count
        return CGSize(width: width, height: CGFloat(rows) * height + CGFloat(max(0, rows - 1)) * 12)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let count = columns(bounds.width)
        let itemWidth = min(76, bounds.width)
        let itemHeight = subviews.map { $0.sizeThatFits(.init(width: itemWidth, height: nil)).height }.max() ?? 0
        for index in subviews.indices {
            let row = index / count
            let rowCount = min(count, subviews.count - row * count)
            let rowWidth = CGFloat(rowCount) * itemWidth + CGFloat(rowCount - 1) * 12
            subviews[index].place(at: CGPoint(x: bounds.midX - rowWidth / 2 + CGFloat(index % count) * (itemWidth + 12),
                                              y: bounds.minY + CGFloat(row) * (itemHeight + 12)),
                                  proposal: .init(width: itemWidth, height: itemHeight))
        }
    }
}

private struct BrowserRecentLayout: Layout {
    private func columns(_ width: CGFloat) -> Int { max(1, Int((width + 12) / 156)) }
    private func itemWidth(_ width: CGFloat) -> CGFloat {
        min(220, max(0, (width - CGFloat(columns(width) - 1) * 12) / CGFloat(columns(width))))
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 304
        let count = columns(width)
        let rows = (subviews.count + count - 1) / count
        return CGSize(width: width, height: CGFloat(rows) * itemWidth(width) * 9 / 16 + CGFloat(max(0, rows - 1)) * 12)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let count = columns(bounds.width)
        let width = itemWidth(bounds.width)
        let height = width * 9 / 16
        for index in subviews.indices {
            let row = index / count
            let rowCount = min(count, subviews.count - row * count)
            let rowWidth = CGFloat(rowCount) * width + CGFloat(rowCount - 1) * 12
            subviews[index].place(at: CGPoint(x: bounds.midX - rowWidth / 2 + CGFloat(index % count) * (width + 12),
                                              y: bounds.minY + CGFloat(row) * (height + 12)),
                anchor: .topLeading, proposal: .init(width: width, height: height))
        }
    }
}

private struct BrowserRecentCard: View {
    let title: String
    let byline: String
    let identity: String
    var emoji: String? = nil
    var favicon: UIImage? = nil
    var photograph: UIImage? = nil
    @Environment(\.colorScheme) private var colorScheme
    @ScaledMetric(relativeTo: .headline) private var titleSize: CGFloat = 17
    @ScaledMetric(relativeTo: .caption) private var bylineSize: CGFloat = 12

    var body: some View {
        Color.clear.aspectRatio(16.0 / 9, contentMode: .fit)
            .overlay {
                if let photograph {
                    GeometryReader { geometry in
                        Image(uiImage: photograph).resizable().scaledToFill()
                            .frame(width: geometry.size.width, height: geometry.size.height).clipped()
                    }
                } else {
                    CoverArt(motif: .leaf, identity: identity, emoji: "", cornerRadius: 0, background: .newspaper)
                }
            }
            .overlay {
                if photograph != nil {
                    LinearGradient(colors: [.black.opacity(0.48), .black.opacity(0.72)], startPoint: .top, endPoint: .bottom)
                }
            }
            .overlay {
                VStack(alignment: .leading, spacing: 0) {
                    Group {
                        if let emoji {
                            Text(emoji).font(.custom("LeximoryNotoEmoji", fixedSize: 28))
                                .fixedSize()
                                .foregroundStyle(CoverPalette.emojiInk(identity: identity, dark: colorScheme == .dark))
                        } else if let favicon {
                            Image(uiImage: favicon).resizable().scaledToFill().frame(width: 28, height: 28)
                                .clipShape(RoundedRectangle(cornerRadius: 7, style: .circular))
                                .overlay { RoundedRectangle(cornerRadius: 7).strokeBorder(LeximoryPalette.border.opacity(0.7), lineWidth: 0.5) }
                        } else {
                            Image(systemName: "globe").font(.system(size: 26, weight: .regular))
                                .foregroundStyle(LeximoryPalette.illustration)
                        }
                    }.frame(width: 30, height: 30).accessibilityHidden(true)
                    Text(byline).font(LeximoryTypography.interface(bylineSize))
                        .foregroundStyle(photograph == nil ? Color.secondary : Color.white.opacity(0.9))
                        .lineLimit(1).truncationMode(.tail)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 2)
                        .accessibilityIdentifier("browser-recent-byline-" + identity)
                    Spacer(minLength: 2)
                    Text(LeximoryTypography.scaledChineseText(title, size: titleSize))
                        .foregroundStyle(photograph == nil ? LeximoryPalette.ink : Color.white)
                        .lineLimit(1).truncationMode(.tail)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }.padding(.horizontal, 10).padding(.vertical, 6)
            }
            .clipShape(.rect(cornerRadius: 16))
            .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(LeximoryPalette.border.opacity(0.7), lineWidth: 0.5) }
            .contentShape(.rect(cornerRadius: 16))
    }
}
