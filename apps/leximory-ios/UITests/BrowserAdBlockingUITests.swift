import XCTest

final class BrowserAdBlockingUITests: XCTestCase {
    @MainActor func testHomeSettingsKeepDraftsLocalAndWebsiteControlsOutOfHome() {
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures"]
        app.launch()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        openSettings(app)
        let global = app.switches["ad-blocking-enabled"]
        XCTAssertTrue(global.waitForExistence(timeout: 5))
        let initial = global.value as? String
        XCTAssertFalse(app.switches["ad-blocking-site"].exists)
        toggle(global)
        app.buttons["ad-blocking-cancel"].tap()
        openSettings(app)
        XCTAssertEqual(global.value as? String, initial)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Ad blocking settings on Home"; attachment.lifetime = .keepAlways; add(attachment)
        app.buttons["ad-blocking-confirm"].tap()
    }

    @MainActor func testWebsiteSettingsShowTheExactHostAndExplicitReloadAction() throws {
        let server = try BrowserPageServer()
        defer { server.listener.cancel() }
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures", "--workspace-webpage-url", server.url]
        app.launch()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        XCTAssertTrue(app.buttons["browser-magic-save"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].waitForExistence(timeout: 15))
        openSettings(app)
        let global = app.switches["ad-blocking-enabled"]
        XCTAssertTrue(global.waitForExistence(timeout: 5))
        let initiallyEnabled = global.value as? String == "1"
        if !initiallyEnabled { toggle(global) }
        let site = app.switches["ad-blocking-site"]
        XCTAssertTrue(site.exists)
        XCTAssertTrue(app.staticTexts["127.0.0.1"].exists)
        let initialSiteValue = site.value as? String
        toggle(site)
        XCTAssertTrue(app.buttons["ad-blocking-exceptions"].exists)
        XCTAssertEqual(app.buttons["ad-blocking-confirm"].label, "应用并重新载入")
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Website ad blocking with explicit reload"; attachment.lifetime = .keepAlways; add(attachment)
        app.buttons["ad-blocking-cancel"].tap()
        openSettings(app)
        XCTAssertEqual(global.value as? String, initiallyEnabled ? "1" : "0")
        XCTAssertEqual(site.value as? String, initialSiteValue)
        app.buttons["ad-blocking-cancel"].tap()
    }

    @MainActor private func toggle(_ control: XCUIElement) {
        control.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
    }

    @MainActor private func openSettings(_ app: XCUIApplication) {
        let more = app.buttons["browser-more"]
        XCTAssertTrue(more.waitForExistence(timeout: 15))
        more.tap()
        let entry = app.buttons["广告拦截"]
        XCTAssertTrue(entry.waitForExistence(timeout: 5))
        entry.tap()
        let confirm = app.buttons["ad-blocking-confirm"]
        if !confirm.waitForExistence(timeout: 3), entry.exists { entry.tap() }
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
    }
}
