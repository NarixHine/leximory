import XCTest

final class MembershipUITests: XCTestCase {
    @MainActor func testPlanSelectionUpdatesPriceAndConfirmedSuccess() throws {
        let app = XCUIApplication()
        defer { normalLaunch(app) }
        app.launchArguments = ["--account-fixtures", "--account-plans-preview"]
        app.launch()
        let purchase = app.buttons["membership-purchase"]
        XCTAssertTrue(purchase.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["membership-price"].label.contains("US$4.49"))
        app.buttons["membership-plan-polyglot"].tap()
        XCTAssertTrue(app.staticTexts["membership-price"].label.contains("US$6.00"))
        purchase.tap()
        XCTAssertTrue(app.staticTexts["membership-success"].waitForExistence(timeout: 5))
    }

    @MainActor func testPendingApprovalPreventsAnotherPurchase() throws {
        let app = XCUIApplication()
        defer { normalLaunch(app) }
        app.launchArguments = ["--account-fixtures", "--account-plans-preview", "--purchase-pending"]
        app.launch()
        let purchase = app.buttons["membership-purchase"]
        XCTAssertTrue(purchase.waitForExistence(timeout: 10))
        purchase.tap()
        XCTAssertTrue(app.staticTexts["正在等待购买批准，无需再次购买。"].waitForExistence(timeout: 5))
        XCTAssertFalse(purchase.isEnabled)
        XCTAssertFalse(app.buttons["membership-plan-polyglot"].isEnabled)
    }

    @MainActor func testCancelledPurchaseKeepsSelectionAndAllowsRetry() throws {
        let app = XCUIApplication()
        defer { normalLaunch(app) }
        app.launchArguments = ["--account-fixtures", "--account-plans-preview", "--purchase-cancelled"]
        app.launch()
        let purchase = app.buttons["membership-purchase"]
        XCTAssertTrue(purchase.waitForExistence(timeout: 10))
        app.buttons["membership-plan-polyglot"].tap()
        purchase.tap()
        XCTAssertTrue(purchase.waitForExistence(timeout: 5))
        XCTAssertTrue(purchase.isEnabled)
        XCTAssertTrue(app.staticTexts["membership-price"].label.contains("US$6.00"))
        XCTAssertFalse(app.staticTexts["membership-success"].exists)
    }

    @MainActor func testRestoreFailureStaysBesideRestoreAndOffersHelp() throws {
        let app = XCUIApplication()
        defer { normalLaunch(app) }
        app.launchArguments = ["--account-fixtures", "--account-plans-preview", "--dark-appearance"]
        app.launch()
        let restore = app.buttons["membership-restore"]
        XCTAssertTrue(app.buttons["membership-purchase"].waitForExistence(timeout: 10))
        for _ in 0..<8 where !restore.isHittable { app.swipeUp() }
        restore.tap()
        XCTAssertTrue(app.staticTexts["membership-error"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["membership-success"].exists)
    }

    @MainActor func testUnavailableProductsDoNotOfferCheckout() throws {
        let app = XCUIApplication()
        defer { normalLaunch(app) }
        app.launchArguments = ["--account-fixtures", "--account-plans-preview", "--purchase-unavailable"]
        app.launch()
        let purchase = app.buttons["membership-purchase"]
        XCTAssertTrue(purchase.waitForExistence(timeout: 10))
        XCTAssertFalse(purchase.isEnabled)
        XCTAssertTrue(app.staticTexts["App Store 订阅暂未开放，你可以继续免费使用。"].exists)
    }

    @MainActor func testCancelledMembershipKeepsManagementAndHidesNewCheckout() throws {
        let app = XCUIApplication()
        defer { normalLaunch(app) }
        app.launchArguments = ["--account-fixtures", "--account-plans-preview", "--membership-cancelled"]
        app.launch()
        XCTAssertTrue(app.staticTexts["已取消续订，到期前仍可使用"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["管理 App Store 订阅"].exists)
        XCTAssertFalse(app.buttons["membership-purchase"].exists)
    }

    @MainActor func testLargestTypeKeepsPriceAndPlanSelectionAccessible() throws {
        let app = XCUIApplication()
        defer { normalLaunch(app) }
        app.launchArguments = ["--account-fixtures", "--account-plans-preview", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.buttons["membership-purchase"].waitForExistence(timeout: 10))
        let plan = app.buttons["membership-plan-polyglot"]
        for _ in 0..<10 where !plan.isHittable { app.swipeUp() }
        XCTAssertTrue(plan.isHittable)
        plan.tap()
        XCTAssertTrue(app.staticTexts["membership-price"].label.contains("US$6.00"))
    }

    @MainActor func testPurchaseScreenshot() throws {
        let app = XCUIApplication()
        defer { XCUIDevice.shared.orientation = .portrait; normalLaunch(app) }
        app.launchArguments = ["--account-fixtures", "--account-plans-preview"]
        app.launch()
        XCTAssertTrue(app.buttons["membership-purchase"].waitForExistence(timeout: 15))
        capture(app, name: "Membership portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        let landscape = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.frame.width > app.frame.height
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [landscape], timeout: 5), .completed)
        app.buttons["membership-plan-polyglot"].tap()
        XCTAssertTrue(app.staticTexts["membership-price"].label.contains("US$6.00"))
        capture(app, name: "Membership landscape")
        XCUIDevice.shared.orientation = .portrait
        app.terminate()
        app.launchArguments.append("--dark-appearance")
        app.launch()
        XCTAssertTrue(app.buttons["membership-purchase"].waitForExistence(timeout: 15))
        capture(app, name: "Membership dark")
    }

    @MainActor private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @MainActor private func normalLaunch(_ app: XCUIApplication) {
        app.terminate(); app.launchArguments = []; app.launch()
    }
}
