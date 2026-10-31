import Charts
import SwiftUI
import WidgetKit

struct SavedWordsWidgetView: View {
    let snapshot: SavedWordsSnapshot?
    let family: WidgetFamily
    var date: Date = .now
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .largeTitle) private var numberSize: CGFloat = 60
    @ScaledMetric(relativeTo: .title3) private var titleSize: CGFloat = 20
    @ScaledMetric(relativeTo: .largeTitle) private var todaySize: CGFloat = 44

    private var compact: Bool { family == .systemSmall }
    private var today: Int? { snapshot?.count(on: date) }

    var body: some View {
        GeometryReader { geometry in
            if compact {
                paperPanel {
                    VStack(alignment: .leading, spacing: 0) {
                        title
                        Spacer(minLength: 0)
                        numeral(snapshot?.total, size: min(numberSize, typeSize.isAccessibilitySize ? 52 : 66))
                    }
                    .padding(16)
                }
                .padding(5)
            } else {
                let panelWidth = max(134, geometry.size.width * 0.41)
                ZStack(alignment: .leading) {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .firstTextBaseline, spacing: 5) {
                            Text(today.map { "+\($0)" } ?? "—")
                                .font(.custom("EBGaramond-Regular", fixedSize: min(todaySize, 48)))
                                .lineLimit(1).minimumScaleFactor(0.6)
                                .contentTransition(.numericText(value: Double(today ?? 0)))
                                .animation(reduceMotion ? nil : .smooth(duration: 0.3), value: today)
                            Text("today").interfaceFont(22, style: .title3)
                                .fixedSize()
                            Spacer(minLength: 0)
                        }
                        .padding(.top, 13)
                        if let snapshot {
                            SavedWordsAreaChart(snapshot: snapshot)
                                .padding(.top, 8).padding(.bottom, 10)
                                .padding(.horizontal, -17)
                        } else {
                            Spacer(minLength: 0)
                        }
                    }
                    .padding(.horizontal, 17)
                    .padding(.leading, panelWidth + 5)
                    .foregroundStyle(renderingMode == .fullColor ? .white : LeximoryPalette.ink)

                    paperPanel {
                        VStack(alignment: .leading, spacing: 0) {
                            title
                            Spacer(minLength: 0)
                            numeral(snapshot?.total, size: min(numberSize, typeSize.isAccessibilitySize ? 52 : 66))
                        }
                        .padding(16)
                    }
                    .frame(width: panelWidth)
                    .padding(5)
                }
            }
        }
        .environment(\.locale, Locale(identifier: "en_US"))
        .containerBackground(for: .widget) { LeximoryWidgetMesh() }
        .widgetURL(SavedWordsWidgetLink.home)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    private var title: some View {
        VStack(alignment: .leading, spacing: -6) {
            Text("Words saved")
            Text("over 30 days")
        }
            .font(.custom("EBGaramond-Regular", fixedSize: min(titleSize, 23)))
            .lineLimit(1).minimumScaleFactor(0.8)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    private func numeral(_ count: Int?, size: CGFloat) -> some View {
        Text(count.map { $0.formatted(.number.locale(Locale(identifier: "en_US"))) } ?? "—")
            .font(.custom("EBGaramond-Regular", fixedSize: size)).tracking(-1)
            .lineLimit(1).minimumScaleFactor(0.45)
            .contentTransition(.numericText(value: Double(count ?? 0)))
            .animation(reduceMotion ? nil : .smooth(duration: 0.3), value: count)
            .widgetAccentable()
            .padding(.bottom, -8)
    }

    private func paperPanel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content().frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .foregroundStyle(LeximoryPalette.ink)
            .background(LeximoryPalette.paper, in: .rect(cornerRadius: 23))
    }

    private var accessibilitySummary: String {
        guard let snapshot else { return "Leximory. Open the app to see your saved words." }
        return "Leximory. \(snapshot.total) words saved in 30 days. \(today ?? 0) saved today."
    }
}

struct SavedWordsAreaChart: View {
    let snapshot: SavedWordsSnapshot
    @Environment(\.widgetRenderingMode) private var renderingMode

    var body: some View {
        Chart(snapshot.cumulativeDays) { day in
            AreaMark(x: .value("Day", day.date), y: .value("Words", day.count))
                .interpolationMethod(.monotone)
                .foregroundStyle(LinearGradient(colors: [.white.opacity(0.48), .white.opacity(0)],
                    startPoint: .top, endPoint: .bottom))
            LineMark(x: .value("Day", day.date), y: .value("Words", day.count))
                .interpolationMethod(.monotone)
                .foregroundStyle(renderingMode == .fullColor ? .white : LeximoryPalette.ink)
                .lineStyle(StrokeStyle(lineWidth: 1, lineCap: .round))
        }
        .chartXScale(range: .plotDimension(padding: 1))
        .chartYScale(domain: 0...max(5, Double(snapshot.total) * 1.15), range: .plotDimension(padding: 1))
        .chartXAxis(.hidden).chartYAxis(.hidden).chartLegend(.hidden)
        .accessibilityHidden(true)
    }
}
