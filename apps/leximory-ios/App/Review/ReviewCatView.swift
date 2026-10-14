import SwiftUI
import LeximoryCore

@MainActor @Observable final class ReviewCatDriver {
    struct Journey {
        let id = UUID()
        let motion: ReviewCatRun
        let started = Date()
    }
    private(set) var journey: Journey?
    private var position = CGPoint.zero
    private var size = CGSize.zero
    private var angle = 0.0
    private var facingLeft = false

    func resize(_ newSize: CGSize) {
        guard newSize != size, newSize.width > 0, newSize.height > 0 else { return }
        let current = sample(at: Date()).position
        position = size == .zero ? CGPoint(x: newSize.width / 2, y: newSize.height / 2)
            : CGPoint(x: current.x / size.width * newSize.width, y: current.y / size.height * newSize.height)
        size = newSize; journey = nil
    }
    func move(to target: CGPoint, reduceMotion: Bool) {
        let current = sample(at: Date())
        position = current.position; angle = current.angle; facingLeft = current.facingLeft
        let target = CGPoint(x: min(size.width, max(0, target.x)), y: min(size.height, max(0, target.y)))
        if reduceMotion { position = target; journey = nil; return }
        let motion = ReviewCatRun(from: position, to: target, previousAngle: angle)
        journey = motion.duration == 0 ? nil : Journey(motion: motion)
    }
    func finish(_ id: UUID) {
        guard let journey, journey.id == id else { return }
        position = journey.motion.end; angle = journey.motion.angle; facingLeft = journey.motion.facingLeft
        self.journey = nil
    }
    func stop() {
        guard journey != nil else { return }
        let current = sample(at: Date())
        position = current.position; angle = current.angle; facingLeft = current.facingLeft; journey = nil
    }
    func sample(at date: Date) -> ReviewCatRun.Sample {
        if let journey { return journey.motion.sample(at: date.timeIntervalSince(journey.started)) }
        return ReviewCatRun(from: position, to: position, previousAngle: angle).sample(at: 0)
    }
    var idleFacingLeft: Bool { facingLeft }
}

struct ReviewMovingCat: View {
    let driver: ReviewCatDriver
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: driver.journey == nil)) { timeline in
            let sample = driver.sample(at: timeline.date)
            ZStack(alignment: .topLeading) {
                if let journey = driver.journey { dust(journey, at: timeline.date) }
                if let frame = ReviewArtwork.whiteFrames[sample.frame] {
                    Image(uiImage: frame).resizable().scaledToFit()
                        .frame(width: ReviewCatRun.width, height: ReviewCatRun.height)
                        .scaleEffect(x: driver.journey == nil ? (driver.idleFacingLeft ? -1 : 1) : (sample.facingLeft ? -1 : 1), y: 1)
                        .rotationEffect(.degrees(sample.angle))
                        .shadow(color: .black.opacity(0.08), radius: 1, y: 1)
                        .position(sample.position)
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }.allowsHitTesting(false).accessibilityHidden(true)
            .task(id: driver.journey?.id) {
                guard let journey = driver.journey else { return }
                do { try await Task.sleep(for: .seconds(journey.motion.duration)) } catch { return }
                driver.finish(journey.id)
            }
    }
    private func dust(_ journey: ReviewCatDriver.Journey, at date: Date) -> some View {
        Canvas { context, _ in
            let elapsed = date.timeIntervalSince(journey.started)
            let last = Int(elapsed / 0.08)
            let first = max(3, Int(max(0, elapsed - 0.4) / 0.08))
            guard first <= last else { return }
            context.addFilter(.blur(radius: 1))
            let dx = journey.motion.end.x - journey.motion.start.x
            let dy = journey.motion.end.y - journey.motion.start.y
            for event in first...last {
                let born = Double(event) * 0.08
                let sample = journey.motion.sample(at: born)
                guard sample.phase == .accelerating || sample.phase == .running else { continue }
                let age = elapsed - born, life = 1 - age / 0.4
                guard life > 0 else { continue }
                let rot = sample.angle * .pi / 180
                let offsetX = -ReviewCatRun.width * 0.2, offsetY = ReviewCatRun.height * 0.3
                let x = sample.position.x + (offsetX * cos(rot) - offsetY * sin(rot)) * (sample.facingLeft ? -1 : 1)
                let y = sample.position.y + offsetX * sin(rot) + offsetY * cos(rot)
                for particle in 0..<8 {
                    var rng = DustRandom(seed: UInt32(event * 8 + particle + 1))
                    let direction = atan2(-dy, -dx) + (rng.next() - 0.5) * .pi / 4
                    let speed = 60 * (0.5 + rng.next() * 0.5)
                    let center = CGPoint(x: x + (rng.next() - 0.5) * 10 + cos(direction) * speed * age,
                                         y: y + (rng.next() - 0.5) * 5 + (sin(direction) * speed - 20) * age)
                    let radius = 7 * (0.6 + rng.next() * 0.8) * (0.3 + 0.7 * life) / 2
                    let rect = CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)
                    context.opacity = 0.5 * (0.6 + rng.next() * 0.4) * life
                    context.fill(Path(ellipseIn: rect), with: .radialGradient(Gradient(colors: [Color(red: 0.7, green: 0.63, blue: 0.47), .clear]), center: center, startRadius: 0, endRadius: radius))
                }
            }
        }
    }
    private struct DustRandom {
        var seed: UInt32
        mutating func next() -> Double { seed = seed &* 1_664_525 &+ 1_013_904_223; return Double(seed) / 4_294_967_296 }
    }
}
