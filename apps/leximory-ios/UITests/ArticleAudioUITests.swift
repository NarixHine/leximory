import XCTest

final class ArticleAudioUITests: XCTestCase {
    @MainActor func testProgressKeepsAdvancingAfterScrubbingAndPauseResume() {
        let app = launch(readOnly: true)
        defer { restore(app) }
        open("fixture-reader", in: app)
        app.buttons["play-article-audio"].tap()
        let slider = app.sliders["播放进度"]
        XCTAssertTrue(slider.waitForExistence(timeout: 10))
        XCTAssertTrue((slider.value as? String)?.contains("0:20") == true)

        slider.adjust(toNormalizedSliderPosition: 0.2)
        assertProgressAdvances(slider)
        slider.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.5)).tap()
        assertProgressAdvances(slider)
        app.buttons["暂停"].tap()
        slider.adjust(toNormalizedSliderPosition: 0.1)
        app.buttons["播放"].tap()
        assertProgressAdvances(slider)
    }

    @MainActor private func assertProgressAdvances(_ slider: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        for _ in 0..<2 {
            let initial = slider.value as? String
            let advances = NSPredicate { _, _ in slider.value as? String != initial }
            XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: advances, object: nil)], timeout: 5),
                           .completed, "Playback progress froze after interaction at \(initial ?? "unknown").", file: file, line: line)
        }
    }

    @MainActor func testInlinePlayStartsPlaybackAndRevealsGlassControls() {
        let app = launch(readOnly: true)
        defer { restore(app) }
        open("fixture-reader", in: app)
        let play = app.buttons["play-article-audio"]
        XCTAssertTrue(play.waitForExistence(timeout: 10))
        XCTAssertTrue(play.isHittable)
        XCTAssertGreaterThanOrEqual(play.frame.height, 44)
        XCTAssertFalse(app.buttons["generate-article-audio"].exists)
        XCTAssertFalse(app.descendants(matching: .any).matching(identifier: "playback-bar").firstMatch.exists)
        let header = XCTAttachment(screenshot: app.screenshot())
        header.name = "Inline full article audio"; header.lifetime = .keepAlways; add(header)
        play.tap()
        XCTAssertTrue(app.buttons["暂停"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "playback-bar").firstMatch.exists)
        let playing = XCTAttachment(screenshot: app.screenshot())
        playing.name = "Full article playback controls"; playing.lifetime = .keepAlways; add(playing)
        app.buttons["停止播放"].tap()
        XCTAssertFalse(app.descendants(matching: .any).matching(identifier: "playback-bar").firstMatch.exists)
    }
    @MainActor func testReadOnlyArticleWithoutFullAudioHasNoGenerationAction() {
        let app = launch(readOnly: true)
        defer { restore(app) }
        open("fixture-forest", in: app)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["generate-article-audio"].exists)
        XCTAssertFalse(app.buttons["play-article-audio"].exists)
    }
    @MainActor func testOwnerGeneratesThenPlaysInlineAndReopeningPreservesRecording() {
        let app = launch(readOnly: false)
        defer { restore(app) }
        open("fixture-forest", in: app)
        let generate = app.buttons["generate-article-audio"]
        XCTAssertTrue(generate.waitForExistence(timeout: 10))
        generate.tap()
        XCTAssertTrue(app.buttons["暂停"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["play-article-audio"].exists)
        XCTAssertFalse(generate.exists)
        app.buttons["后退"].tap()
        app.buttons["browser-resource-fixture-forest"].firstMatch.tap()
        XCTAssertTrue(app.buttons["play-article-audio"].waitForExistence(timeout: 10))
        XCTAssertFalse(generate.exists)
    }
    @MainActor func testAudioHeaderAdaptsToDarkLandscapeAndLargeText() {
        let app = XCUIApplication()
        defer { XCUIDevice.shared.orientation = .portrait; restore(app) }
        XCUIDevice.shared.orientation = .landscapeLeft
        app.launchArguments = ["--browser-workspace-fixtures", "--workspace-audio-fixtures", "--dark-appearance",
                               "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.buttons["我的书签"].waitForExistence(timeout: 15))
        open("fixture-reader", in: app)
        let play = app.buttons["play-article-audio"]
        XCTAssertTrue(play.waitForExistence(timeout: 10))
        let reader = app.textViews["reading-document"]
        for _ in 0..<5 {
            if play.isHittable { break }
            reader.swipeUp()
        }
        XCTAssertTrue(play.isHittable)
        XCTAssertGreaterThanOrEqual(play.frame.height, 44)
        XCTAssertGreaterThanOrEqual(play.frame.minX, 0)
        XCTAssertLessThanOrEqual(play.frame.maxX, app.frame.maxX)
        play.tap()
        let pause = app.buttons["暂停"]
        XCTAssertTrue(pause.waitForExistence(timeout: 10))
        let controls = app.descendants(matching: .any).matching(identifier: "playback-bar").firstMatch
        XCTAssertGreaterThanOrEqual(controls.frame.minX, 20)
        XCTAssertLessThanOrEqual(controls.frame.maxX, app.frame.maxX - 20)
        XCTAssertTrue(pause.isHittable)
        XCTAssertTrue(app.buttons["停止播放"].isHittable)
        XCTAssertTrue(app.sliders["播放进度"].isHittable)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Dark landscape audio with large text"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
    @MainActor private func launch(readOnly: Bool) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures", "--workspace-audio-fixtures"] + (readOnly ? ["--workspace-audio-readonly"] : [])
        app.launch()
        XCTAssertTrue(app.buttons["我的书签"].waitForExistence(timeout: 15))
        return app
    }
    @MainActor private func open(_ id: String, in app: XCUIApplication) {
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        let article = app.buttons["browser-resource-\(id)"].firstMatch
        XCTAssertTrue(article.waitForExistence(timeout: 10)); article.tap()
    }
    @MainActor private func restore(_ app: XCUIApplication) {
        app.terminate(); app.launchArguments = []; app.launch()
    }
}
