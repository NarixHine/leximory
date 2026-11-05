import Foundation
import CoreGraphics
import Testing
@testable import LeximoryCore

@Suite struct ReviewCatRunTests {
    @Test func webSpriteSizeAndTravelSpeed() {
        #expect(ReviewCatRun.height == 100)
        #expect(abs(ReviewCatRun.width - 183.203125) < 0.001)
        #expect(ReviewCatRun.velocity(at: 0) == 52.5)
        #expect(ReviewCatRun.velocity(at: 0.5) == 350)
        #expect(abs(ReviewCatRun.velocity(at: 1) - 35) < 0.001)
    }
    @Test func longerTripsTakeLongerAndRunAtTheSameSpeed() {
        let short = ReviewCatRun(from: .zero, to: CGPoint(x: 100, y: 0))
        let long = ReviewCatRun(from: .zero, to: CGPoint(x: 500, y: 0))
        #expect(abs(long.travelDuration / short.travelDuration - 5) < 0.001)
        let first = long.sample(at: 0.8), second = long.sample(at: 0.9)
        #expect(abs(second.position.x - first.position.x - 35) < 0.01)
        #expect(first.phase == .running)
        #expect((3...5).contains(first.frame))
    }
    @Test func turnRunLandAndRestUseTheWebPoses() {
        let run = ReviewCatRun(from: CGPoint(x: 500, y: 200), to: CGPoint(x: 100, y: 200))
        let turn = run.sample(at: 0.1)
        #expect(turn.position == CGPoint(x: 500, y: 200))
        #expect(turn.facingLeft)
        #expect(turn.phase == .turning)
        let landed = run.sample(at: run.duration - 0.1)
        #expect(landed.position == CGPoint(x: 100, y: 200))
        #expect(landed.frame == 6)
        #expect(landed.phase == .landing)
        let idle = run.sample(at: run.duration)
        #expect(idle.frame == 0)
        #expect(idle.phase == .idle)
    }
    @Test func diagonalTravelFacesTheTargetAndClampsTilt() {
        let run = ReviewCatRun(from: CGPoint(x: 20, y: 20), to: CGPoint(x: 10, y: 500))
        #expect(run.facingLeft)
        #expect(run.angle == 75)
        #expect(run.sample(at: run.duration).position == CGPoint(x: 10, y: 500))
    }
    @Test func nearbyTapsDoNotStartARun() {
        let run = ReviewCatRun(from: CGPoint(x: 20, y: 20), to: CGPoint(x: 25, y: 25))
        #expect(run.duration == 0)
        #expect(run.sample(at: 100).position == CGPoint(x: 20, y: 20))
    }
    @Test(arguments: [CGPoint(x: -100, y: -100), CGPoint(x: -100, y: 100), CGPoint(x: 100, y: -100), CGPoint(x: 100, y: 100)])
    func renderedNosePointsAlongDiagonalTravel(target: CGPoint) {
        let run = ReviewCatRun(from: .zero, to: target)
        let sample = run.sample(at: 0.5)
        let nose = CGPoint(x: 1, y: 0).applying(sample.spriteTransform)
        #expect(abs(nose.x - target.x / hypot(target.x, target.y)) < 0.001)
        #expect(abs(nose.y - target.y / hypot(target.x, target.y)) < 0.001)
    }
}
