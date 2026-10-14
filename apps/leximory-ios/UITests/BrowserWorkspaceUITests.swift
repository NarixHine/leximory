import XCTest

final class BrowserWorkspaceUITests: XCTestCase {
    @MainActor private func launch(extraArguments: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures"] + extraArguments
        app.launch()
        XCTAssertTrue(app.buttons["浏览网页"].waitForExistence(timeout: 15))
        return app
    }
    @MainActor private func restore(_ app: XCUIApplication) {
        app.terminate(); app.launchArguments = []; app.launch()
    }
    @MainActor func testFreshHomeKeyboardCardsAndBottomControls() {
        let app = launch(); defer { restore(app) }
        XCTAssertFalse(app.tabBars.firstMatch.exists)
        XCTAssertFalse(app.buttons["首页"].exists)
        XCTAssertFalse(app.buttons["后退"].exists)
        XCTAssertFalse(app.buttons["前进"].exists)
        XCTAssertTrue(app.buttons["我的书签"].isHittable)
        XCTAssertTrue(app.buttons["打开电子书"].isHittable)
        let address = app.buttons["browser-address"]
        XCTAssertGreaterThan(address.frame.midY, app.frame.height * 0.75)
        app.buttons["浏览网页"].tap()
        XCTAssertTrue(app.textFields["browser-address-input"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["我的书签"].isHittable)
        XCTAssertTrue(app.buttons["打开电子书"].isHittable)
        app.buttons["取消"].tap()
        XCTAssertTrue(address.waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Browser-first Home"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
    @MainActor func testInlineFoldersAndArticleHistory() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch.firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        let article = app.buttons["browser-resource-fixture-reader"].firstMatch
        XCTAssertTrue(article.waitForExistence(timeout: 10)); article.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["browser-address"].isHittable)
        app.buttons["后退"].tap()
        XCTAssertTrue(article.waitForExistence(timeout: 5))
        app.buttons["前进"].tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
    }
    @MainActor func testRecentReadingKeepsNavigationAndAddressCancellationWorking() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        let article = app.buttons["browser-resource-fixture-reader"].firstMatch
        XCTAssertTrue(article.waitForExistence(timeout: 10)); article.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 10))
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        let recent = app.buttons["browser-resume-fixture-reader"]
        XCTAssertTrue(recent.waitForExistence(timeout: 5)); recent.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
        app.buttons["后退"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(recent.waitForExistence(timeout: 5))
        app.buttons["前进"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
        app.buttons["browser-address"].tap()
        XCTAssertTrue(app.textFields["browser-address-input"].waitForExistence(timeout: 5))
        app.buttons["取消"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(app.buttons["browser-address"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.textFields["browser-address-input"].exists)
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(recent.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["首页"].exists)
    }
    @MainActor func testHomeShowsThreeRecentLinksPerGroupWithResourceTypes() throws {
        let page = try BrowserPageServer(); defer { page.listener.cancel() }
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        for id in ["fixture-reader", "fixture-forest", "fixture-long", "workspace-epub"] {
            let resource = app.buttons["browser-resource-" + id].firstMatch
            XCTAssertTrue(resource.waitForExistence(timeout: 10))
            if !resource.isHittable { app.swipeUp() }
            resource.tap()
            let reader = id == "workspace-epub" ? app.otherElements["ebook-reader"] : app.textViews["reading-document"]
            XCTAssertTrue(reader.waitForExistence(timeout: 15))
            app.buttons["后退"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        }
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        let reading = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "browser-resume-"))
        XCTAssertEqual(reading.count, 3)
        XCTAssertFalse(app.buttons["browser-resume-fixture-reader"].exists)
        XCTAssertEqual(app.buttons["browser-resume-workspace-epub"].label, "A river journey，电子书")
        XCTAssertEqual(app.buttons["browser-resume-fixture-forest"].label, "A quiet forest，文章")
        for visit in 1...4 {
            app.buttons["browser-address"].tap()
            let input = app.textFields["browser-address-input"]
            XCTAssertTrue(input.waitForExistence(timeout: 5))
            input.typeText(page.url + "?visit=\(visit)\n")
            XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
            app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
            let stored = app.buttons["browser-recent-webpage-" + page.url + "?visit=\(visit)"]
            expectation(for: NSPredicate(format: "label == %@", "A quiet forest，网页"), evaluatedWith: stored)
            waitForExpectations(timeout: 5)
        }
        let browsed = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "browser-recent-webpage-"))
        XCTAssertEqual(browsed.count, 3)
        XCTAssertFalse(app.buttons["browser-recent-webpage-" + page.url + "?visit=1"].exists)
        for link in browsed.allElementsBoundByIndex { XCTAssertEqual(link.label, "A quiet forest，网页") }
        app.buttons["browser-recent-webpage-" + page.url + "?visit=2"].tap()
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertEqual(browsed.count, 3)
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Three recent links with outline resource icons"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
    @MainActor func testMoreOnlyShowsContextAndOpensNativeActivitySheet() {
        let app = launch(); defer { restore(app) }
        app.buttons["browser-more"].tap()
        XCTAssertFalse(app.buttons["已存词汇"].exists)
        app.buttons["文章预注释"].tap()
        XCTAssertTrue(app.staticTexts["暂无预注释文章"].waitForExistence(timeout: 5))
        app.buttons["完成"].tap()
        XCTAssertTrue(app.buttons["browser-address"].waitForExistence(timeout: 5))
    }
    @MainActor func testDefuddleImportAndCompletionAcrossDestinations() throws {
        let page = try BrowserPageServer(); defer { page.listener.cancel() }
        let app = launch(extraArguments: ["--workspace-hold-annotations"]); defer { restore(app) }
        app.buttons["浏览网页"].tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5)); input.typeText(page.url + "\n")
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["browser-magic-save"].tap()
        XCTAssertTrue(app.staticTexts["全文预览"].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "morning light")).firstMatch.exists, app.debugDescription)
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "选择文件夹")).firstMatch.tap()
        app.buttons.matching(identifier: "browser-select-folder-workspace-folder").matching(NSPredicate(format: "label == %@", "选择")).firstMatch.tap()
        app.buttons["browser-import-submit"].tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 10))
        app.buttons["首页"].tap()
        let more = app.buttons["browser-more"]
        expectation(for: NSPredicate(format: "value == %@", "1 篇预注释已完成"), evaluatedWith: more)
        waitForExpectations(timeout: 15)
        more.tap(); app.buttons["文章预注释"].tap()
        app.buttons["browser-resource-workspace-import"].tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
        XCTAssertEqual(more.value as? String, "")
    }
    @MainActor func testEbookControlsShareTheBottomBar() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch.tap()
        let book = app.buttons["browser-resource-workspace-epub"]
        XCTAssertTrue(book.waitForExistence(timeout: 10)); book.tap()
        let reader = app.otherElements["ebook-reader"]
        XCTAssertTrue(reader.waitForExistence(timeout: 15))
        let ready = NSPredicate(format: "value CONTAINS %@", "epub已打开")
        expectation(for: ready, evaluatedWith: reader); waitForExpectations(timeout: 20)
        reader.tap()
        XCTAssertTrue(app.buttons["ebook-contents"].waitForExistence(timeout: 5))
        app.buttons["ebook-contents"].tap()
        XCTAssertTrue(app.navigationBars["目录"].waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Native ebook contents"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
}
