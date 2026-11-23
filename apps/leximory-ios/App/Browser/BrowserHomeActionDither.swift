import SwiftUI

struct BrowserHomeActionDither: View {
    let paper: Color
    let ink: Color
    @Environment(\.displayScale) private var displayScale

    private static let bayer4x4 = [
         0,  8,  2, 10,
        12,  4, 14,  6,
         3, 11,  1,  9,
        15,  7, 13,  5
    ]

    var body: some View {
        let dotSize = max(1, (displayScale * 1.5).rounded()) / displayScale
        return Canvas(opaque: true) { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(paper))
            let columns = size.width / dotSize
            let rows = size.height / dotSize
            guard columns > 0, rows > 0 else { return }
            let columnCount = Int(columns.rounded(.up))

            var dots = Path()
            for y in 0..<Int(rows.rounded(.up)) {
                let inkStart = 0.60 - 0.15 * CGFloat(y) / rows
                let firstDot = Int((inkStart * columns).rounded(.down))
                let matrixRow = (y % 4) * 4
                for x in firstDot..<columnCount {
                    let coverage = (CGFloat(x) / columns - inkStart) * 1.25
                    let threshold = (CGFloat(Self.bayer4x4[matrixRow + x % 4]) + 0.5) / 16
                    if coverage > threshold {
                        dots.addRect(CGRect(x: CGFloat(x) * dotSize, y: CGFloat(y) * dotSize,
                            width: dotSize, height: dotSize))
                    }
                }
            }
            context.fill(dots, with: .color(ink))
        }
    }
}
