import XCTest

final class ReaderUITests: XCTestCase {
    @MainActor func testNavigationAndFinalSection() throws {
        let app = XCUIApplication()
        app.launch()
        capture(app, name: "Libraries")
        openArticle(app)
        let reader = app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch
        XCTAssertTrue(reader.waitForExistence(timeout: 10))
        capture(app, name: "Opening passage")
        app.buttons["Reading options"].tap()
        app.buttons["Go to final section"].tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "last sentence matters")).firstMatch.waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Final section"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
    @MainActor func testMissingRecordingKeepsArticleText() throws {
        let app = XCUIApplication()
        app.launch()
        openArticle(app)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        app.buttons["Recordings"].tap()
        app.buttons["Unavailable recording"].tap()
        XCTAssertTrue(app.staticTexts["Recording unavailable"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.exists)
        app.buttons["Stop playback"].tap()
        XCTAssertFalse(app.otherElements["playback-bar"].exists)
    }
    @MainActor func testLongReaderAndRotation() throws {
        let app = XCUIApplication()
        app.launch()
        openArticle(app, id: "fixture-long")
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.exists)
        app.buttons["Reading options"].tap()
        app.buttons["Go to final section"].tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "The final sentence of the long fixture")).firstMatch.waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Long reader landscape"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        XCUIDevice.shared.orientation = .portrait
    }
    @MainActor func testMarkedWordOpensDefinition() throws {
        let app = XCUIApplication()
        app.launch()
        openArticle(app)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        if ProcessInfo.processInfo.arguments.contains("--accessibility-census") {
            print("Premise: visible annotated paragraphs must expose stable elements with canonical labels.")
            print(app.debugDescription)
        }
        let paragraph = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "We walked along the bank")).firstMatch
        XCTAssertTrue(paragraph.waitForExistence(timeout: 10))
        guard paragraph.exists else { return }
        // This coordinate targets the first marked bank in the default iPhone fixture layout.
        guard UIDevice.current.userInterfaceIdiom == .phone else { throw XCTSkip("iPhone fixture coordinate") }
        paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            .withOffset(CGVector(dx: 20, dy: paragraph.frame.height * 1.65)).tap()
        XCTAssertTrue(app.navigationBars["Definition"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["The land beside a river."].exists)
        capture(app, name: "Embedded definition")
        app.buttons["Done"].tap()
        XCTAssertTrue(paragraph.exists)
    }
    @MainActor func testSelectionKeepsCopyAndAddsDefine() throws {
        let app = XCUIApplication()
        app.launch()
        openArticle(app)
        let paragraph = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "A quiet page")).firstMatch
        XCTAssertTrue(paragraph.waitForExistence(timeout: 10))
        paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.5)).press(forDuration: 1)
        capture(app, name: "Selection menu")
        XCTAssertTrue(app.menuItems["Copy"].waitForExistence(timeout: 5))
        let define = app.menuItems["Define"]
        XCTAssertTrue(define.exists)
        define.tap()
        XCTAssertTrue(app.navigationBars["Definition"].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        XCTAssertTrue(paragraph.exists)
    }
    @MainActor func testDefinitionSheetPreservesAudioAndBackStopsIt() throws {
        guard UIDevice.current.userInterfaceIdiom == .phone else { throw XCTSkip("iPhone fixture coordinate") }
        let app = XCUIApplication()
        app.launch()
        openArticle(app)
        XCTAssertTrue(app.buttons["Recordings"].waitForExistence(timeout: 10))
        app.buttons["Recordings"].tap()
        app.buttons["Play diagnostic fixture tone"].tap()
        XCTAssertTrue(app.buttons["Pause"].waitForExistence(timeout: 10))
        let paragraph = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "We walked along the bank")).firstMatch
        XCTAssertTrue(paragraph.exists)
        paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            .withOffset(CGVector(dx: 20, dy: paragraph.frame.height * 1.65)).tap()
        XCTAssertTrue(app.navigationBars["Definition"].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["Pause"].exists)
        app.buttons["BackButton"].tap()
        XCTAssertTrue(app.buttons["text-fixture-long"].waitForExistence(timeout: 5))
        app.buttons["text-fixture-reader"].tap()
        XCTAssertFalse(app.otherElements["playback-bar"].exists)
        XCTAssertFalse(app.buttons["Pause"].exists)
    }
    @MainActor func testRubyPassageRemainsReadable() throws {
        let app = XCUIApplication()
        app.launch()
        openArticle(app)
        let reader = app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch
        XCTAssertTrue(reader.waitForExistence(timeout: 10))
        let passage = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "東京で、腕組")).firstMatch
        for _ in 0..<6 {
            if passage.exists { break }
            reader.swipeUp()
        }
        XCTAssertTrue(passage.exists)
        capture(app, name: "Ruby passage")
    }
    @MainActor func testAccessibilityTextSizeReachesFinalContent() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        capture(app, name: "Libraries accessibility text")
        openArticle(app)
        let reader = app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch
        XCTAssertTrue(reader.waitForExistence(timeout: 10))
        capture(app, name: "Accessibility text opening")
        app.buttons["Reading options"].tap()
        app.buttons["Go to final section"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "last sentence matters")).firstMatch.waitForExistence(timeout: 5))
        capture(app, name: "Accessibility text final section")
    }
    @MainActor func testLibraryTextsReaderJourney() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertFalse(app.buttons["text-fixture-reader"].exists)
        app.buttons["library-fixture-field-notes"].tap()
        XCTAssertTrue(app.buttons["text-fixture-reader"].waitForExistence(timeout: 5))
        capture(app, name: "Texts")
        app.buttons["text-fixture-forest"].tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "The forest has no need to hurry")).firstMatch.exists)
        app.buttons["BackButton"].tap()
        XCTAssertTrue(app.buttons["text-fixture-reader"].waitForExistence(timeout: 5))
        if UIDevice.current.userInterfaceIdiom == .phone {
            app.buttons["BackButton"].tap()
            XCTAssertTrue(app.buttons["library-fixture-french"].waitForExistence(timeout: 5))
            app.buttons["library-fixture-french"].tap()
            app.buttons["text-fixture-voyage"].tap()
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "On peut voyager sans aller loin")).firstMatch.waitForExistence(timeout: 5))
        }
    }
    @MainActor func testCatalogDarkAppearance() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--dark-appearance"]
        app.launch()
        capture(app, name: "Libraries dark")
        app.buttons["library-fixture-field-notes"].tap()
        XCTAssertTrue(app.buttons["text-fixture-reader"].waitForExistence(timeout: 5))
        capture(app, name: "Texts dark")
    }
    @MainActor private func openArticle(_ app: XCUIApplication, id: String = "fixture-reader") {
        let library = app.buttons["library-fixture-field-notes"]
        XCTAssertTrue(library.waitForExistence(timeout: 5))
        library.tap()
        let article = app.buttons["text-\(id)"]
        XCTAssertTrue(article.waitForExistence(timeout: 5))
        if app.launchArguments.contains("UICTContentSizeCategoryAccessibilityXXXL") {
            capture(app, name: "Texts accessibility text")
        }
        article.tap()
    }
    @MainActor private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
