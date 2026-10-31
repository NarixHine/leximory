import SwiftUI
import LeximoryCore

struct AccountActivityCalendar: View {
    let details: AccountSettings
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "Asia/Shanghai")!
        return value
    }
    private var today: Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"; formatter.timeZone = calendar.timeZone
        return formatter.date(from: details.today) ?? Date()
    }
    private var days: [Day] {
        let components = calendar.dateComponents([.year, .month], from: today)
        guard let first = calendar.date(from: components), let range = calendar.range(of: .day, in: .month, for: first) else { return [] }
        let offset = calendar.component(.weekday, from: first) - 1
        let counts = Dictionary(details.activity.map { ($0.date, $0.count) }, uniquingKeysWith: +)
        let prefix = String(details.today.prefix(7))
        return (0..<offset).map { Day(id: "blank-\($0)", number: nil, count: nil) } + range.map { number in
            let key = String(format: "%@-%02d", prefix, number)
            return Day(id: key, number: number, count: key > details.today ? nil : (counts[key] ?? 0))
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Label("入库词汇", systemImage: "book.closed").interfaceFont(15, semibold: true, style: .subheadline).foregroundStyle(.secondary)
                Spacer()
                Text(today.formatted(.dateTime.year().month().locale(Locale(identifier: "zh_CN")))).foregroundStyle(.secondary)
                    .interfaceFont(13, style: .footnote)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 6) {
                ForEach(["日", "一", "二", "三", "四", "五", "六"], id: \.self) { name in
                    Text(name).foregroundStyle(.secondary).interfaceFont(12, style: .caption1).accessibilityHidden(true)
                }
                ForEach(days) { day in
                    if let number = day.number {
                        let colors = AccountHeatmapPalette.colors(for: day.count)
                        Text("\(number)").interfaceFont(13, style: .footnote).monospacedDigit()
                            .frame(maxWidth: .infinity, minHeight: 34)
                            .foregroundStyle(colors.foreground)
                            .background(colors.background, in: .rect(cornerRadius: 8))
                            .overlay { if day.id == details.today { RoundedRectangle(cornerRadius: 8).strokeBorder(colors.foreground.opacity(0.65), lineWidth: 1) } }
                            .accessibilityLabel(day.count.map { "\(day.id)，入库词汇 \($0) 个\(day.id == details.today ? "，今天" : "")" } ?? day.id)
                    } else { Color.clear.frame(height: 34).accessibilityHidden(true) }
                }
            }
            HStack(spacing: 5) {
                Text("少")
                ForEach(AccountHeatmapPalette.thresholds, id: \.self) { count in
                    RoundedRectangle(cornerRadius: 3).fill(AccountHeatmapPalette.colors(for: count).background).frame(width: 10, height: 10)
                }
                Text("多")
            }.interfaceFont(11, style: .caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .trailing).accessibilityHidden(true)
        }.padding(20).background(Color(uiColor: .secondarySystemGroupedBackground), in: .rect(cornerRadius: 24))
    }
    private struct Day: Identifiable { let id: String; let number: Int?; let count: Int? }
}

enum AccountHeatmapPalette {
    static let thresholds = [0, 1, 10, 20, 35]
    private static let shades: [UInt32] = [0xEDEEC9, 0xDDE7C7, 0xBFD8BD, 0x98C9A3, 0x77BFA3]

    static func colors(for count: Int?) -> (background: Color, foreground: Color) {
        guard let count else { return (.clear, .secondary) }
        let level = thresholds.lastIndex { count >= $0 } ?? 0
        let hex = shades[level]
        let red = Double((hex >> 16) & 255) / 255
        let green = Double((hex >> 8) & 255) / 255
        let blue = Double(hex & 255) / 255
        return (Color(red: red, green: green, blue: blue), .black)
    }
}
