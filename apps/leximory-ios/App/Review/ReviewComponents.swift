import SwiftUI

/// The review page intentionally follows the web's muted vocabulary palette.
enum ReviewStyle {
    static let word = color(0x455745, 0xCECDC3)
    static let meta = color(0x9CAEA1, 0x878580)
    static let language = color(0x768C75, 0xA1A1AA)
    static let pill = color(0xF5F7F5, 0x27272A)
    static let segment = color(0xE7ECE7, 0x3F3F46)
    static let today = color(0xFCFCFD, 0x18181B)
    static let todayBorder = color(0xF3F4F6, 0x27272A)
    static let chart = color(0x6B7280, 0xA1A1AA)

    static func mono(_ size: CGFloat) -> Font {
        Font(UIFontMetrics(forTextStyle: .caption1).scaledFont(for: LeximoryTypography.face("SpaceMono-Regular", size: size)))
    }
    private static func color(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let value = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(value >> 16 & 255) / 255, green: CGFloat(value >> 8 & 255) / 255,
                           blue: CGFloat(value & 255) / 255, alpha: 1)
        })
    }
}

/// Content-sized wrapping, matching the web's flex-wrap rows at any text size.
struct ReviewFlowLayout: Layout {
    var spacing: CGFloat = 8
    var rowSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(width: proposal.width ?? .infinity, subviews: subviews).size
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let layout = arrange(width: bounds.width, subviews: subviews)
        for (index, point) in layout.points.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y),
                                 proposal: ProposedViewSize(layout.sizes[index]))
        }
    }
    private func arrange(width: CGFloat, subviews: Subviews) -> (size: CGSize, points: [CGPoint], sizes: [CGSize]) {
        var points: [CGPoint] = [], sizes: [CGSize] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, usedWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(ProposedViewSize(width: width, height: nil))
            if x > 0 && x + size.width > width {
                x = 0; y += rowHeight + rowSpacing; rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y)); sizes.append(size)
            usedWidth = max(usedWidth, x + size.width)
            x += size.width + spacing; rowHeight = max(rowHeight, size.height)
        }
        return (CGSize(width: width.isFinite ? width : usedWidth, height: y + rowHeight), points, sizes)
    }
}

struct ReviewProgressView: View {
    let value: Int
    var language: String? = nil
    var conversationCompleted = false
    var showThresholds = false

    var body: some View {
        let state = value < 1 ? 0 : value < 30 ? 1 : value < 60 ? 2 : 3
        HStack(spacing: 8) {
            if let language { Text(language.uppercased()).font(ReviewStyle.mono(14)).foregroundStyle(ReviewStyle.language) }
            VStack(spacing: 4) {
                if showThresholds {
                    HStack(spacing: 0) {
                        ForEach(["0%", "1%", "30%", "60%"], id: \.self) { label in
                            Text(label).frame(width: 35)
                        }
                    }.font(ReviewStyle.mono(12)).foregroundStyle(ReviewStyle.meta)
                }
                HStack(spacing: 2) {
                    ForEach(1...3, id: \.self) { step in
                        UnevenRoundedRectangle(topLeadingRadius: step == 1 ? 4 : 0,
                                               bottomLeadingRadius: step == 1 ? 4 : 0,
                                               bottomTrailingRadius: step == 3 ? 4 : 0,
                                               topTrailingRadius: step == 3 ? 4 : 0)
                            .fill(state >= step ? ReviewStyle.meta : ReviewStyle.segment)
                            .frame(width: 32, height: 8)
                    }
                }
            }
            if !showThresholds { Image(systemName: conversationCompleted ? "star.fill" : state >= 3 ? "star" : "cursorarrow.rays")
                .font(.system(size: 16, weight: .regular)).foregroundStyle(ReviewStyle.meta) }
        }.accessibilityElement(children: .ignore).accessibilityLabel("复习进度 \(value)%")
    }
}

private struct ReviewTaskID: LayoutValueKey { static let defaultValue = "" }
extension View {
    func reviewTaskID(_ id: String, onPosition: @escaping (CGPoint) -> Void) -> some View {
        layoutValue(key: ReviewTaskID.self, value: id)
            .onGeometryChange(for: CGPoint.self) { proxy in
                let frame = proxy.frame(in: .named("review-lawn"))
                return CGPoint(x: frame.midX, y: frame.midY)
            } action: { onPosition($0) }
    }
}

/// Seeded placement preserves the web lawn's composition; measured frames avoid collisions.
struct ReviewLawnLayout: Layout {
    let seed: String
    let portrait: Bool
    let height: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        CGSize(width: proposal.width ?? 360, height: height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var occupied: [CGRect] = []
        for view in subviews {
            let size = view.sizeThatFits(ProposedViewSize(width: max(0, bounds.width - 40), height: nil))
            var rng = Generator(seed: hash("\(Int32(bitPattern: hash(seed)))-\(view[ReviewTaskID.self])"))
            var best = CGPoint(x: bounds.midX, y: bounds.midY)
            var fewest = Int.max
            for _ in 0..<120 {
                let x = portrait ? 10 + rng.next() * 80 : 20 + rng.next() * 60
                let y = portrait ? 46 + rng.next() * 40 : 26 + rng.next() * 40
                let raw = portrait ? CGPoint(x: 100 - y, y: x) : CGPoint(x: x, y: y)
                let point = CGPoint(x: min(bounds.maxX - size.width / 2 - 12, max(bounds.minX + size.width / 2 + 12, bounds.minX + bounds.width * raw.x / 100)),
                                    y: min(bounds.maxY - size.height / 2 - 12, max(bounds.minY + size.height / 2 + 12, bounds.minY + bounds.height * raw.y / 100)))
                let rect = CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height)
                let collisions = occupied.filter { $0.insetBy(dx: -10, dy: -10).intersects(rect) }.count
                if collisions < fewest { fewest = collisions; best = point }
                if collisions == 0 { break }
            }
            occupied.append(CGRect(x: best.x - size.width / 2, y: best.y - size.height / 2, width: size.width, height: size.height))
            view.place(at: best, anchor: .center, proposal: ProposedViewSize(size))
        }
    }
    private func hash(_ string: String) -> UInt32 { string.utf16.reduce(UInt32(0)) { ($0 &* 31) &+ UInt32($1) } }
    private struct Generator {
        var seed: UInt32
        mutating func next() -> CGFloat {
            seed = seed &* 1_664_525 &+ 1_013_904_223
            return CGFloat(seed) / 4_294_967_296
        }
    }
}
