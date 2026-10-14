import XCTest

final class ReviewUITests: XCTestCase {
    @MainActor func testHomeTimelineStoryTranslationAndWriting() {
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures"]
        app.launch()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        let card = app.buttons["browser-review"]
        XCTAssertTrue(card.waitForExistence(timeout: 15))
        if !card.isHittable { app.swipeUp() }
        card.tap()
        XCTAssertTrue(app.buttons["browser-address"].isHittable)
        XCTAssertFalse(app.staticTexts["天连续复习"].exists)
        let day = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "复习进度 24%")).firstMatch
        XCTAssertTrue(day.waitForExistence(timeout: 10)); day.tap()
        let story = app.buttons["review-task-连词成文"]
        XCTAssertTrue(story.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["browser-address"].isHittable)
        let lawn = XCTAttachment(screenshot: app.screenshot()); lawn.name = "Review lawn"; lawn.lifetime = .keepAlways; add(lawn)
        story.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["browser-address"].isHittable)
        app.buttons["review-story-close"].tap()
        app.buttons["review-task-discover"].tap()
        let editor = app.textViews["你的翻译"]
        XCTAssertTrue(app.buttons["browser-address"].isHittable)
        XCTAssertTrue(editor.waitForExistence(timeout: 5)); editor.tap(); editor.typeText("We find a quiet place by the river.")
        app.buttons["提交"].tap()
        XCTAssertTrue(app.staticTexts["你的回答"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["意思传达得很清楚。"].waitForExistence(timeout: 12))
        app.buttons["review-exercise-close"].tap()
        let writing = app.buttons["每日练笔"]
        if !writing.isHittable { app.swipeUp() }
        XCTAssertTrue(writing.waitForExistence(timeout: 5)); writing.tap()
        XCTAssertTrue(app.buttons["browser-address"].isHittable)
        let letter = app.textViews["写给小黑猫的话"]
        XCTAssertTrue(letter.waitForExistence(timeout: 5)); letter.tap(); letter.typeText("I discovered a quiet place today.")
        app.buttons["提交"].tap()
        XCTAssertTrue(app.staticTexts["小黑猫的回应"].waitForExistence(timeout: 12))
        let feedback = XCTAttachment(screenshot: app.screenshot()); feedback.name = "Daily writing feedback"; feedback.lifetime = .keepAlways; add(feedback)
        app.buttons["review-exercise-close"].tap()
        app.buttons["review-session-close"].tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "复习进度 100%")).firstMatch.waitForExistence(timeout: 10))
    }
}

extension ReviewUITests {
    @MainActor func testDarkLargeTextReviewKeepsTasksReachable() {
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures", "-AppleInterfaceStyle", "Dark", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        let card = app.buttons["browser-review"]
        XCTAssertTrue(card.waitForExistence(timeout: 15))
        if !card.isHittable { app.swipeUp() }
        card.tap()
        let day = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "复习进度 24%")).firstMatch
        XCTAssertTrue(day.waitForExistence(timeout: 10))
        if !day.isHittable { app.swipeUp() }
        day.tap()
        let story = app.buttons["review-task-连词成文"]
        XCTAssertTrue(story.waitForExistence(timeout: 10))
        let word = app.buttons["review-task-discover"]
        for _ in 0..<4 where !word.isHittable { app.swipeUp() }
        XCTAssertTrue(word.isHittable)
        word.tap()
        XCTAssertTrue(app.textViews["你的翻译"].waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Dark large-text translation"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
}

extension ReviewUITests {
    @MainActor func testLandscapeLawnKeepsControlsWithinTheScreen() {
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures"]
        app.launch()
        defer { XCUIDevice.shared.orientation = .portrait; app.terminate(); app.launchArguments = []; app.launch() }
        let card = app.buttons["browser-review"]
        XCTAssertTrue(card.waitForExistence(timeout: 15)); card.tap()
        let day = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "复习进度 24%")).firstMatch
        XCTAssertTrue(day.waitForExistence(timeout: 10)); day.tap()
        XCTAssertTrue(app.buttons["review-task-连词成文"].waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .landscapeLeft
        let word = app.buttons["review-task-connection"]
        let scroll = app.scrollViews["review-session-scroll"]
        XCTAssertTrue(scroll.waitForExistence(timeout: 5))
        for _ in 0..<4 {
            if word.exists && word.isHittable { break }
            scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85))
                .press(forDuration: 0.05, thenDragTo: scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)))
        }
        XCTAssertTrue(word.exists && word.isHittable)
        XCTAssertGreaterThanOrEqual(word.frame.minX, 0)
        XCTAssertLessThanOrEqual(word.frame.maxX, app.frame.width)
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Landscape review lawn"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
}


extension ReviewUITests {
    @MainActor func testWideHomeUsesFourMatchingSquaresAndTimelineWrapsWords() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("Square cards require an iPad-sized window.") }
        let app = XCUIApplication()
        XCUIDevice.shared.orientation = .landscapeLeft
        app.launchArguments = ["--browser-workspace-fixtures"]
        app.launch()
        defer { XCUIDevice.shared.orientation = .portrait; app.terminate(); app.launchArguments = []; app.launch() }
        let review = app.buttons["browser-review"]
        XCTAssertTrue(review.waitForExistence(timeout: 15))
        let cards = ["browser-browse", "browser-bookmarks", "browser-ebook", "browser-review"].map { app.buttons[$0] }
        for card in cards {
            XCTAssertTrue(card.exists)
            XCTAssertEqual(card.frame.width, card.frame.height, accuracy: 1)
            XCTAssertEqual(card.frame.midY, review.frame.midY, accuracy: 2)
            XCTAssertEqual(card.frame.width, review.frame.width, accuracy: 16)
        }
        review.tap()
        XCTAssertTrue(app.buttons["browser-address"].isHittable)
        let quiet = app.buttons["review-word-review-0"]
        let connection = app.buttons["review-word-review-3"]
        XCTAssertTrue(quiet.waitForExistence(timeout: 5))
        XCTAssertGreaterThan(connection.frame.width, quiet.frame.width + 12)
        XCTAssertLessThan(quiet.frame.maxX, connection.frame.minX)
    }
}
