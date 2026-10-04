import XCTest

final class AuthoringUITests: XCTestCase {
    @MainActor func testSavedVocabularyCanBeEditedAndReopened() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--authoring-fixtures"]
        app.launch()
        let library = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "测试文库")).firstMatch
        XCTAssertTrue(library.waitForExistence(timeout: 10)); library.tap()
        let corpus = app.buttons["语料本"]
        XCTAssertTrue(corpus.waitForExistence(timeout: 10)); corpus.tap()
        let word = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "bank")).firstMatch
        XCTAssertTrue(word.waitForExistence(timeout: 10)); word.tap()
        let edit = app.buttons["编辑词汇"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10)); edit.tap()
        let field = app.descendants(matching: .any)["edit-词条"].firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10)); field.tap()
        field.typeText("er")
        field.typeText("\n")
        let updatedLemma = try XCTUnwrap(field.value as? String)
        XCTAssertNotEqual(updatedLemma, "bank")
        app.buttons["保存修改"].tap()
        XCTAssertTrue(app.staticTexts[updatedLemma].waitForExistence(timeout: 10))
        if app.frame.width < 600 {
            app.scrollViews["vocabulary-editor-scroll"].swipeDown()
            let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: edit)
            XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 10), .completed)
            app.buttons.matching(NSPredicate(format: "label CONTAINS %@", updatedLemma)).firstMatch.tap()
        }
        XCTAssertTrue(edit.waitForExistence(timeout: 10)); edit.tap()
        XCTAssertTrue(app.descendants(matching: .any)["edit-词条"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertEqual(app.descendants(matching: .any)["edit-词条"].firstMatch.value as? String, updatedLemma)
        let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = "Saved vocabulary editor"; attachment.lifetime = .keepAlways; add(attachment)
    }
    @MainActor func testTextImportAndEbookPicker() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--authoring-fixtures"]
        app.launch()
        let library = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "测试文库")).firstMatch
        XCTAssertTrue(library.waitForExistence(timeout: 10)); library.tap()
        let importButton = app.buttons["导入"]
        XCTAssertTrue(importButton.waitForExistence(timeout: 10)); importButton.tap()
        XCTAssertTrue(app.textFields["网址"].waitForExistence(timeout: 10))
        app.buttons["手动录入"].tap()
        let title = app.descendants(matching: .any)["import-标题"].firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 10)); title.tap(); title.typeText("导入测试")
        let content = app.descendants(matching: .any)["import-文本"].firstMatch
        XCTAssertTrue(content.exists); content.tap(); content.typeText("Along the river.")
        // Save plain text without charging an annotation quota.
        app.buttons["保存"].tap()
        XCTAssertTrue(app.staticTexts["Along the river."].waitForExistence(timeout: 10))
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(importButton.waitForExistence(timeout: 10)); importButton.tap()
        app.buttons["上传电子书"].tap()
        XCTAssertTrue(app.buttons["选择 EPUB 或 PDF"].waitForExistence(timeout: 10))
        let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = "Ebook import tray"; attachment.lifetime = .keepAlways; add(attachment)
        app.buttons["选择 EPUB 或 PDF"].tap()
        XCTAssertTrue(app.buttons["取消"].waitForExistence(timeout: 10))
    }
    @MainActor func testURLImportAutofillsTitleAndContent() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--authoring-fixtures"]
        app.launch()
        let library = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "测试文库")).firstMatch
        XCTAssertTrue(library.waitForExistence(timeout: 10)); library.tap()
        let importButton = app.buttons["导入"]
        XCTAssertTrue(importButton.waitForExistence(timeout: 10)); importButton.tap()
        let url = app.textFields["网址"]
        XCTAssertTrue(url.waitForExistence(timeout: 10)); url.tap(); url.typeText("https://example.org/article\n")
        let title = app.descendants(matching: .any)["import-标题"].firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 10)); XCTAssertEqual(title.value as? String, "导入测试")
        XCTAssertEqual(app.descendants(matching: .any)["import-文本"].firstMatch.value as? String, "Along the river.")
    }

}
