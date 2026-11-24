import SwiftUI

enum BrowserWorkspaceMeasure {
    static let horizontalInset: CGFloat = 12
    static let maximumWidth: CGFloat = 720
}

enum BrowserHomePanelMetrics {
    static let inset: CGFloat = 16
    static let sectionSpacing: CGFloat = 12
    static let pinSpacing: CGFloat = 8
    static let labelSpacing: CGFloat = 6
}

struct BrowserHomeBento<Activity: View, Actions: View, Pins: View, Recents: View>: View {
    let width: CGFloat
    let pinCount: Int
    @ViewBuilder let activity: (CGFloat) -> Activity
    @ViewBuilder let actions: () -> Actions
    @ViewBuilder let pins: () -> Pins
    @ViewBuilder let recents: () -> Recents
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let gap = BrowserHomePanelMetrics.sectionSpacing
        let wide = width >= 650 && typeSize < .xxLarge
        let measure = min(width, BrowserWorkspaceMeasure.maximumWidth)
        let leading = ((measure - gap) * 0.58).rounded(.down)
        let trailing = measure - gap - leading
        let canPair = width >= 310 && typeSize < .xxLarge
        let pairedActivityWidth = pinCount == 2 ? ((measure - gap) * 0.52).rounded(.down) : leading
        let pairedPinsWidth = measure - gap - pairedActivityWidth
        let pinColumns = BrowserHomeShortcutLayout(accessibility: false)
            .columnCapacity(for: pairedPinsWidth - 2 * BrowserHomePanelMetrics.inset)
        let paired = canPair && pinCount <= pinColumns

