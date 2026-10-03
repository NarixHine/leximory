import SwiftUI

struct CoverArt: View {
    let motif: CoverMotif
    var body: some View {
        Canvas { context, size in
            let side = min(size.width, size.height) * 0.62
            context.translateBy(x: (size.width - side) / 2, y: (size.height - side) / 2)
            context.scaleBy(x: side / 100, y: side / 100)
            let stroke = StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round)
            func draw(_ path: Path) { context.stroke(path, with: .color(LeximoryPalette.illustration), style: stroke) }
            switch motif {
            case .bubbles:
                for (x, y, radius) in [(38.0, 37.0, 25.0), (72, 64, 16), (78, 25, 10)] {
                    draw(Path(ellipseIn: CGRect(x: x-radius, y: y-radius, width: radius*2, height: radius*2)))
                    var arc = Path()
                    arc.addArc(center: CGPoint(x: x, y: y), radius: radius*0.65, startAngle: .degrees(190), endAngle: .degrees(260), clockwise: false)
                    draw(arc)
                }
            case .orbit:
                draw(Path(ellipseIn: CGRect(x: 22, y: 22, width: 56, height: 56)))
                var ring = Path()
                ring.addEllipse(in: CGRect(x: 4, y: 35, width: 92, height: 30))
                draw(ring.applying(CGAffineTransform(translationX: -50, y: -50).concatenating(CGAffineTransform(rotationAngle: -.pi/6)).concatenating(CGAffineTransform(translationX: 50, y: 50))))
            case .waves:
                for y in stride(from: 28.0, through: 73.0, by: 15) {
                    var wave = Path()
                    wave.move(to: CGPoint(x: 8, y: y))
                    wave.addCurve(to: CGPoint(x: 92, y: y), control1: CGPoint(x: 36, y: y-24), control2: CGPoint(x: 64, y: y+24))
                    draw(wave)
                }
            case .leaf:
                var leaf = Path()
                leaf.move(to: CGPoint(x: 75, y: 16))
                leaf.addCurve(to: CGPoint(x: 29, y: 78), control1: CGPoint(x: 12, y: 10), control2: CGPoint(x: 8, y: 62))
                leaf.addCurve(to: CGPoint(x: 75, y: 16), control1: CGPoint(x: 74, y: 99), control2: CGPoint(x: 90, y: 45))
                draw(leaf)
                var stem = Path()
                stem.move(to: CGPoint(x: 22, y: 88))
                stem.addCurve(to: CGPoint(x: 63, y: 32), control1: CGPoint(x: 43, y: 60), control2: CGPoint(x: 58, y: 60))
                draw(stem)
            }
        }
        .background(LeximoryPalette.cover, in: RoundedRectangle(cornerRadius: 30))
        .accessibilityHidden(true)
    }
}
