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
    var review: () -> Void = {}
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
    @ScaledMetric(relativeTo: .body) private var recentTitleSize: CGFloat = 17
    @ScaledMetric(relativeTo: .headline) private var matchRowHeight: CGFloat = 44
    @State private var compactCardsHeight: CGFloat = 256
    @Namespace private var cardNamespace

    var body: some View {
        Group {
            if compact {
                GeometryReader { geometry in
                    let horizontal = geometry.size.width >= 760 && !typeSize.isAccessibilitySize
                    let minimumMatches = geometry.size.height >= matchRowHeight + 96 ? 1 : 0
                    let matchCount = max(minimumMatches, min(BrowserWorkspaceModel.maximumAddressMatches,
                        Int((geometry.size.height - compactCardsHeight - 24 - 32) / matchRowHeight)))
                    let cardsHeight = max(0, geometry.size.height - CGFloat(matchCount) * matchRowHeight - (matchCount > 0 ? 32 : 0))
                    VStack(spacing: matchCount > 0 ? 32 : 0) {
                        ScrollView {
                            homeCards(squares: horizontal, folded: true)
                                .fixedSize(horizontal: false, vertical: true)
                                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { compactCardsHeight = $0 }
                                .padding(.horizontal, 28).padding(.vertical, 12)
                                .frame(maxWidth: horizontal ? 740 : 360, minHeight: cardsHeight).frame(maxWidth: .infinity)
                        }.scrollBounceBehavior(.basedOnSize).defaultScrollAnchor(.bottom).frame(height: cardsHeight)
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
                            homeCards(squares: squares, folded: false).frame(maxWidth: squares ? nil : 304)
                            if !pins.isEmpty || !readingResources.isEmpty || recentWebpage != nil {
                                savedPages.frame(maxWidth: squares ? 680 : 400)
                            }
                        }
                        .padding(.horizontal, 28)
                        .padding(.vertical, 24)
                        .frame(maxWidth: squares ? 740 : 456, minHeight: max(0, geometry.size.height - chromeHeight))
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, chromeHeight)
                    }.scrollBounceBehavior(.basedOnSize)
                }
            }
        }
        .animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.86), value: compact)
        .tint(.primary)
    }

    private var innerFill: Color {
        colorScheme == .dark ? Color(white: 0.12) : .white
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
    private enum HomeCardTitle: String {
        case browse = "浏览网页"
        case clipboard = "跳转到剪贴板"
        case bookmarks = "我的书签"
        case ebook = "打开电子书"
        case review = "每日复习"
    }

    @ViewBuilder private func homeCardButtons(squares: Bool, folded: Bool, grid: Bool) -> some View {
        card(compact ? .clipboard : .browse, symbol: "globe.asia.australia.fill", color: tone(0xE0EEDD, 0x1D2925), accent: tone(0x98C9A3, 0x98C9A3), label: tone(0x2D493F, 0xDDE7C7), angle: -7, folded: folded, square: squares, grid: grid, action: compact ? paste : browse).accessibilityIdentifier("browser-browse")
        card(.bookmarks, symbol: "bookmark.fill", color: tone(0xDDEFE6, 0x1D2925), accent: tone(0xBFD8BD, 0xBFD8BD), label: tone(0x2D493F, 0xDDE7C7), angle: 5, folded: folded, square: squares, grid: grid, action: bookmarks).accessibilityIdentifier("browser-bookmarks")
        card(.ebook, symbol: "book.closed.fill", color: tone(0xDCEEF2, 0x1D2930), accent: tone(0xB5D2D6, 0xA5D1DA), label: tone(0x2D493F, 0xD2E6EC), angle: -4, folded: folded, square: squares, grid: grid, action: ebook).accessibilityIdentifier("browser-ebook")
        card(.review, symbol: "leaf.fill", color: tone(0xE1E9F8, 0x242B38), accent: tone(0xB2C4DB, 0xB1C3E5), label: tone(0x2D493F, 0xD7E1F3), angle: 3, folded: folded, square: squares, grid: grid, action: review)
            .accessibilityIdentifier("browser-review")
    }
    private func tone(_ light: UInt32, _ dark: UInt32) -> Color {
        let value = colorScheme == .dark ? dark : light
        return Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
    private func card(_ title: HomeCardTitle, symbol: String, color: Color, accent: Color, label: Color, angle: Double, folded: Bool, square: Bool, grid: Bool, action: @escaping () -> Void) -> some View {
        let radius: CGFloat = folded ? 22 : grid ? 24 : 30
        return Button(action: action) {
            cardLabel(title, symbol: symbol,
                iconColor: colorScheme == .dark ? accent : accent.mix(with: LeximoryPalette.ink, by: 0.55),
                folded: folded, square: square, grid: grid)
                .foregroundStyle(colorScheme == .light ? LeximoryPalette.ink : label)
                .background { cardSurface(color: color, tint: accent, radius: radius) }
                .contentShape(RoundedRectangle(cornerRadius: radius))
        }.buttonStyle(BrowserCardButtonStyle()).accessibilityLabel(title.rawValue)
            .matchedGeometryEffect(id: symbol, in: cardNamespace).rotationEffect(.degrees(folded || grid || typeSize.isAccessibilitySize ? 0 : angle))
    }
    @ViewBuilder private func cardSurface(color: Color, tint: Color, radius: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius)
        if colorScheme == .light {
            let highlight = color.mix(with: .white, by: 0.25)
            if reduceTransparency {
                shape.fill(LinearGradient(colors: [highlight, color],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
            } else {
                ZStack {
                    shape.fill(.ultraThinMaterial).opacity(0.25)
                    shape.fill(LinearGradient(colors: [highlight.opacity(0.80), color.opacity(0.70)],
                        startPoint: .topLeading, endPoint: .bottomTrailing))
                }
            }
        } else {
            let opacity = reduceTransparency ? 1.0 : hasWallpaper ? 0.72 : 0.92
            ZStack {
                if !reduceTransparency {
                    shape.fill(.ultraThinMaterial)
                }
                shape.fill(
                    LinearGradient(stops: [
                        .init(color: color.mix(with: tint, by: 0.18).opacity(opacity), location: 0),
                        .init(color: color.mix(with: tint, by: 0.09).opacity(opacity), location: 0.55),
                        .init(color: color.mix(with: tint, by: 0.04).opacity(opacity), location: 1)
                    ], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
            }
        }
    }
    @ViewBuilder private func cardLabel(_ title: HomeCardTitle, symbol: String, iconColor: Color, folded: Bool, square: Bool, grid: Bool) -> some View {
        if square && folded {
            VStack(spacing: 8) {
                Image(systemName: symbol).font(.system(size: 22, weight: .medium)).foregroundStyle(iconColor)
                Text(title.rawValue).displayFont(19, relativeTo: .headline)
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
                Text(title.rawValue).displayFont(grid ? 21 : 26, relativeTo: grid ? .headline : .title2)
                    .lineLimit(1).minimumScaleFactor(0.65).allowsTightening(true)
                    .fixedSize(horizontal: false, vertical: true)
            }.padding(grid ? 18 : 20)
                .frame(width: grid ? nil : 180, height: grid ? nil : 180)
                .frame(maxWidth: grid ? .infinity : nil, maxHeight: grid ? .infinity : nil, alignment: .topLeading)
        } else {
            HStack(spacing: 20) {
                Image(systemName: symbol).font(.system(size: folded ? 22 : 26, weight: .medium)).foregroundStyle(iconColor).frame(width: 44)
                Text(title.rawValue).displayFont(folded ? 19 : 22, relativeTo: folded ? .headline : .title2)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").font(.body.weight(.medium)).foregroundStyle(iconColor)
            }.padding(.horizontal, 24).padding(.vertical, folded ? 12 : 22)
                .frame(maxWidth: .infinity, minHeight: 58)
        }
    }
    private func shortcutLabel<Icon: View>(_ title: String, isPin: Bool = false, cutout: Bool = true, background: Color = .white, @ViewBuilder icon: () -> Icon) -> some View {
        VStack(spacing: 10) {
            if isPin {
                icon().frame(width: 24, height: 24)
                    .frame(width: 40, height: 40)
                    .background { insetBackground(cornerRadius: 20) }
                    .clipShape(.circle)
                    .accessibilityHidden(true)
            } else {
                Circle().fill(background.opacity(0.94))
                    .overlay {
                        icon().frame(width: 24, height: 24)
                            .blendMode(cutout ? .destinationOut : .normal)
                    }
                    .compositingGroup()
                    .frame(width: 40, height: 40)
                    .accessibilityHidden(true)
            }
            Text(title).interfaceFont(13, style: .footnote)
                .homeWallpaperInk()
                .multilineTextAlignment(.center)
                .lineLimit(isPin || !typeSize.isAccessibilitySize ? 1 : nil).truncationMode(.tail)
                .minimumScaleFactor(isPin ? 1 : 0.75)
                .fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .contentShape(.rect)
    }

    private var savedPages: some View {
        VStack(spacing: 16) {
            BrowserHomeShortcutLayout(accessibility: typeSize.isAccessibilitySize) {
                ForEach(pins) { pin in
                        Button { openPin(pin) } label: {
                            shortcutLabel(pin.title, isPin: true) {
                                Group {
                                    if let url = pin.iconURL, let image = pinImages[url] {
                                        Image(uiImage: image).resizable().scaledToFit()
                                    } else {
                                        Image(systemName: pin.symbol).font(.system(size: 21))
                                            .foregroundStyle(LeximoryPalette.ink)
                                    }
                                }.clipShape(.rect(cornerRadius: 7))
                            }
                        }.buttonStyle(BrowserHomeButtonStyle())
                            .accessibilityLabel(pin.title)
                            .accessibilityIdentifier("browser-pin-" + pin.id.uuidString)
                            .contextMenu {
                                Button("编辑", systemImage: "pencil") { editPin(pin) }
                                Button(role: .destructive) { deletePin(pin) } label: {
                                    Label {
                                        Text("删除")
                                    } icon: {
                                        Image(uiImage: pinDeleteIcon)
                                    }
                                }.tint(.red)
                            }
                    }
            }.frame(maxWidth: 400).frame(maxWidth: .infinity)
                .padding(.horizontal, 4).padding(.top, 8)
            if !readingResources.isEmpty || recentWebpage != nil {
                VStack(alignment: .leading, spacing: 0) {
                    if let page = recentWebpage {
                        Button { openWebpage(page) } label: {
                            recentRow(title: page.displayTitle, byline: page.url.host ?? "", identity: page.url.absoluteString) {
                                if let url = page.iconURL, let image = recentImages[url] {
                                    Image(uiImage: image).resizable().scaledToFit().clipShape(.rect(cornerRadius: 7))
                                } else {
                                    Image(systemName: "globe").font(.system(size: 20)).foregroundStyle(LeximoryPalette.ink)
                                }
                            }
                        }.buttonStyle(BrowserHomeButtonStyle())
                            .accessibilityLabel("\(page.displayTitle)，网页").accessibilityValue(page.url.host ?? "")
                            .accessibilityIdentifier("browser-recent-webpage-" + page.url.absoluteString)
                            .contextMenu {
                                Button("从主页隐藏", systemImage: "eye.slash") { hideRecentWebpage(page) }
                            }
                    }
                    ForEach(readingResources) { text in
                        Button { resume(text) } label: {
                            recentRow(title: text.title, byline: libraryName(text), identity: text.id) {
                                BrowserTextIcon(text: text).font(.system(size: 20)).foregroundStyle(LeximoryPalette.ink)
                            }
                        }.buttonStyle(BrowserHomeButtonStyle())
                            .accessibilityLabel("\(text.title)，\(text.format == "ebook" ? "电子书" : "文章")")
                            .accessibilityValue(libraryName(text))
                            .accessibilityIdentifier("browser-resume-" + text.id)
                            .contextMenu {
                                Button("从主页隐藏", systemImage: "eye.slash") { hideRecentText(text) }
                            }
                    }
                }
                .padding(.vertical, 12)
                .background {
                    insetBackground(cornerRadius: 28)
                }
            }
        }.padding(12).modifier(BrowserHomeGlass())
    }

    @ViewBuilder private func insetBackground(cornerRadius: CGFloat) -> some View {
        if reduceTransparency {
            RoundedRectangle(cornerRadius: cornerRadius).fill(innerFill)
        } else {
            HomeWallpaperGlassBackdrop(cornerRadius: cornerRadius, blurRadius: 6, showsGlassEdge: false)
                .overlay(innerFill.opacity(0.60))
                .clipShape(.rect(cornerRadius: cornerRadius))
        }
    }

    private var pinDeleteIcon: UIImage {
        UIImage(systemName: "trash")!.withTintColor(.systemRed, renderingMode: .alwaysOriginal)
    }

    private func recentRow<Icon: View>(title: String, byline: String, identity: String, @ViewBuilder icon: () -> Icon) -> some View {
        HStack(spacing: 10) {
            icon().frame(width: 22, height: 22)
                .frame(width: 36, height: 36)
                .background(innerFill, in: .circle)
                .accessibilityHidden(true)
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 4) {
                    recentTitle(title).lineLimit(3)
                    recentByline(byline, identity: identity)
                }.frame(maxWidth: .infinity, alignment: .leading)
            } else {
                recentTitle(title).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if !byline.isEmpty {
                    recentByline(byline, identity: identity)
                        .frame(maxWidth: 96, alignment: .trailing)
                }
            }
        }.padding(.horizontal, 16).padding(.vertical, 4)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).contentShape(.rect)
    }

    private func recentTitle(_ title: String) -> some View {
        Text(LeximoryTypography.scaledChineseText(title, size: recentTitleSize))
            .foregroundStyle(.primary).truncationMode(.tail)
    }

    private func recentByline(_ byline: String, identity: String) -> some View {
        Text(byline).interfaceFont(12, style: .caption1)
            .foregroundStyle(.tertiary).lineLimit(1).truncationMode(.tail)
            .accessibilityIdentifier("browser-recent-byline-" + identity)
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
}

private struct BrowserHomeGlass: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        if reduceTransparency {
            content.background(LeximoryPalette.shell, in: .rect(cornerRadius: 36))
        } else if #available(iOS 26, *) {
            content.background {
                HomeWallpaperGlassBackdrop(cornerRadius: 36)
            }
        } else {
            content.background(.regularMaterial, in: .rect(cornerRadius: 36))
        }
    }
}

