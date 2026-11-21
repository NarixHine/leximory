import XCTest

final class AccountUITests: XCTestCase {
    @MainActor func testAccountKeepsManagementWithoutActivityCalendar() {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures"]
        app.launch()
        XCTAssertTrue(app.staticTexts["猫忆读者"].waitForExistence(timeout: 10))
        let username = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "用户名")).firstMatch
        for _ in 0..<4 where !username.isHittable { app.swipeUp() }
        XCTAssertTrue(username.isHittable)
        XCTAssertFalse(app.staticTexts["2026-10-12，入库词汇 36 个，今天"].exists)
        XCTAssertFalse(app.staticTexts["2026-10-11，入库词汇 33 个"].exists)
        capture("Account management without activity heatmap")
    }

    @MainActor func testAccountReplicatesSummaryAndNativeEditors() throws {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures"]
        app.launch()
        XCTAssertTrue(app.staticTexts["猫忆读者"].waitForExistence(timeout: 10))
        let definitions = quotaCard("definitions", in: app)
        let audio = quotaCard("audio", in: app)
        XCTAssertTrue(definitions.exists)
        XCTAssertTrue(definitions.label.contains("AI 注解可用额度"))
        XCTAssertTrue(definitions.label.contains("81%"))
        XCTAssertTrue(definitions.label.contains("1天内重置"))
        XCTAssertFalse(definitions.label.contains("3 / 20"))
        XCTAssertTrue(audio.label.contains("AI 朗读可用额度"))
        XCTAssertTrue(audio.label.contains("50%"))
        XCTAssertFalse(audio.label.contains("1 / 3"))
        XCTAssertEqual(definitions.frame.midY, audio.frame.midY, accuracy: 1)
        XCTAssertFalse(app.staticTexts["操作额度消耗"].exists)
        capture("Available quota cards")
        let subscription = app.buttons["account-subscription"]
        for _ in 0..<8 where !subscription.isHittable { app.swipeDown() }
        XCTAssertTrue(subscription.isHittable)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Account subscription card"
        attachment.lifetime = .keepAlways
        add(attachment)
        subscription.tap()
        XCTAssertTrue(app.buttons["membership-purchase"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["membership-purchase"].label.contains("US$4.49"))
        app.buttons["membership-close"].tap()
        let username = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "用户名")).firstMatch
        for _ in 0..<5 where !username.isHittable { app.swipeUp() }
        XCTAssertTrue(username.waitForExistence(timeout: 5)); username.tap()
        XCTAssertTrue(app.textFields["你的用户名"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.textFields["你的用户名"].value as? String, "猫忆读者")
        XCTAssertTrue(app.buttons["保存"].isEnabled)
        capture("Account editor toolbar")
        app.buttons["取消"].tap()
        let signOut = app.buttons["退出登录"]
        for _ in 0..<5 where !signOut.isHittable || signOut.frame.maxY > app.frame.maxY - 80 { app.swipeUp() }
        XCTAssertTrue(signOut.isHittable)
        signOut.tap()
        XCTAssertTrue(app.buttons["取消"].waitForExistence(timeout: 5))
        app.buttons["取消"].tap()
        capture("Account management and actions")
    }

    @MainActor func testResetQuotaAtAccessibilitySize() {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures", "--account-quota-reset", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        let definitions = quotaCard("definitions", in: app)
        let audio = quotaCard("audio", in: app)
        XCTAssertTrue(definitions.waitForExistence(timeout: 10))
        XCTAssertTrue(definitions.label.contains("100%"))
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.48))
        for _ in 0..<5 where !audio.isHittable { start.press(forDuration: 0.05, thenDragTo: end) }
        XCTAssertTrue(audio.isHittable)
        XCTAssertTrue(audio.label.contains("50%"))
        XCTAssertLessThanOrEqual(definitions.frame.maxY, audio.frame.minY)
        XCTAssertEqual(definitions.frame.midX, audio.frame.midX, accuracy: 1)
        XCTAssertLessThanOrEqual(audio.frame.maxX, app.frame.maxX)
        capture("Accessible available quota cards")
    }

    @MainActor func testAvailableQuotaInDarkAppearance() {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures", "--dark-appearance"]
        app.launch()
        let definitions = quotaCard("definitions", in: app)
        XCTAssertTrue(definitions.waitForExistence(timeout: 10))
        XCTAssertTrue(definitions.label.contains("81%"))
        XCTAssertTrue(quotaCard("audio", in: app).label.contains("50%"))
        capture("Available quota in dark appearance")
    }

    @MainActor private func quotaCard(_ name: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)["account-quota-summary-\(name)"].firstMatch
    }

    @MainActor func testActivePlanLeadsWithoutRoutineStatus() throws {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures", "--membership-active"]
        app.launch()
        let subscription = app.buttons["account-subscription"]
        XCTAssertTrue(subscription.waitForExistence(timeout: 10))
        XCTAssertTrue(subscription.label.contains("双语者"))
        XCTAssertFalse(app.staticTexts["当前计划权益已生效"].exists)
        capture("Account active plan")
        subscription.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85)).tap()
        XCTAssertTrue(app.buttons["管理 App Store 订阅"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["当前计划权益已生效"].exists)
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
