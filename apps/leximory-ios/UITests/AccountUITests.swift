import XCTest

final class AccountUITests: XCTestCase {
    @MainActor func testFutureCalendarDaysDoNotReportWordCounts() {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures"]
        app.launch()
        let future = app.staticTexts["2026-10-13"]
        let today = app.staticTexts["2026-10-12，入库词汇 36 个，今天"]
        for _ in 0..<4 where !today.isHittable { app.swipeUp() }
        XCTAssertTrue(future.waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["2026-10-13，入库词汇 0 个"].exists)
        XCTAssertTrue(today.exists)
        XCTAssertTrue(app.staticTexts["2026-10-11，入库词汇 33 个"].exists)
        app.swipeUp()
        capture("Account calendar keeps future days neutral")
    }

    @MainActor func testAccountReplicatesSummaryAndNativeEditors() throws {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures"]
        app.launch()
        XCTAssertTrue(app.staticTexts["猫忆读者"].waitForExistence(timeout: 10))
        let summary = app.staticTexts["account-quota-summary-definitions"]
        XCTAssertTrue(summary.exists)
        XCTAssertTrue(summary.label.contains("3 / 20"))
        XCTAssertTrue(app.staticTexts["account-quota-summary-audio"].label.contains("1 / 3"))
        capture("Original circular quota cards retained")
        let action = app.descendants(matching: .any)["account-action-cost-pdf-outline"].firstMatch
        for _ in 0..<8 where !action.isHittable { app.swipeUp() }
        XCTAssertTrue(action.waitForExistence(timeout: 5))
        assertActionCosts(app)
        XCTAssertLessThan(summary.frame.minY, action.frame.minY)
        XCTAssertGreaterThan(action.frame.minY, app.buttons["退出登录"].frame.maxY)
        capture("Action costs at the bottom of the account page")
        let subscription = app.buttons["account-subscription"]
        for _ in 0..<8 where !subscription.isHittable { app.swipeDown() }
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

    @MainActor func testActionCostsAtAccessibilitySize() throws {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        let row = app.descendants(matching: .any)["account-action-cost-pdf-outline"].firstMatch
        for _ in 0..<8 where !row.isHittable { app.swipeUp() }
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        XCTAssertTrue(row.label.contains("PDF 目录生成"))
        assertActionCosts(app)
        XCTAssertTrue(row.label.contains("每次消耗 1 词点"))
        XCTAssertLessThanOrEqual(row.frame.maxX, app.frame.maxX)
        capture("Accessible action quota costs")
    }

    @MainActor func testActionCostsAndVisualizationsInDarkAppearance() {
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--account-fixtures", "--dark-appearance"]
        app.launch()
        let summary = app.staticTexts["account-quota-summary-definitions"]
        XCTAssertTrue(summary.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["account-quota-summary-audio"].exists)
        capture("Original quota visualization in dark appearance")
        let row = app.descendants(matching: .any)["account-action-cost-pdf-outline"].firstMatch
        for _ in 0..<8 where !row.isHittable { app.swipeUp() }
        XCTAssertTrue(row.exists)
        XCTAssertTrue(row.label.contains("每次消耗 1 词点"))
        XCTAssertLessThanOrEqual(row.frame.maxX, app.frame.maxX)
        capture("Action costs in dark appearance")
    }

    @MainActor private func assertActionCosts(_ app: XCUIApplication) {
        for (id, action, cost) in [
            ("article-annotation", "文章预注释", "1 词点"),
            ("word-annotation", "🐈 猫忆查", "0.25 词点"),
            ("ebook-icon", "电子书图标生成", "0.01 词点"),
            ("pdf-outline", "PDF 目录生成", "1 词点"),
            ("article-audio", "文章朗读生成", "1 语点"),
        ] {
            let row = app.descendants(matching: .any)["account-action-cost-\(id)"].firstMatch
            XCTAssertTrue(row.exists)
            XCTAssertTrue(row.label.contains(action))
            XCTAssertTrue(row.label.contains("每次消耗 " + cost))
            XCTAssertFalse(row.label.contains("总额"))
            XCTAssertFalse(row.label.contains("已用"))
            XCTAssertFalse(row.label.contains("剩余"))
        }
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
