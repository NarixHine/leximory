import SwiftUI

struct BrowserHomeActionDither: View {
    let paper: Color
    let ink: Color

    private static let bayer4x4 = [
         0,  8,  2, 10,
        12,  4, 14,  6,
         3, 11,  1,  9,
        15,  7, 13,  5
    ]

    var body: some View {
        Canvas(opaque: true) { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(paper))
            let width = Int(size.width.rounded(.up))
            let height = Int(size.height.rounded(.up))
            guard width > 0, height > 0 else { return }

            var dots = Path()
            for y in 0..<height {
                let inkStart = 0.60 - 0.15 * CGFloat(y) / size.height
                let firstDot = Int((inkStart * size.width).rounded(.down))
                let matrixRow = (y % 4) * 4
                for x in firstDot..<width {
                    let coverage = (CGFloat(x) / size.width - inkStart) * 1.25
                    let threshold = (CGFloat(Self.bayer4x4[matrixRow + x % 4]) + 0.5) / 16
                    if coverage > threshold {
                        dots.addRect(CGRect(x: x, y: y, width: 1, height: 1))
                    }
                }
            }
            context.fill(dots, with: .color(ink))
        }
    }
}
