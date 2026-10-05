import SwiftUI

enum CoverBackground { case varied, newspaper }

/// Identity-derived OKLCH colors shared by the cover paper and its emoji ink.
enum CoverPalette {
    static func seed(_ identity: String) -> UInt64 {
        let hash = identity.utf16.reduce(UInt32(0)) { (($0 &<< 5) &- $0) &+ UInt32($1) }
        return UInt64(abs(Int(Int32(bitPattern: hash))))
    }

    static func hue(_ seed: UInt64) -> Double { 120 + Double(seed % 55) }

    /// The emoji shares the cover's hue so every cover stays in one chromatic family,
    /// while keeping the web's `default-400` lightness and chroma. Dark covers stay neutral.
    static func emojiInk(identity: String, dark: Bool) -> Color {
        let seed = seed(identity)
        let lightness = light(dark ? 0.53 : 0.70, seed, span: dark ? 0.05 : 0.06)
        let chroma = 0.023 + Double((seed >> 8) % 10) / 10 * 0.008
        return oklch(lightness, dark ? 0 : chroma, hue(seed))
    }

    private static func light(_ base: Double, _ seed: UInt64, span: Double) -> Double {
        base + Double((seed >> 16) % 10) / 10 * span
    }

    static func oklch(_ lightness: Double, _ chroma: Double, _ hue: Double) -> Color {
        let angle = hue * .pi / 180, a = chroma * cos(angle), b = chroma * sin(angle)
        let l = pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3)
        let m = pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3)
        let s = pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3)
        func gamma(_ value: Double) -> Double {
            min(1, max(0, value <= 0.0031308 ? 12.92 * value : 1.055 * pow(value, 1 / 2.4) - 0.055))
        }
        return Color(red: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
                     green: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
                     blue: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))
    }
}

struct CoverArt: View {
    let motif: CoverMotif
    var identity = "invitation"
    var animated = false
    var emoji: String? = nil
    var cornerRadius: CGFloat = 30
    var background = CoverBackground.varied
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var colorScheme
    @State private var visible = false
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

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
        .opacity(emoji == nil ? 1 : 0)
        .overlay {
            if let emoji {
                GeometryReader { geometry in
                    Text(emoji).font(.custom("LeximoryNotoEmoji", fixedSize: min(geometry.size.width, geometry.size.height) * 0.42))
                        .foregroundStyle(CoverPalette.emojiInk(identity: identity, dark: colorScheme == .dark))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        }
        .background {
            TimelineView(.animation(minimumInterval: 1.0 / 24, paused: !animated || reduceMotion || !visible || lowPower || scenePhase != .active)) { timeline in
                let time = animated && !reduceMotion && !lowPower ? timeline.date.timeIntervalSinceReferenceDate : 0
                CoverTexture(identity: identity, time: time, background: background)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .onScrollVisibilityChange { visible = $0 }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
        .accessibilityHidden(true)
    }
}

private struct CoverTexture: View {
    let identity: String
    let time: Double
    let background: CoverBackground
    @Environment(\.colorScheme) private var colorScheme
    private var seed: UInt64 { CoverPalette.seed(identity) }
    var body: some View {
        Canvas { context, size in
            let dark = colorScheme == .dark
            let hue = CoverPalette.hue(seed)
            let chroma = 0.003 + Double((seed >> 8) % 10) / 10 * 0.005
            let lightness = dark ? 0.18 + Double((seed >> 16) % 10) / 10 * 0.06 : 0.975 + Double((seed >> 16) % 10) / 10 * 0.02
            let paper = CoverPalette.oklch(lightness, dark ? 0 : chroma, hue)
            let canvas = Path(CGRect(origin: .zero, size: size))
            context.fill(canvas, with: .color(paper))
            let phase = time / 18 + Double(seed % 100)
            let color = LeximoryPalette.illustration
            let center = CGPoint(x: size.width * (0.5 + 0.22 * sin(phase)), y: size.height * (0.5 + 0.2 * cos(phase * 0.8)))
            let wash = CoverPalette.oklch(dark ? lightness + 0.04 : 0.975, dark ? 0 : chroma * 2, hue + 18 * sin(phase * 0.3))
            context.fill(canvas, with: .radialGradient(Gradient(colors: [wash.opacity(0.7), wash.opacity(0)]), center: center, startRadius: 0, endRadius: max(size.width, size.height) * 0.8))
            let light = dark ? CoverPalette.oklch(lightness + 0.035, 0, hue) : Color.white
            context.fill(canvas, with: .radialGradient(Gradient(colors: [light.opacity(0.75), light.opacity(0)]), center: CGPoint(x: size.width - center.x, y: size.height - center.y), startRadius: 0, endRadius: max(size.width, size.height) * 0.7))
            switch background == .newspaper ? 4 : seed % 4 {
            case 4:
                var grid = Path()
                for column in stride(from: 0.0, through: size.width, by: 96) {
                    for offset in [0.0, 16, 32] {
                        grid.move(to: CGPoint(x: column + offset, y: 0))
                        grid.addLine(to: CGPoint(x: column + offset, y: size.height))
                    }
                }
                for y in stride(from: 0.0, through: size.height, by: 28) {
                    grid.move(to: CGPoint(x: 0, y: y)); grid.addLine(to: CGPoint(x: size.width, y: y))
                }
                context.stroke(grid, with: .color(dark ? color.opacity(0.18) : Color(red: 0.72, green: 0.78, blue: 0.74).opacity(0.26)), lineWidth: 0.6)
            case 0:
                // The web's drafting-paper grid, with a slowly passing wash.
                var grid = Path()
                for x in stride(from: 0.0, through: size.width, by: 22) {
                    grid.move(to: CGPoint(x: x, y: 0)); grid.addLine(to: CGPoint(x: x, y: size.height))
                }
                for y in stride(from: 0.0, through: size.height, by: 22) {
                    grid.move(to: CGPoint(x: 0, y: y)); grid.addLine(to: CGPoint(x: size.width, y: y))
                }
                context.stroke(grid, with: .color(color.opacity(0.10)), lineWidth: 0.5)
            case 1:
                for row in 0..<18 {
                    var contour = Path()
                    let y = Double(row) * size.height / 15
                    contour.move(to: CGPoint(x: -20, y: y))
                    contour.addCurve(to: CGPoint(x: size.width + 20, y: y), control1: CGPoint(x: size.width * 0.3, y: y + sin(phase + Double(row) * 0.3) * 18), control2: CGPoint(x: size.width * 0.7, y: y - 20))
                    context.stroke(contour, with: .color(color.opacity(0.09)), lineWidth: 0.6)
                }
            case 2:
                for x in stride(from: 8.0, through: size.width, by: 13) {
                    for y in stride(from: 8.0, through: size.height, by: 13) {
                        let opacity = 0.04 + 0.07 * (sin(x / 70 + y / 90 + phase) + 1) / 2
                        context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1.5, height: 1.5)), with: .color(color.opacity(opacity)))
                    }
                }
            default: break
            }
        }
    }
}
