import SwiftUI

enum BrowserWorkspaceMeasure {
    static let horizontalInset: CGFloat = 12
    static let maximumWidth: CGFloat = 720
}

enum BrowserHomePanelMetrics {
    static let inset: CGFloat = 16
}

enum BrowserHomeActivityLayout {
    case compact, fullWidth, wide(CGFloat)

    var wideWidth: CGFloat? {
        if case .wide(let width) = self { return width }
        return nil
    }

    var hasInlineSummary: Bool {
        if case .fullWidth = self { return true }
        return false
    }
}

struct BrowserHomeBento<Activity: View, Actions: View, Pins: View, Recents: View>: View {
    let width: CGFloat
    let pinCount: Int
    @ViewBuilder let activity: (BrowserHomeActivityLayout) -> Activity
    @ViewBuilder let actions: () -> Actions
    @ViewBuilder let pins: () -> Pins
    @ViewBuilder let recents: () -> Recents
    @Environment(\.dynamicTypeSize) private var typeSize

    private let gap: CGFloat = 10

    var body: some View {
        let wide = width >= 650 && typeSize < .xxLarge
        let measure = min(width, BrowserWorkspaceMeasure.maximumWidth)
        let leading = ((measure - gap) * 0.58).rounded(.down)
        let trailing = measure - gap - leading
        let canPair = width >= 310 && typeSize < .xxLarge
        let pinColumns = BrowserHomeShortcutLayout(accessibility: false)
            .columnCapacity(for: trailing - 2 * BrowserHomePanelMetrics.inset)
        let paired = canPair && pinCount <= 2 * pinColumns

        Group {
            if wide {
                VStack(spacing: gap) {
                    Grid(horizontalSpacing: gap) {
                        GridRow {
                            activity(.wide(leading)).frame(width: leading)
                            recents().frame(width: trailing)
                        }
                    }
                    Grid(horizontalSpacing: gap) {
                        GridRow {
                            pins().frame(width: trailing)
                            actions().frame(width: leading)
                        }
                    }
                }
            } else {
                Grid(alignment: .leading, horizontalSpacing: gap, verticalSpacing: gap) {
                    actions().frame(width: measure)
                    if paired {
                        GridRow {
                            activity(.compact).frame(width: leading)
                            pins().frame(width: trailing)
                        }
                    } else {
                        activity(canPair ? .fullWidth : .compact).frame(width: measure)
                        pins().frame(width: measure)
                    }
                    recents().frame(width: measure)
                }
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity)
    }
}

struct BrowserHomePanel<Content: View>: View {
    var title: String? = nil
    var symbol: String? = nil
    let identifier: String
    @ViewBuilder let content: () -> Content
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    var body: some View {
        let dark = colorScheme == .dark
        let shape = RoundedRectangle(cornerRadius: 20)
        let tint = dark ? Color(white: 0.14) : Color(white: 0.99)
        let solid = reduceTransparency || contrast == .increased

        VStack(alignment: .leading, spacing: 8) {
            if let title, let symbol {
                HStack(spacing: 7) {
                    Image(systemName: symbol)
                        .font(.footnote)
                        .frame(width: 14, alignment: .leading)
                        .accessibilityHidden(true)
                    Text(title)
                        .interfaceFont(13, style: .footnote)
                        .accessibilityAddTraits(.isHeader)
                }
                .foregroundStyle(.primary.opacity(0.80))
            }
            content()
        }
        .padding(BrowserHomePanelMetrics.inset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(.primary)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(identifier)
        .background {
            if !solid {
                HomeWallpaperGlassBackdrop(cornerRadius: 20, blurRadius: 14)
            }
            shape.fill(tint.opacity(solid ? 1 : dark ? 0.29 : 0.30))
        }
    }
}

#if DEBUG && targetEnvironment(simulator)
extension EnvironmentValues {
    @Entry var browserHomeActivityFixture: SavedWordsSnapshot? = nil
}
#endif

struct BrowserHomeActivityCell: View {
    let account: (origin: URL, id: String)?
    let layout: BrowserHomeActivityLayout
    @AppStorage(SavedWordsWidgetStore.key, store: UserDefaults(suiteName: SavedWordsWidgetStore.appGroup))
    private var storedActivity: Data?
#if DEBUG && targetEnvironment(simulator)
    @Environment(\.browserHomeActivityFixture) private var fixture
#endif

