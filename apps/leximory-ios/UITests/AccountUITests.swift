import XCTest

final class AccountUITests: XCTestCase {
    @MainActor func testAccountReplicatesSummaryAndNativeEditors() throws {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures"]
        app.launch()
        XCTAssertTrue(app.staticTexts["猫忆读者"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["3 / 20"].exists)
        XCTAssertTrue(app.staticTexts["1 / 3"].exists)
        let subscription = app.buttons["account-subscription"]
        XCTAssertTrue(subscription.isHittable)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Account subscription card"
        attachment.lifetime = .keepAlways
        add(attachment)
        subscription.tap()
        XCTAssertTrue(app.buttons["membership-purchase"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["membership-price"].label.contains("US$4.49"))
        app.buttons["membership-close"].tap()
        let username = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "用户名")).firstMatch
        for _ in 0..<5 where !username.isHittable { app.swipeUp() }
        XCTAssertTrue(username.waitForExistence(timeout: 5)); username.tap()
        XCTAssertTrue(app.textFields["你的用户名"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.textFields["你的用户名"].value as? String, "猫忆读者")
        app.buttons["取消"].tap()
        let signOut = app.buttons["退出登录"]
        for _ in 0..<5 where !signOut.isHittable || signOut.frame.maxY > app.frame.maxY - 80 { app.swipeUp() }
        XCTAssertTrue(signOut.isHittable)
        signOut.tap()
        XCTAssertTrue(app.buttons["取消"].waitForExistence(timeout: 5))
        app.buttons["取消"].tap()
    }

    @MainActor func testPaidCardKeepsAccessAndOpensManagement() throws {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures", "--membership-cancelled", "--dark-appearance"]
        app.launch()
        let subscription = app.buttons["account-subscription"]
        XCTAssertTrue(subscription.waitForExistence(timeout: 10))
        XCTAssertTrue(subscription.label.contains("双语者"))
        capture("Account paid dark")
        subscription.tap()
        XCTAssertTrue(app.staticTexts["已取消续订，到期前仍可使用"].firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["管理 App Store 订阅"].exists)
        XCTAssertFalse(app.buttons["membership-purchase"].exists)
        app.buttons["membership-close"].tap()
        XCTAssertTrue(subscription.waitForExistence(timeout: 5))
    }

    @MainActor func testSubscriptionEntryRemainsUsableAtLargestTypeAndInLandscape() throws {
        let app = XCUIApplication()
        defer {
            XCUIDevice.shared.orientation = .portrait
            app.terminate(); app.launchArguments = []; app.launch()
        }
        app.launchArguments = ["--account-fixtures", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        let subscription = app.buttons["account-subscription"]
        XCTAssertTrue(subscription.waitForExistence(timeout: 10))
        for _ in 0..<5 where !subscription.isHittable { app.swipeUp() }
        XCTAssertTrue(subscription.isHittable)
        XCTAssertLessThanOrEqual(subscription.frame.maxX, app.frame.maxX)
        capture("Account largest type")
        subscription.tap()
        XCTAssertTrue(app.buttons["membership-purchase"].waitForExistence(timeout: 5))
        app.buttons["membership-close"].tap()
        app.terminate()
        XCUIDevice.shared.orientation = .landscapeLeft
        app.launchArguments = ["--account-fixtures"]
        app.launch()
        XCTAssertTrue(subscription.waitForExistence(timeout: 10))
        let landscape = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in app.frame.width > app.frame.height }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [landscape], timeout: 5), .completed)
        for _ in 0..<5 where !subscription.isHittable { app.swipeUp() }
        XCTAssertLessThanOrEqual(subscription.frame.maxX, app.frame.maxX)
        capture("Account landscape")
        subscription.tap()
        XCTAssertTrue(app.buttons["membership-purchase"].waitForExistence(timeout: 5))
    }

    @MainActor private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
