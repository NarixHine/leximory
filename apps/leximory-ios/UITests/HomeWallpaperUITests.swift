import XCTest

final class HomeWallpaperUITests: XCTestCase {
    @MainActor func testWallpaperSelectionPersistsBothAppearancesAndResetsIndependently() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures"]
        app.launch()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        XCTAssertTrue(app.buttons["browser-more"].waitForExistence(timeout: 15))
        app.buttons["browser-more"].tap()
        app.buttons["主页壁纸"].tap()
        XCTAssertTrue(app.buttons["wallpaper-done"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["wallpaper-reset"].isEnabled)
        let picker = app.segmentedControls["wallpaper-appearance"]
        XCTAssertTrue(app.buttons["wallpaper-solid"].isEnabled)
        app.buttons["wallpaper-solid"].tap()
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "纯色")
        XCTAssertFalse(app.buttons["wallpaper-solid"].isEnabled)
        XCTAssertTrue(app.buttons["wallpaper-reset"].isEnabled)
        picker.buttons["深色"].tap()
        XCTAssertTrue(picker.buttons["深色"].isSelected)
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "默认")
        picker.buttons["浅色"].tap()
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "纯色")
        app.buttons["wallpaper-reset"].tap()
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "默认")
        try choosePhoto(in: app, index: 0)
        XCTAssertTrue(app.buttons["wallpaper-reset"].isEnabled)
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "自选照片")
        app.buttons["wallpaper-choose-photo"].tap()
        XCTAssertTrue(app.buttons["Cancel"].waitForExistence(timeout: 5))
        app.buttons["Cancel"].tap()
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "自选照片")
        picker.buttons["深色"].tap()
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "默认")
        try choosePhoto(in: app, index: 1)
        app.buttons["wallpaper-done"].tap()
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Home with custom wallpaper"; screenshot.lifetime = .keepAlways; add(screenshot)
        app.terminate()
        app.launchArguments = ["--browser-workspace-fixtures", "--dark-appearance"]
        app.launch()
        XCTAssertTrue(app.buttons["browser-more"].waitForExistence(timeout: 15))
        let darkScreenshot = XCTAttachment(screenshot: app.screenshot())
        darkScreenshot.name = "Dark Home with separate wallpaper"; darkScreenshot.lifetime = .keepAlways; add(darkScreenshot)
        app.buttons["browser-more"].tap()
        app.buttons["主页壁纸"].tap()
        XCTAssertTrue(app.buttons["wallpaper-done"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "自选照片")
        XCTAssertTrue(picker.buttons["深色"].isSelected)
        app.buttons["wallpaper-reset"].tap()
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "默认")
        picker.buttons["浅色"].tap()
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "自选照片")
        app.buttons["wallpaper-reset"].tap()
        XCTAssertEqual(app.otherElements["wallpaper-preview"].value as? String, "默认")
        app.buttons["wallpaper-done"].tap()
        app.buttons["browser-bookmarks"].tap()
        app.buttons["browser-more"].tap()
        XCTAssertFalse(app.buttons["主页壁纸"].exists)
    }

    @MainActor private func choosePhoto(in app: XCUIApplication, index: Int) throws {
        app.buttons["wallpaper-choose-photo"].tap()
        let photos = app.images.matching(identifier: "PXGGridLayout-Info")
        guard photos.firstMatch.waitForExistence(timeout: 10) else {
            throw XCTSkip("The simulator needs sample photos to exercise the system picker.")
        }
        try XCTSkipIf(photos.count <= index, "The simulator needs sample photos to exercise the system picker.")
        photos.element(boundBy: index).tap()
        expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: app.buttons["wallpaper-reset"])
        waitForExpectations(timeout: 15)
    }
}