    var body: some View {
        let cached = account.flatMap {
            SavedWordsWidgetStore.snapshot(for: $0.origin, accountID: $0.id, in: storedActivity)
        }
#if DEBUG && targetEnvironment(simulator)
        let snapshot = fixture ?? cached
#else
        let snapshot = cached
#endif
        let calendar = SavedWordsSnapshot.calendar
        TimelineView(.periodic(from: calendar.startOfDay(for: .now), by: 24 * 60 * 60)) { _ in
            BrowserHomeActivityPanel(snapshot: snapshot, today: .now, layout: layout)
        }
    }
}

private struct BrowserHomeActivityPanel: View {
    let snapshot: SavedWordsSnapshot?
    let today: Date
    let layout: BrowserHomeActivityLayout
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.colorScheme) private var colorScheme

    private var dayCount: Int { layout.wideWidth == nil ? 30 : 100 }

    var body: some View {
        let calendar = SavedWordsSnapshot.calendar
        let end = calendar.startOfDay(for: today)
        let dates = (1 - dayCount...0).compactMap { calendar.date(byAdding: .day, value: $0, to: end) }
        let counts = Dictionary(snapshot?.days.map { ($0.date, $0.count) } ?? [], uniquingKeysWith: +)
        let total = dates.allSatisfy { counts[$0] != nil }
            ? dates.reduce(0) { $0 + (counts[$1] ?? 0) }
            : nil

        BrowserHomePanel(title: "词汇足迹", symbol: "calendar", identifier: "browser-home-activity") {
            if layout.hasInlineSummary {
                HStack(spacing: 16) {
                    heatmap(dates: dates, counts: counts)
                    summary(total)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            } else {
                heatmap(dates: dates, counts: counts)
                summary(total)
            }
        }
    }

    private func summary(_ total: Int?) -> some View {
        let statsLayout = if layout.hasInlineSummary {
            AnyLayout(VStackLayout(alignment: .trailing, spacing: 4))
        } else if typeSize >= .xxLarge {
            AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
        } else {
            AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 5))
        }
        return statsLayout {
            if let total {
                Text(total.formatted() + " 词")
                    .editorialFont(layout.hasInlineSummary ? 24 : 16, relativeTo: .callout)
                    .accessibilityLabel("入库 \(total) 个词汇")
                    .accessibilityIdentifier("browser-home-word-total")
            }

            Text("近 \(dayCount) 天")
                .interfaceFont(12, style: .caption1)
                .foregroundStyle(.primary.opacity(0.75))
                .frame(maxWidth: layout.wideWidth == nil ? nil : .infinity, alignment: .trailing)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func heatmap(dates: [Date], counts: [Date: Int]) -> some View {
        let calendar = SavedWordsSnapshot.calendar
        let leading = (calendar.component(.weekday, from: dates.first ?? today) + 5) % 7
        let weeks = (leading + dates.count + 6) / 7
        let wide = layout.wideWidth != nil
        let gap: CGFloat = 3
        let side = layout.wideWidth.map {
            max(1, ($0 - 2 * BrowserHomePanelMetrics.inset - CGFloat(weeks - 1) * gap) / CGFloat(weeks))
        } ?? (layout.hasInlineSummary ? 18 : 15)
        let columns = wide ? weeks : 7
        let rows = wide ? 7 : weeks
        let accent = colorScheme == .dark ? Color(red: 0.68, green: 0.82, blue: 0.57)
            : Color(red: 0.24, green: 0.43, blue: 0.28)
        let formatter = Date.FormatStyle(date: .abbreviated, time: .omitted, locale: Locale(identifier: "zh_CN"),
            calendar: calendar, timeZone: calendar.timeZone)

        return VStack(spacing: gap) {
            ForEach(0..<rows, id: \.self) { row in
                HStack(spacing: gap) {
                    ForEach(0..<columns, id: \.self) { column in
                        let index = (wide ? column * 7 + row : row * 7 + column) - leading
                        let square = RoundedRectangle(cornerRadius: 2.5)
                        let count = dates.indices.contains(index) ? counts[dates[index]] : nil
                        let isToday = index == dates.count - 1
                        let fill = count.map { count in
                            count == 0 ? Color.primary.opacity(isToday ? 0.20 : 0.10) : accent.opacity(intensity(for: count))
                        }
                        square.fill(dates.indices.contains(index) ? fill ?? .primary.opacity(0.035) : .clear)
                            .frame(width: side, height: side)
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("每日入库词汇")
        .accessibilityChildren {
            ForEach(dates, id: \.self) { date in
                Text(date.formatted(formatter))
                    .accessibilityValue(counts[date].map { "\($0) 个词汇" } ?? "暂无记录")
            }
        }
    }

    private func intensity(for count: Int) -> Double {
        switch count {
        case 1..<5: 0.34
        case 5..<10: 0.56
        case 10..<20: 0.78
        default: 1
        }
    }
}
