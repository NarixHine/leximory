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
        return (0..<offset).map { Day(id: "blank-\($0)", number: nil, count: 0) } + range.map { number in
            let key = String(format: "%@-%02d", prefix, number)
            return Day(id: key, number: number, count: counts[key] ?? 0)
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Label("入库词汇", systemImage: "book.closed").font(LeximoryTypography.interface(14, style: .subheadline))
                Spacer()
                Text(today.formatted(.dateTime.year().month().locale(Locale(identifier: "zh_CN")))).foregroundStyle(.secondary)
                    .font(LeximoryTypography.interface(13, style: .caption1))
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 6) {
                ForEach(["日", "一", "二", "三", "四", "五", "六"], id: \.self) { name in
                    Text(name).foregroundStyle(.secondary).font(LeximoryTypography.interface(12, style: .caption1)).accessibilityHidden(true)
                }
                ForEach(days) { day in
                    if let number = day.number {
                        Text("\(number)").font(LeximoryTypography.interface(13, style: .caption1)).monospacedDigit()
                            .frame(maxWidth: .infinity, minHeight: 34)
                            .foregroundStyle(day.count >= 20 ? LeximoryPalette.paper : LeximoryPalette.ink)
                            .background(day.count == 0 ? LeximoryPalette.cover : LeximoryPalette.ink.opacity(opacity(day.count)), in: .rect(cornerRadius: 8))
                            .overlay { if day.id == details.today { RoundedRectangle(cornerRadius: 8).strokeBorder(LeximoryPalette.ink, lineWidth: 1) } }
                            .accessibilityLabel("\(day.id)，入库词汇 \(day.count) 个\(day.id == details.today ? "，今天" : "")")
                    } else { Color.clear.frame(height: 34).accessibilityHidden(true) }
                }
            }
            HStack(spacing: 5) {
                Text("少")
                ForEach([0, 1, 5, 10, 15, 20, 25, 30, 35, 45], id: \.self) { count in
                    RoundedRectangle(cornerRadius: 3).fill(count == 0 ? LeximoryPalette.cover : LeximoryPalette.ink.opacity(opacity(count))).frame(width: 10, height: 10)
                }
                Text("多")
            }.font(LeximoryTypography.interface(11, style: .caption2)).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .trailing).accessibilityHidden(true)
        }.padding(20).background(LeximoryPalette.shell, in: .rect(cornerRadius: 24))
    }
    private func opacity(_ count: Int) -> Double {
        switch count { case 45...: 1; case 35...: 0.9; case 30...: 0.8; case 25...: 0.7; case 20...: 0.6; case 15...: 0.45; case 10...: 0.3; case 5...: 0.2; default: 0.1 }
    }
    private struct Day: Identifiable { let id: String; let number: Int?; let count: Int }
}
