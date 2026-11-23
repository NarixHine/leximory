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
    var activityAccount: (origin: URL, id: String)?
    var addressQuery = ""
    var addressMatches: (String, Int) -> [BrowserAddressMatch] = { _, _ in [] }
    var openAddressMatch: (BrowserAddressMatch) -> Void = { _ in }
    let resume: (CatalogText) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.colorSchemeContrast) private var contrast
    @Environment(\.browserChromeHeight) private var chromeHeight
    @ScaledMetric(relativeTo: .body) private var recentTitleSize: CGFloat = 17
    @ScaledMetric(relativeTo: .headline) private var matchRowHeight: CGFloat = 44
    @Namespace private var cardNamespace
    @State private var compactCardsHeight: CGFloat = 256

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
                            compactActions(horizontal: horizontal)
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
                    let inset = BrowserWorkspaceMeasure.horizontalInset
                    ScrollView {
                        BrowserHomeBento(width: max(0, geometry.size.width - 2 * inset), pinCount: pins.count) { width in
                            BrowserHomeActivityCell(account: activityAccount, width: width)
                        } actions: {
                            actionsPanel
                        } pins: {
                            pinsPanel
                        } recents: {
                            recentsPanel
                        }
                        .padding(.horizontal, inset)
                        .padding(.vertical, 20)
                        .frame(minHeight: max(0, geometry.size.height - chromeHeight), alignment: .center)
                        .padding(.bottom, chromeHeight)
                    }.scrollBounceBehavior(.basedOnSize)
                }
            }
        }
        .animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.86), value: compact)
        .tint(.primary)
    }

    private enum HomeAction: String, CaseIterable {
        case browse = "浏览网页"
        case bookmarks = "我的书签"
        case ebook = "打开电子书"
        case review = "每日复习"

        var symbol: String {
            switch self {
            case .browse: "globe.asia.australia.fill"
            case .bookmarks: "bookmark.fill"
            case .ebook: "book.closed.fill"
            case .review: "leaf.fill"
            }
        }

        var identifier: String {
            switch self {
            case .browse: "browser-browse"
            case .bookmarks: "browser-bookmarks"
            case .ebook: "browser-ebook"
            case .review: "browser-review"
            }
        }

        var paper: (light: UInt32, dark: UInt32) {
            switch self {
            case .browse: (0xE0EBDC, 0x222D26)
            case .bookmarks: (0xDFEDE5, 0x1D2D2A)
            case .ebook: (0xDEECEE, 0x202E35)
            case .review: (0xE3E8F5, 0x272D3B)
            }
        }

        var printedTone: (light: UInt32, dark: UInt32) {
            switch self {
            case .browse: (0xC0D6BD, 0x3B5141)
            case .bookmarks: (0xBDD8C9, 0x365348)
            case .ebook: (0xBED8DD, 0x3B5560)
            case .review: (0xC9D3EC, 0x444E68)
            }
        }

        func accent(dark: Bool) -> UInt32 {
            switch self {
            case .browse: 0x98C9A3
            case .bookmarks: 0xBFD8BD
            case .ebook: dark ? 0xA5D1DA : 0xB5D2D6
            case .review: dark ? 0xB1C3E5 : 0xB2C4DB
            }
        }

        var darkLabel: UInt32 {
            switch self {
            case .browse, .bookmarks: 0xDDE7C7
            case .ebook: 0xD2E6EC
            case .review: 0xD7E1F3
            }
        }
    }

    private func handler(for action: HomeAction) -> () -> Void {
        switch action {
        case .browse: compact ? paste : browse
        case .bookmarks: bookmarks
        case .ebook: ebook
        case .review: review
        }
    }

    private var actionsPanel: some View {
        let spacing = BrowserHomePanelMetrics.sectionSpacing
        return Group {
            if typeSize.isAccessibilitySize {
                VStack(spacing: spacing) {
                    ForEach(HomeAction.allCases, id: \.self) { action in
                        homeActionTile(action)
                    }
                }
            } else {
                Grid(horizontalSpacing: spacing, verticalSpacing: spacing) {
                    GridRow {
                        homeActionTile(.browse)
                        homeActionTile(.bookmarks)
                    }
                    GridRow {
                        homeActionTile(.ebook)
                        homeActionTile(.review)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("browser-home-actions")
    }

    private func homeActionTile(_ action: HomeAction) -> some View {
        actionCard(action, title: action.rawValue, radius: 15) { iconColor in
            VStack(alignment: .leading, spacing: BrowserHomePanelMetrics.labelSpacing) {
                HStack {
                    Image(systemName: action.symbol)
                        .font(.system(size: 20, weight: .medium))
                        .frame(width: 22, alignment: .leading)
                    Spacer(minLength: 6)
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 12, weight: .medium))
                }
                .frame(height: 22)
                .foregroundStyle(iconColor)
                .accessibilityHidden(true)

                Text(action.rawValue)
                    .displayFont(17, relativeTo: .headline)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(BrowserHomePanelMetrics.inset)
            .frame(maxWidth: .infinity, minHeight: 68, maxHeight: .infinity, alignment: .leading)
        }
    }

    private func compactActions(horizontal: Bool) -> some View {
        let layout = horizontal ? AnyLayout(HStackLayout(spacing: 12)) : AnyLayout(VStackLayout(spacing: 8))
        return layout {
            ForEach(HomeAction.allCases, id: \.self) { action in
                let title = action == .browse ? "跳转到剪贴板" : action.rawValue
                actionCard(action, title: title, radius: 22) { iconColor in
                    compactActionLabel(title, symbol: action.symbol, iconColor: iconColor, horizontal: horizontal)
                }
            }
        }
    }

    private func actionCard<Label: View>(_ action: HomeAction, title: String, radius: CGFloat,
                                         @ViewBuilder label: (Color) -> Label) -> some View {
        let dark = colorScheme == .dark
        let paper = tone(dark ? action.paper.dark : action.paper.light)
        let printedTone = tone(dark ? action.printedTone.dark : action.printedTone.light)
        let accent = tone(action.accent(dark: dark))
        let iconColor = dark ? accent : accent.mix(with: LeximoryPalette.ink, by: 0.55)
        return Button(action: handler(for: action)) {
            label(iconColor)
                .foregroundStyle(dark ? tone(action.darkLabel) : LeximoryPalette.ink)
                .background {
                    let shape = RoundedRectangle(cornerRadius: radius)
                    if contrast == .increased {
                        shape.fill(paper)
                    } else {
                        BrowserHomeActionDither(paper: paper, ink: printedTone)
                            .clipShape(shape)
                    }
                }
                .contentShape(.rect(cornerRadius: radius))
        }
        .buttonStyle(BrowserCardButtonStyle())
        .accessibilityLabel(title)
        .accessibilityIdentifier(action.identifier)
        .matchedGeometryEffect(id: action, in: cardNamespace)
    }

    private func tone(_ value: UInt32) -> Color {
        Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }

    @ViewBuilder private func compactActionLabel(_ title: String, symbol: String, iconColor: Color, horizontal: Bool) -> some View {
        if horizontal {
            VStack(spacing: 8) {
                Image(systemName: symbol).font(.system(size: 22, weight: .medium)).foregroundStyle(iconColor)
                Text(title).displayFont(19, relativeTo: .headline)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 96)
        } else {
            HStack(spacing: 20) {
                Image(systemName: symbol).font(.system(size: 22, weight: .medium)).foregroundStyle(iconColor).frame(width: 44)
                Text(title).displayFont(19, relativeTo: .headline)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").font(.body.weight(.medium)).foregroundStyle(iconColor)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 58)
        }
    }

    private var pinsPanel: some View {
        BrowserHomePanel(title: "固定", symbol: "pin", identifier: "browser-home-pins") {
            if pins.isEmpty {
                Text("打开内容后即可固定")
                    .interfaceFont(13, style: .footnote)
                    .foregroundStyle(.primary.opacity(0.70))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                BrowserHomeShortcutLayout(accessibility: typeSize.isAccessibilitySize) {
                    ForEach(pins) { pin in pinButton(pin) }
                }
                .frame(maxHeight: .infinity)
            }
        }
    }

    private func pinButton(_ pin: BrowserHomePin) -> some View {
        Button { openPin(pin) } label: {
            VStack(spacing: BrowserHomePanelMetrics.labelSpacing) {
                Group {
                    if let url = pin.iconURL, let image = pinImages[url] {
                        Image(uiImage: image).resizable().scaledToFit()
                    } else if case .document(let text) = pin.destination {
                        BrowserTextIcon(text: text)
                    } else {
                        Image(systemName: pin.symbol).font(.system(size: 21))
                    }
                }
                .frame(width: 24, height: 24)
                .accessibilityHidden(true)

                Text(pin.title)
                    .interfaceFont(13, style: .footnote)
                    .lineLimit(typeSize.isAccessibilitySize ? nil : 2)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 44, maxHeight: .infinity, alignment: .top)
            .contentShape(.rect)
        }
        .buttonStyle(BrowserHomeButtonStyle())
        .accessibilityLabel(pin.title)
        .accessibilityIdentifier("browser-pin-" + pin.id.uuidString)
        .contextMenu {
            Button("编辑", systemImage: "pencil") { editPin(pin) }
            Button(role: .destructive) { deletePin(pin) } label: {
                Label {
                    Text("删除")
                } icon: {
                    Image(uiImage: UIImage(systemName: "trash")!.withTintColor(.systemRed, renderingMode: .alwaysOriginal))
                }
            }
            .tint(.red)
        }
    }

    private var recentsPanel: some View {
        let resources = readingResources
        let page = recentWebpage
        return BrowserHomePanel(title: "继续浏览", symbol: "clock", identifier: "browser-home-recents") {
            if resources.isEmpty && page == nil {
                Text("浏览过的网页和读过的内容会显示在这里")
                    .interfaceFont(13, style: .footnote)
                    .foregroundStyle(.primary.opacity(0.70))
                    .frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
            } else {
                VStack(alignment: .leading, spacing: 5) {
                    if let page {
                        Button { openWebpage(page) } label: {
                            recentRow(title: page.displayTitle, byline: page.url.host ?? "", identity: page.url.absoluteString) {
                                if let url = page.iconURL, let image = recentImages[url] {
                                    Image(uiImage: image).resizable().scaledToFit()
                                } else {
                                    Image(systemName: "globe")
                                }
                            }
                        }
                        .buttonStyle(BrowserHomeButtonStyle())
                        .accessibilityLabel("\(page.displayTitle)，网页").accessibilityValue(page.url.host ?? "")
                        .accessibilityIdentifier("browser-recent-webpage-" + page.url.absoluteString)
                        .contextMenu {
                            Button("从主页隐藏", systemImage: "eye.slash") { hideRecentWebpage(page) }
                        }
                    }
                    ForEach(resources) { text in
                        Button { resume(text) } label: {
                            recentRow(title: text.title, byline: libraryName(text), identity: text.id) {
                                BrowserTextIcon(text: text)
                            }
                        }
                        .buttonStyle(BrowserHomeButtonStyle())
                        .accessibilityLabel("\(text.title)，\(text.format == "ebook" ? "电子书" : "文章")")
                        .accessibilityValue(libraryName(text))
                        .accessibilityIdentifier("browser-resume-" + text.id)
                        .contextMenu {
                            Button("从主页隐藏", systemImage: "eye.slash") { hideRecentText(text) }
                        }
                    }
                }
            }
        }
    }

    private func recentRow<Icon: View>(title: String, byline: String, identity: String, @ViewBuilder icon: () -> Icon) -> some View {
        HStack(spacing: 10) {
            icon()
                .font(.body)
                .frame(width: 20, height: 20)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(LeximoryTypography.scaledChineseText(title, size: recentTitleSize))
                    .lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
                if !byline.isEmpty {
                    Text(byline)
                        .interfaceFont(12, style: .caption1)
                        .foregroundStyle(.primary.opacity(0.70))
                        .lineLimit(typeSize.isAccessibilitySize ? 2 : 1)
                        .accessibilityIdentifier("browser-recent-byline-" + identity)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 4)
        .frame(minHeight: 44)
        .contentShape(.rect)
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

private struct BrowserHomeButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.65 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: configuration.isPressed)
    }
}

private struct BrowserCardButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .animation(reduceMotion ? nil : .spring(response: 0.22, dampingFraction: 0.75), value: configuration.isPressed)
    }
}

struct BrowserHomeShortcutLayout: Layout {
    var accessibility: Bool
    private let spacing = BrowserHomePanelMetrics.pinSpacing

    private var preferredItemWidth: CGFloat { accessibility ? 112 : 76 }

    func columnCapacity(for width: CGFloat) -> Int {
        let space = max(0, width) + spacing
        let preferred = max(1, Int(space / (preferredItemWidth + spacing)))
        guard !accessibility else { return preferred }
        let compact = Int(space / (44 + spacing))
        return max(preferred, min(4, compact))
    }

    func rows(for width: CGFloat, count: Int) -> [Range<Int>] {
        let capacity = columnCapacity(for: width)
        let rowCount = max(1, (count + capacity - 1) / capacity)
        let columns = max(1, (count + rowCount - 1) / rowCount)
        return stride(from: 0, to: count, by: columns).map { $0..<min($0 + columns, count) }
    }

    private func itemWidth(_ width: CGFloat, columns: Int) -> CGFloat {
        let space = width - CGFloat(columns - 1) * spacing
        return min(preferredItemWidth, space / CGFloat(columns))
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = max(0, proposal.width ?? 328)
        let rows = rows(for: width, count: subviews.count)
        let itemWidth = itemWidth(width, columns: rows.first?.count ?? 1)
        let heights = rowHeights(rows, subviews: subviews, width: itemWidth)
        let height = heights.reduce(0, +) + CGFloat(max(0, heights.count - 1)) * spacing
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = rows(for: bounds.width, count: subviews.count)
        let width = itemWidth(bounds.width, columns: rows.first?.count ?? 1)
        let heights = rowHeights(rows, subviews: subviews, width: width)
        var y = bounds.minY
        for (row, height) in zip(rows, heights) {
            let rowWidth = CGFloat(row.count) * width + CGFloat(row.count - 1) * spacing
            let leading = bounds.midX - rowWidth / 2
            for (column, index) in row.enumerated() {
                subviews[index].place(at: CGPoint(x: leading + CGFloat(column) * (width + spacing), y: y),
                    anchor: .topLeading, proposal: .init(width: width, height: height))
            }
            y += height + spacing
        }
    }

    private func rowHeights(_ rows: [Range<Int>], subviews: Subviews, width: CGFloat) -> [CGFloat] {
        rows.map { row in
            subviews[row].map { $0.sizeThatFits(.init(width: width, height: nil)).height }.max() ?? 0
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
                ToolbarItem(placement: .cancellationAction) { LeximorySheetCloseButton("取消") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("保存", systemImage: "checkmark") {
                        var updated = pin
                        updated.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        if case .webpage(let originalURL, let bookmarkID) = pin.destination,
                           let url = TextBrowserModel.address(address) {
                            updated.destination = .webpage(url, bookmarkID: url == originalURL ? bookmarkID : nil)
                            if url != originalURL { updated.faviconURL = nil; updated.faviconData = nil }
                        }
                        save(updated)
                        dismiss()
                    }.labelStyle(.iconOnly).disabled(!valid)
                }
            }
        }.leximorySheetStyle().presentationDetents([.height(sectionHeight * (isWebpage ? 2 : 1) + 88), .large])
    }
}
