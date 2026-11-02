import XCTest

final class GuestAccountUITests: XCTestCase {
    @MainActor func testContextualEntryKeepsFormReachableWithKeyboardAndLargeText() {
        continueAfterFailure = false
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        for accessibility in [false, true] {
            app.launchArguments = ["--account-entry-preview", "--account-entry-inflected"]
                + (accessibility ? ["--dark-appearance", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] : [])
            app.launch()
            let email = app.textFields["sign-in-email"]
            XCTAssertTrue(email.waitForExistence(timeout: 8))
            for _ in 0..<5 where !email.isHittable { app.swipeUp() }
            email.tap(); email.typeText("reader@example.com")
            XCTAssertEqual(email.value as? String, "reader@example.com")
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
            let password = app.secureTextFields["sign-in-password"]
            for _ in 0..<5 where !password.isHittable { app.swipeUp() }
            XCTAssertTrue(password.isHittable)
            password.tap(); password.typeText("a-test-password")
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
            let submit = app.buttons["account-entry-submit"]
            for _ in 0..<5 where !submit.isHittable { app.swipeUp() }
            XCTAssertTrue(submit.isHittable)
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = accessibility ? "Account form with accessibility text and keyboard" : "Account form with keyboard"
            screenshot.lifetime = .keepAlways; add(screenshot)
            app.swipeDown()
            let close = app.buttons["account-entry-close"]
            for _ in 0..<5 where !close.isHittable { app.swipeDown() }
            XCTAssertTrue(close.isHittable); close.tap()
            XCTAssertTrue(app.buttons["browser-address"].waitForExistence(timeout: 5))
            app.terminate()
        }
    }

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