private struct BrowserHomeButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.65 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: configuration.isPressed)
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

private struct BrowserHomeShortcutLayout: Layout {
    var accessibility: Bool
    private let gap: CGFloat = 12

    private var preferredItemWidth: CGFloat { accessibility ? 112 : 64 }
    private func columns(_ width: CGFloat) -> Int { max(1, Int((width + gap) / (preferredItemWidth + gap))) }
    private func itemWidth(_ width: CGFloat) -> CGFloat { min(preferredItemWidth, width) }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = max(0, proposal.width ?? 328)
        let columns = columns(width)
        let itemWidth = itemWidth(width)
        let height = subviews.map { $0.sizeThatFits(.init(width: itemWidth, height: nil)).height }.max() ?? 0
        let rows = (subviews.count + columns - 1) / columns
        return CGSize(width: width, height: CGFloat(rows) * height + CGFloat(max(0, rows - 1)) * 16)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let columns = columns(bounds.width)
        let width = itemWidth(bounds.width)
        let height = subviews.map { $0.sizeThatFits(.init(width: width, height: nil)).height }.max() ?? 0
        for index in subviews.indices {
            let row = index / columns
            let rowCount = min(columns, subviews.count - row * columns)
            let rowWidth = CGFloat(rowCount) * width + CGFloat(rowCount - 1) * gap
            subviews[index].place(at: CGPoint(x: bounds.midX - rowWidth / 2 + CGFloat(index % columns) * (width + gap),
                y: bounds.minY + CGFloat(row) * (height + 16)), anchor: .topLeading,
                proposal: .init(width: width, height: height))
        }
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
                    TextField("名称", text: $title).tint(.blue)
                } header: {
                    LeximorySectionHeader("名称")
                }
                if isWebpage {
                    Section {
                        TextField("网址", text: $address).tint(.blue).keyboardType(.URL)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                    } header: {
                        LeximorySectionHeader("网址")
                    }
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .interfaceFont(17, style: .body)
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
