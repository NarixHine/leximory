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
        XCTAssertTrue(app.staticTexts["LexiCoin 余额"].exists)
        app.buttons["升级"].tap()
        XCTAssertTrue(app.staticTexts["US$4.49 /月"].waitForExistence(timeout: 5))
        app.buttons["完成"].tap()
        let username = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "用户名")).firstMatch
        for _ in 0..<5 where !username.isHittable { app.swipeUp() }
        XCTAssertTrue(username.waitForExistence(timeout: 5)); username.tap()
        XCTAssertTrue(app.textFields["你的用户名"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.textFields["你的用户名"].value as? String, "猫忆读者")
        app.buttons["取消"].tap()
        app.buttons["退出登录"].tap()
        XCTAssertTrue(app.buttons["取消"].waitForExistence(timeout: 5))
        app.buttons["取消"].tap()
    }
}
