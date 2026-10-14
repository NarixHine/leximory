import Foundation
import CoreGraphics

/// Distance-driven motion and sprite timing from the web review lawn.
public struct ReviewCatRun: Sendable {
    public enum Phase: Sendable { case turning, accelerating, running, decelerating, landing, idle }
    public struct Sample: Sendable {
        public let position: CGPoint
        public let angle: Double
        public let facingLeft: Bool
        public let frame: Int
        public let phase: Phase

        public var spriteTransform: CGAffineTransform {
            CGAffineTransform(scaleX: facingLeft ? -1 : 1, y: 1).rotated(by: angle * .pi / 180)
        }

        public static func resting(at position: CGPoint, angle: Double, facingLeft: Bool) -> Self {
            Self(position: position, angle: angle, facingLeft: facingLeft, frame: 0, phase: .idle)
        }
    }
    public static let height: CGFloat = 100
    public static let width: CGFloat = height * 469 / 256
    public static let speed = 350.0
    public static let turnDuration = 0.2
    public static let landingDuration = 0.15
    public let start: CGPoint
    public let end: CGPoint
    public let angle: Double
    public let facingLeft: Bool
    public let travelDuration: Double
    public var duration: Double { travelDuration == 0 ? 0 : Self.turnDuration + travelDuration + Self.landingDuration }
    private let previousAngle: Double
    private let times: [Double]

    public init(from start: CGPoint, to target: CGPoint, previousAngle: Double = 0) {
        self.start = start
        self.previousAngle = previousAngle
        let dx = target.x - start.x, dy = target.y - start.y
        let distance = hypot(dx, dy)
        facingLeft = dx < 0
        angle = max(-75, min(75, atan2(Double(dy), Double(abs(dx))) * 180 / .pi))
        end = distance < 20 ? start : target
        if distance < 20 { times = [0]; travelDuration = 0; return }
        var values = [0.0]
        for step in 0..<512 {
            let progress = (Double(step) + 0.5) / 512
            values.append(values[step] + Double(distance) / 512 / Self.velocity(at: progress))
        }
        times = values
        travelDuration = values[512]
    }
    public static func velocity(at progress: Double) -> Double {
        let p = min(1, max(0, progress))
        if p < 0.05 {
            let t = p / 0.05
            return speed * (0.15 + 0.85 * t * t)
        }
        if p < 0.91 { return speed }
        let t = (p - 0.91) / 0.09
        return speed * (0.1 + 0.9 * (1 - t * t))
    }
    public func sample(at elapsed: Double) -> Sample {
        if travelDuration == 0 { return Sample(position: end, angle: previousAngle, facingLeft: facingLeft, frame: 0, phase: .idle) }
        if elapsed < Self.turnDuration {
            let t = min(1, max(0, elapsed / Self.turnDuration))
            return Sample(position: start, angle: previousAngle + (angle - previousAngle) * (1 - pow(1 - t, 3)), facingLeft: facingLeft, frame: 0, phase: .turning)
        }
        let time = elapsed - Self.turnDuration
        if time >= travelDuration {
            let landing = time < travelDuration + Self.landingDuration
            return Sample(position: end, angle: angle, facingLeft: facingLeft, frame: landing ? 6 : 0, phase: landing ? .landing : .idle)
        }
        var low = 0, high = times.count - 1
        while high - low > 1 {
            let middle = (low + high) / 2
            if times[middle] <= time { low = middle } else { high = middle }
        }
        let progress = (Double(low) + (time - times[low]) / (times[high] - times[low])) / 512
        let point = CGPoint(x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress)
        let phase: Phase = progress < 0.05 ? .accelerating : progress < 0.91 ? .running : .decelerating
        let frame: Int
        switch phase {
        case .accelerating: frame = elapsed < 0.35 ? 0 : 1 + (Int(elapsed / 0.35) - 1) % 2
        case .decelerating:
            let step = Int(max(0, time - times[466]) / 0.35)
            frame = step == 0 ? 3 + max(0, Int(times[466] / 0.09) - 1) % 3 : [5, 4, 3, 6][min(3, step - 1)]
        default: frame = 3 + max(0, Int(time / 0.09) - 1) % 3
        }
        return Sample(position: point, angle: angle, facingLeft: facingLeft, frame: frame, phase: phase)
    }
}