        Group {
            if wide {
                VStack(spacing: gap) {
                    Grid(horizontalSpacing: gap) {
                        GridRow {
                            activity(leading).frame(width: leading)
                            recents().frame(width: trailing)
                        }
                    }
                    Grid(horizontalSpacing: gap) {
                        GridRow(alignment: .top) {
                            pins().frame(width: trailing)
                            actions().frame(width: leading)
                        }
                    }
                }
            } else {
                Grid(alignment: .leading, horizontalSpacing: gap, verticalSpacing: gap) {
                    actions().frame(width: measure)
                    if paired {
                        GridRow(alignment: .top) {
                            activity(pairedActivityWidth).frame(width: pairedActivityWidth)
                            pins().fixedSize(horizontal: false, vertical: true).frame(width: pairedPinsWidth)
                        }
                    } else {
                        activity(measure).frame(width: measure)
                        pins().fixedSize(horizontal: false, vertical: true).frame(width: measure)
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
    let title: String
    let symbol: String
    let identifier: String
    @ViewBuilder let content: () -> Content
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast
    @ScaledMetric(relativeTo: .subheadline) private var headingSymbolWidth: CGFloat = 16
    // The visible ink of the fixed headings centers 5.3 pt above the baseline at 18 pt.
    @ScaledMetric(relativeTo: .subheadline) private var headingInkCenterAboveBaseline: CGFloat = 5.3

    var body: some View {
        let dark = colorScheme == .dark
        let shape = RoundedRectangle(cornerRadius: 20)
        let tint = dark ? Color(white: 0.14) : Color(white: 0.99)
        let solid = reduceTransparency || contrast == .increased
        let inkCenter = headingInkCenterAboveBaseline

        VStack(alignment: .leading, spacing: BrowserHomePanelMetrics.sectionSpacing) {
            HStack(spacing: BrowserHomePanelMetrics.labelSpacing) {
                Image(systemName: symbol)
                    .font(.subheadline)
                    .frame(width: headingSymbolWidth, alignment: .leading)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.custom("Fontquan-XinYiJiXiangSong-Regular", size: 18, relativeTo: .subheadline))
                    .alignmentGuide(VerticalAlignment.center) { dimensions in
                        dimensions[.firstTextBaseline] - inkCenter
                    }
                    .accessibilityAddTraits(.isHeader)
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
            shape.fill(tint.opacity(solid ? 1 : dark ? 0.29 : 0.45))
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
    let width: CGFloat
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
            BrowserHomeActivityPanel(snapshot: snapshot, today: .now, width: width)
        }
    }
}

private struct BrowserHomeActivityPanel: View {
    let snapshot: SavedWordsSnapshot?
    let today: Date
    let width: CGFloat
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let calendar = SavedWordsSnapshot.calendar
        let end = calendar.startOfDay(for: today)
        let weekday = (calendar.component(.weekday, from: end) + 5) % 7
        let counts = Dictionary(snapshot?.days.map { ($0.date, $0.count) } ?? [], uniquingKeysWith: +)
        let contentWidth = max(0, width - 2 * BrowserHomePanelMetrics.inset)
        let idealHeight = BrowserHomeActivityGrid(width: contentWidth, height: .infinity, weekday: weekday).height

        BrowserHomePanel(title: "词汇足迹", symbol: "calendar", identifier: "browser-home-activity") {
            GeometryReader { geometry in
                let grid = BrowserHomeActivityGrid(width: geometry.size.width,
                    height: geometry.size.height, weekday: weekday)
                let dates = (1 - grid.dayCount...0).compactMap { calendar.date(byAdding: .day, value: $0, to: end) }
                let values = dates.map { counts[$0] }
                heatmap(grid: grid, dates: dates, values: values)
                    .frame(height: grid.height)
            }
            .frame(minHeight: min(56, idealHeight), idealHeight: idealHeight, maxHeight: idealHeight)
        }
    }

    private func heatmap(grid: BrowserHomeActivityGrid, dates: [Date], values: [Int?]) -> some View {
        let calendar = SavedWordsSnapshot.calendar
        let dark = colorScheme == .dark
        let lowActivity = dark ? Color(red: 0.18, green: 0.36, blue: 0.29)
            : Color(red: 0.73, green: 0.87, blue: 0.79)
        let highActivity = dark ? Color(red: 0.51, green: 0.83, blue: 0.66)
            : Color(red: 0.29, green: 0.65, blue: 0.46)
        let noActivity = Color.primary.opacity(0.075)
        let cellShape = RoundedRectangle(cornerRadius: 3)
        let formatter = Date.FormatStyle(date: .abbreviated, time: .omitted, locale: Locale(identifier: "zh_CN"),
            calendar: calendar, timeZone: calendar.timeZone)

        return Canvas { context, _ in
            for index in values.indices {
                let fill = values[index].map { count in
                    guard count > 0 else { return noActivity }
                    let additionalSaves = Double(count - 1)
                    return lowActivity.mix(with: highActivity, by: additionalSaves / (additionalSaves + 9))
                } ?? .primary.opacity(0.035)
                let rect = grid.rect(for: index)
                context.fill(cellShape.path(in: rect), with: .color(fill))
            }
            for index in values.count..<grid.slotCount {
                let rect = grid.rect(for: index)
                let halfSide = rect.width / 2
                let stripes = Path { path in
                    for stripe in -1...1 {
                        let centerX = rect.midX + CGFloat(stripe) * halfSide
                        path.move(to: CGPoint(x: centerX - rect.width, y: rect.midY + rect.height))
                        path.addLine(to: CGPoint(x: centerX + rect.width, y: rect.midY - rect.height))
                    }
                }
                var cell = context
                cell.clip(to: cellShape.path(in: rect))
                cell.stroke(stripes, with: .color(noActivity), lineWidth: rect.width * 0.18)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("每日入库词汇")
        .accessibilityChildren {
            ForEach(Array(zip(dates, values)), id: \.0) { date, value in
                Text(date.formatted(formatter))
                    .accessibilityValue(value.map { "\($0) 个词汇" } ?? "暂无记录")
            }
        }
    }
}

struct BrowserHomeActivityGrid {
    private static let daysPerWeek = 7
    private static let historyLimit = 100
    private static let gap: CGFloat = 3
    private let horizontalInset: CGFloat
    private let side: CGFloat
    let slotCount: Int
    let dayCount: Int

    var height: CGFloat { CGFloat(Self.daysPerWeek) * (side + Self.gap) - Self.gap }

    init(width: CGFloat, height: CGFloat, weekday: Int) {
        let daysPerWeek = Self.daysPerWeek
        let gap = Self.gap
        let preferredColumnPitch: CGFloat = 15
        let trailing = daysPerWeek - 1 - weekday
        let historyColumns = Self.historyLimit / daysPerWeek
        let fittingColumns = max(1, Int((width + gap) / preferredColumnPitch))
        let columns = min(historyColumns, fittingColumns)
        let horizontalGaps = CGFloat(columns - 1) * gap
        let widthPerDay = (width - horizontalGaps) / CGFloat(columns)
        let heightPerDay = (height - CGFloat(daysPerWeek - 1) * gap) / CGFloat(daysPerWeek)
        side = max(0, min(widthPerDay, heightPerDay))
        horizontalInset = (width - CGFloat(columns) * side - horizontalGaps) / 2

        slotCount = columns * daysPerWeek
        dayCount = slotCount - trailing
    }

    func rect(for index: Int) -> CGRect {
        let pitch = side + Self.gap
        let x = horizontalInset + CGFloat(index / Self.daysPerWeek) * pitch
        let y = CGFloat(index % Self.daysPerWeek) * pitch
        return CGRect(x: x, y: y, width: side, height: side)
    }
}
