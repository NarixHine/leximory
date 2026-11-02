import XCTest

final class GuestAccountUITests: XCTestCase {
    @MainActor func testFirstLookupAsksBeforeGeneratingDefinition() throws {
        continueAfterFailure = false
        let page = try BrowserPageServer(extraArticleContent: """
            <style>main>p{display:none}#guest-selection{display:block;font-size:28px;line-height:1.7}</style>
            <p id="guest-selection">leaves turn gold beside the river.</p>
            """)
        defer { page.listener.cancel() }
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--guest-home-preview", "-guest.contextual-ai-consent.v1", "NO"]
        app.launch()
        let address = app.buttons["browser-address"]
        XCTAssertTrue(address.waitForExistence(timeout: 10)); address.tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5)); input.typeText(page.url + "\n")
        let sentence = app.webViews.staticTexts["leaves turn gold beside the river."].firstMatch
        XCTAssertTrue(sentence.waitForExistence(timeout: 15))
        sentence.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.2)).press(forDuration: 1)
        let lookup = app.buttons["reading-selection-猫忆查"]
        XCTAssertTrue(lookup.waitForExistence(timeout: 5)); lookup.tap()
        let consent = app.buttons["允许并查词"]
        XCTAssertTrue(consent.waitForExistence(timeout: 5))
        XCTAssertFalse(app.descendants(matching: .any).matching(identifier: "definition-generating").firstMatch.exists)
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "20 次猫忆查")).firstMatch.exists)
        XCTAssertFalse(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "Vercel")).firstMatch.exists)
        XCTAssertFalse(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "不会上传")).firstMatch.exists)
        XCTAssertFalse(app.buttons["收藏词汇"].exists)
    }

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
