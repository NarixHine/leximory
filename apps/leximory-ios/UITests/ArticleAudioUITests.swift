import XCTest

final class ArticleAudioUITests: XCTestCase {
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
