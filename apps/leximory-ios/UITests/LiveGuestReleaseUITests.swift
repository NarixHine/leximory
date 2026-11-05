import XCTest

final class LiveGuestReleaseUITests: XCTestCase {
    @MainActor func testDeployedGuestLookupOpensAccountBeforeSaving() throws {
        continueAfterFailure = false
        guard ProcessInfo.processInfo.environment["LEXIMORY_LIVE_GUEST_TEST"] == "1" else {
            throw XCTSkip("Run explicitly against the deployed API on a disposable simulator.")
        }
        let page = try BrowserPageServer(extraArticleContent: """
            <style>main>p{display:none}#live-guest-selection{display:block;font-size:28px;line-height:1.7}</style>
            <p id="live-guest-selection">leaves turn gold beside the river.</p>
            """)
        defer { page.listener.cancel() }
        let app = XCUIApplication()
        app.launchArguments = []
        app.launch()
        defer { app.terminate() }
        let more = app.buttons["browser-more"]
        XCTAssertTrue(more.waitForExistence(timeout: 10))
        more.tap()
        let account = app.buttons["账号"].firstMatch
        XCTAssertTrue(account.waitForExistence(timeout: 5)); account.tap()
        guard app.textFields["sign-in-email"].waitForExistence(timeout: 5) else {
            throw XCTSkip("This check requires a signed-out disposable simulator.")
        }
        app.buttons["account-entry-close"].tap()
        app.buttons["browser-address"].tap()
        let address = app.textFields["browser-address-input"]
        XCTAssertTrue(address.waitForExistence(timeout: 5)); address.typeText(page.url + "\n")
        let sentence = app.webViews.staticTexts["leaves turn gold beside the river."].firstMatch
        XCTAssertTrue(sentence.waitForExistence(timeout: 15))
        sentence.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.2)).press(forDuration: 1)
        let lookup = app.buttons["reading-selection-猫忆查"]
        XCTAssertTrue(lookup.waitForExistence(timeout: 5)); lookup.tap()
        let consent = app.buttons["允许并查词"]
        if consent.waitForExistence(timeout: 3) { consent.tap() }
        let save = app.buttons["收藏词汇"]
        XCTAssertTrue(save.waitForExistence(timeout: 70), app.debugDescription)
        XCTAssertEqual(app.staticTexts["definition-headword"].label, "leaf")
        save.tap()
        XCTAssertTrue(app.textFields["sign-in-email"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["account-entry-word"].label, "leaf")
        XCTAssertTrue(app.staticTexts["登录解锁词汇本"].exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Deployed guest annotation requires account before saving"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["account-entry-close"].tap()
        XCTAssertTrue(sentence.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["编辑词汇"].exists)
    }
}
