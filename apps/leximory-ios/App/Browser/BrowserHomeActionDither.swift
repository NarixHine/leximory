import SwiftUI

struct BrowserHomeActionDither: View {
    let paper: Color
    let ink: Color
    @Environment(\.displayScale) private var displayScale

    private static let bayer8x8 = [
         0, 32,  8, 40,  2, 34, 10, 42,
        48, 16, 56, 24, 50, 18, 58, 26,
        12, 44,  4, 36, 14, 46,  6, 38,
        60, 28, 52, 20, 62, 30, 54, 22,
         3, 35, 11, 43,  1, 33,  9, 41,
        51, 19, 59, 27, 49, 17, 57, 25,
        15, 47,  7, 39, 13, 45,  5, 37,
        63, 31, 55, 23, 61, 29, 53, 21
    ]

    var body: some View {
        let dotSize = max(1, (displayScale * 1.25).rounded()) / displayScale
        return Canvas(opaque: true) { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(paper))
            let columns = size.width / dotSize
            let rows = size.height / dotSize
            guard columns > 0, rows > 0 else { return }
            let columnCount = Int(columns.rounded(.up))

            var dots = Path()
            for y in 0..<Int(rows.rounded(.up)) {
                let depth = CGFloat(y) / rows
                let start = 0.64 - 0.21 * depth * depth
                let firstColumn = Int((start * columns).rounded(.down))
                let matrixRow = (y % 8) * 8
                for x in firstColumn..<columnCount {
                    let progress = max(0, (CGFloat(x) / columns - start) / (1 - start))
                    let coverage = 0.56 * progress * progress * (3 - 2 * progress)
                    let threshold = (CGFloat(Self.bayer8x8[matrixRow + x % 8]) + 0.5) / 64
                    if coverage > threshold {
                        dots.addRect(CGRect(x: CGFloat(x) * dotSize, y: CGFloat(y) * dotSize,
                            width: dotSize, height: dotSize))
                    }
                }
            }
            context.fill(dots, with: .color(ink))
        }
        .accessibilityHidden(true)
    }
}
