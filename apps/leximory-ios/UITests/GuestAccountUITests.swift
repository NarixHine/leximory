import XCTest

final class GuestAccountUITests: XCTestCase {
    @MainActor func testAccountHeadwordUsesTheAnnotationBaseForm() {
        let app = XCUIApplication()
        app.launchArguments = ["--account-entry-preview", "--account-entry-inflected"]
        app.launch()
        let word = app.staticTexts["account-entry-word"]
        XCTAssertTrue(word.waitForExistence(timeout: 8))
        XCTAssertEqual(word.label, "leaf")
        XCTAssertFalse(app.staticTexts["leaves"].exists)
    }
    @MainActor func testGuestLaunchReachesHomeAndOptionalAccount() {
        let app = XCUIApplication()
        app.launchArguments = ["--guest-home-preview"]
        app.launch()
        let account = app.buttons["browser-more"]
        XCTAssertTrue(account.waitForExistence(timeout: 8))
        XCTAssertFalse(app.textFields["sign-in-email"].exists)
        let home = XCTAttachment(screenshot: app.screenshot()); home.name = "Guest Home"; home.lifetime = .keepAlways; add(home)
        account.tap()
        let destination = app.buttons["账号"].firstMatch
        XCTAssertTrue(destination.waitForExistence(timeout: 5)); destination.tap()
        XCTAssertTrue(app.textFields["sign-in-email"].waitForExistence(timeout: 5))
    }

    @MainActor func testContextualEntryRegistrationAndRecoveryKeepTheReadingContext() {
        let app = XCUIApplication()
        app.launchArguments = ["--account-entry-preview"]
        app.launch()
        XCTAssertTrue(app.staticTexts["bank"].waitForExistence(timeout: 8))
        let entry = XCTAttachment(screenshot: app.screenshot()); entry.name = "Optional account"; entry.lifetime = .keepAlways; add(entry)
        XCTAssertTrue(app.buttons["account-entry-submit"].exists)
        app.buttons["注册"].tap()
        XCTAssertTrue(app.staticTexts["开始语言学习之旅"].waitForExistence(timeout: 4))
        app.buttons["返回登录"].tap()
        XCTAssertTrue(app.staticTexts["bank"].waitForExistence(timeout: 4))
        app.buttons["忘记密码？"].tap()
        XCTAssertTrue(app.staticTexts["重新找回你的账号"].waitForExistence(timeout: 4))
        XCTAssertFalse(app.secureTextFields["sign-in-password"].exists)
        XCTAssertTrue(app.textFields["sign-in-email"].exists)
    }
}
