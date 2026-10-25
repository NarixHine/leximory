import XCTest
import UIKit

final class BrowserWorkspaceUITests: XCTestCase {
    @MainActor func testPDFStrokeSurvivesFinishingAndReopening() {
        let app = launch(extraArguments: ["--pdf-drawing-fixtures"]); defer { restore(app) }
        func openPDF() {
            app.buttons["我的书签"].tap()
            let pdf = app.buttons["browser-resource-workspace-pdf"].firstMatch
            if !pdf.exists {
                let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
                XCTAssertTrue(folder.waitForExistence(timeout: 5)); folder.tap()
            }
            XCTAssertTrue(pdf.waitForExistence(timeout: 10)); pdf.tap()
            let reader = app.otherElements["ebook-reader"]
            XCTAssertTrue(reader.waitForExistence(timeout: 10))
            let toggle = app.buttons["pdf-drawing-toggle"]
            if !toggle.isHittable { reader.tap() }
            XCTAssertTrue(toggle.waitForExistence(timeout: 5)); toggle.tap()
            XCTAssertEqual(toggle.label, "完成手写")
        }
        openPDF()
        let reader = app.otherElements["ebook-reader"]
        func strokeImage() -> Data? {
            let image = reader.screenshot().image
            let rect = CGRect(x: image.size.width * 0.4, y: image.size.height * 0.33,
                width: image.size.width * 0.2, height: image.size.height * 0.04)
                .applying(CGAffineTransform(scaleX: image.scale, y: image.scale))
            return image.cgImage?.cropping(to: rect).flatMap { UIImage(cgImage: $0).pngData() }
        }
        let blank = strokeImage()
        XCTAssertNotNil(blank)
        reader.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.35)).press(forDuration: 0.05,
            thenDragTo: reader.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.35)))
        let drawn = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard let image = strokeImage() else { return false }
            return image != blank
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [drawn], timeout: 5), .completed, "A real drag must render a stroke.")
        let ink = strokeImage()
        app.buttons["pdf-drawing-toggle"].tap()
        app.buttons["首页"].tap()
        openPDF()
        let restored = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in strokeImage() == ink }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [restored], timeout: 5), .completed, "Reopening must restore the visible stroke.")
    }

    @MainActor func testPDFTextAnnotationWhilePencilToolsStayOpen() {
        let app = launch(extraArguments: ["--pdf-pencil-only"]); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        if folder.waitForExistence(timeout: 5) { folder.tap() }
        let pdf = app.buttons["browser-resource-workspace-pdf"].firstMatch
        XCTAssertTrue(pdf.waitForExistence(timeout: 10)); pdf.tap()
        let reader = app.otherElements["ebook-reader"]
        XCTAssertTrue(reader.waitForExistence(timeout: 10))
        let toggle = app.buttons["pdf-drawing-toggle"]
        if !toggle.isHittable { reader.tap() }
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        app.buttons["ebook-contents"].tap(); app.buttons["2"].tap()
        toggle.tap()
        XCTAssertEqual(toggle.label, "完成手写")
        XCTAssertTrue(app.otherElements["Drawing-Palette"].waitForExistence(timeout: 5))
        let passage = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "The final PDF page")).firstMatch
        XCTAssertTrue(passage.waitForExistence(timeout: 10), app.debugDescription)
        passage.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5)).press(forDuration: 0.7,
            thenDragTo: passage.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)))
        let lookup = app.menuItems["🐈 猫忆查"]
        XCTAssertTrue(lookup.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(app.menuItems["🖍️荧光笔"].exists)
        XCTAssertEqual(toggle.label, "完成手写")
        XCTAssertTrue(app.otherElements["Drawing-Palette"].exists, app.debugDescription)
        lookup.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["final PDF page remains"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertEqual(toggle.label, "完成手写")
    }

    @MainActor func testPDFToolPalettePersistence() {
        let app = launch(); defer { restore(app) }
        func openPDFTools() {
            app.buttons["我的书签"].tap()
            let pdf = app.buttons["browser-resource-workspace-pdf"].firstMatch
            if !pdf.exists {
                let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
                XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
            }
            XCTAssertTrue(pdf.waitForExistence(timeout: 10))
            if !pdf.isHittable { app.swipeUp() }
            pdf.tap()
            let reader = app.otherElements["ebook-reader"]
            XCTAssertTrue(reader.waitForExistence(timeout: 10))
            expectation(for: NSPredicate(format: "value CONTAINS %@", "pdf已打开"), evaluatedWith: reader)
            waitForExpectations(timeout: 10)
            let toggle = app.buttons["pdf-drawing-toggle"]
            if !toggle.isHittable { reader.tap() }
            XCTAssertTrue(toggle.waitForExistence(timeout: 5))
            XCTAssertTrue(toggle.isEnabled); toggle.tap()
            XCTAssertEqual(toggle.label, "完成手写")
            XCTAssertTrue(app.buttons["马克笔"].waitForExistence(timeout: 5))
        }
        openPDFTools()
        let marker = app.buttons["马克笔"]
        marker.tap()
        app.buttons["蓝色"].tap()
        XCTAssertTrue(marker.isSelected)
        let color = marker.value as? String
        XCTAssertNotNil(color)
        for relaunch in [false, true] {
            if relaunch { app.terminate(); app.launch() }
            else {
                app.buttons["pdf-drawing-toggle"].tap()
                app.buttons["首页"].tap()
            }
            openPDFTools()
            XCTAssertTrue(marker.isSelected)
            XCTAssertEqual(marker.value as? String, color)
        }
    }

    @MainActor func testWebPDFUsesEbookFolderSelectionAndSavesAsAnEbook() throws {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 320, height: 480)).pdfData { context in
            context.beginPage()
            ("A river journey" as NSString).draw(at: CGPoint(x: 24, y: 24), withAttributes: nil)
        }
        let page = try BrowserPageServer(pdfData: data)
        defer { page.listener.cancel() }
        let app = launch(extraArguments: ["--workspace-webpage-url", page.url.replacingOccurrences(of: "/article", with: "/document")])
        defer { restore(app) }
        let save = app.buttons["browser-magic-save"]
        expectation(for: NSPredicate(format: "label == %@ AND enabled == true", "保存 PDF"), evaluatedWith: save)
        waitForExpectations(timeout: 15)
        save.tap()
        XCTAssertTrue(app.navigationBars["保存 PDF"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["River pages.pdf"].exists)
        XCTAssertTrue(app.buttons["编辑标题"].exists)
        XCTAssertFalse(app.staticTexts["保存方式"].exists)
        XCTAssertFalse(app.staticTexts["全文预览"].exists)
        XCTAssertEqual(app.buttons["browser-import-submit"].label, "保存")
        app.buttons["取消"].tap()
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        save.tap()
        XCTAssertTrue(app.navigationBars["保存 PDF"].waitForExistence(timeout: 15))
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "选择文件夹")).firstMatch.tap()
        app.buttons.matching(identifier: "browser-select-folder-workspace-folder").matching(NSPredicate(format: "label == %@", "选择")).firstMatch.tap()
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Save webpage PDF into a folder"; screenshot.lifetime = .keepAlways; add(screenshot)
        app.buttons["browser-import-submit"].tap()
        let reader = app.otherElements["ebook-reader"]
        XCTAssertTrue(reader.waitForExistence(timeout: 10))
        expectation(for: NSPredicate(format: "value CONTAINS %@", "pdf已打开"), evaluatedWith: reader)
        waitForExpectations(timeout: 15)
    }

    @MainActor private func launch(extraArguments: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--browser-workspace-fixtures"] + extraArguments
        app.launch()
        XCTAssertTrue(app.buttons["browser-address"].waitForExistence(timeout: 15))
        return app
    }
    @MainActor private func restore(_ app: XCUIApplication) {
        app.terminate(); app.launchArguments = []; app.launch()
    }
    @MainActor func testAddressMatchesOpenAssetsWithoutExpandingFolders() {
        let app = launch(); defer { restore(app) }
        app.buttons["浏览网页"].tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.typeText("river")
        let match = app.buttons["browser-address-match-workspace-epub"]
        XCTAssertTrue(match.waitForExistence(timeout: 10))
        XCTAssertEqual(match.label, "A river journey")
        XCTAssertLessThanOrEqual(match.frame.maxY, input.frame.minY)
        let review = app.buttons["browser-review"]
        XCTAssertLessThanOrEqual(review.frame.maxY, match.frame.minY)
        let cards = ["browser-browse", "browser-bookmarks", "browser-ebook", "browser-review"].map { app.buttons[$0] }
        let cardFrames = cards.map(\.frame)
        let inputFrame = input.frame
        let matches = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "browser-address-match-"))
        for query in ["r", "no matches here", "river"] {
            input.buttons.firstMatch.tap()
            input.typeText(query)
            XCTAssertEqual(input.value as? String, query)
            let expected = query == "no matches here" ? NSPredicate(format: "count == 0") : NSPredicate(format: "count > 0")
            expectation(for: expected, evaluatedWith: matches)
            waitForExpectations(timeout: 5)
            for (card, frame) in zip(cards, cardFrames) {
                XCTAssertEqual(card.frame.minY, frame.minY, accuracy: 1)
                XCTAssertEqual(card.frame.height, frame.height, accuracy: 1)
            }
            XCTAssertEqual(input.frame.minY, inputFrame.minY, accuracy: 1)
            for result in matches.allElementsBoundByIndex {
                XCTAssertGreaterThanOrEqual(result.frame.minY, review.frame.maxY + 32)
                XCTAssertLessThanOrEqual(result.frame.maxY, input.frame.minY)
            }
        }
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Address matches above the bar"; screenshot.lifetime = .keepAlways; add(screenshot)
        match.tap()
        XCTAssertTrue(app.otherElements["ebook-reader"].waitForExistence(timeout: 15))
        XCTAssertFalse(input.exists)
        app.buttons["后退"].tap()
        XCTAssertTrue(app.buttons["浏览网页"].waitForExistence(timeout: 5))
    }
    @MainActor func testAddressMatchesReopenEarlierWebpagesByTitleAndURL() throws {
        try verifyHistorySuggestions(appearance: "Light")
    }
    @MainActor func testAddressHistorySuggestionsInDarkAppearance() throws {
        try verifyHistorySuggestions(appearance: "Dark")
    }
    @MainActor private func verifyHistorySuggestions(appearance: String) throws {
        let page = try BrowserPageServer(); defer { page.listener.cancel() }
        let appearanceArguments = appearance == "Dark" ? ["--dark-appearance"] : []
        let app = launch(extraArguments: ["--workspace-webpage-url", page.url] + appearanceArguments)
        defer { restore(app) }
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["browser-address"].tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: (input.value as? String)?.count ?? 0))
        let laterURL = page.url.replacingOccurrences(of: "/article", with: "/later")
        input.typeText(laterURL + "\n")
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["首页"].tap()
        app.buttons["浏览网页"].tap()
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.typeText("quiet")
        let titleMatch = app.buttons["browser-address-match-webpage:" + laterURL]
        XCTAssertTrue(titleMatch.waitForExistence(timeout: 10))
        XCTAssertEqual(titleMatch.label, "A quiet forest")
        XCTAssertLessThanOrEqual(titleMatch.frame.maxY, input.frame.minY)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = appearance + " recent webpages alongside library matches"; screenshot.lifetime = .keepAlways; add(screenshot)
        input.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 5))
        input.typeText(page.url)
        let match = app.buttons["browser-address-match-webpage:" + page.url]
        XCTAssertTrue(match.waitForExistence(timeout: 10))
        match.tap()
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        XCTAssertFalse(input.exists)
        app.buttons["后退"].tap()
        XCTAssertTrue(app.buttons["浏览网页"].waitForExistence(timeout: 5))
    }

    @MainActor func testFindIsAvailableForWebpagesAndSearchablePDFs() throws {
        let page = try BrowserPageServer(); defer { page.listener.cancel() }
        let app = launch(); defer { restore(app) }
        app.buttons["浏览网页"].tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5)); input.typeText(page.url + "\n")
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["browser-more"].tap()
        app.buttons["在网页中查找"].tap()
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5), app.debugDescription)
        search.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: (search.value as? String)?.count ?? 0))
        search.typeText("forest\n")
        let webpage = XCTAttachment(screenshot: app.screenshot())
        webpage.name = "Webpage native find"; webpage.lifetime = .keepAlways; add(webpage)
        XCTAssertFalse(app.buttons["browser-more"].isHittable)
        app.buttons["find.doneButton"].tap()
        XCTAssertTrue(app.buttons["browser-more"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["browser-more"].isHittable)
        app.buttons["首页"].tap()
        XCTAssertFalse(search.exists)
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        let pdf = app.buttons["browser-resource-workspace-pdf"].firstMatch
        XCTAssertTrue(pdf.waitForExistence(timeout: 10))
        if !pdf.isHittable { app.swipeUp() }
        pdf.tap()
        XCTAssertTrue(app.otherElements["ebook-reader"].waitForExistence(timeout: 10))
        app.buttons["browser-more"].tap()
        XCTAssertTrue(app.buttons["在 PDF 中查找"].waitForExistence(timeout: 10))
        app.buttons["在 PDF 中查找"].tap()
        XCTAssertTrue(search.waitForExistence(timeout: 5), app.debugDescription)
        search.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: (search.value as? String)?.count ?? 0))
        search.typeText("river\n")
        let document = XCTAttachment(screenshot: app.screenshot())
        document.name = "PDF native find"; document.lifetime = .keepAlways; add(document)
        XCTAssertFalse(app.buttons["browser-more"].isHittable)
        app.buttons["find.doneButton"].tap()
        XCTAssertTrue(app.buttons["browser-more"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["browser-more"].isHittable)
    }
    @MainActor func testHomePinCanBeCreatedRenamedAndDeleted() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        let article = app.buttons["browser-resource-fixture-reader"].firstMatch
        XCTAssertTrue(article.waitForExistence(timeout: 10)); article.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 10))
        app.buttons["browser-more"].tap()
        app.buttons["固定到主页"].tap()
        let name = app.textFields["名称"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: (name.value as? String)?.count ?? 0))
        name.typeText("Daily reading")
        app.buttons["保存"].tap()
        app.buttons["首页"].tap()
        let pin = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "browser-pin-")).firstMatch
        XCTAssertTrue(pin.waitForExistence(timeout: 5))
        XCTAssertEqual(pin.label, "Daily reading")
        let home = XCTAttachment(screenshot: app.screenshot())
        home.name = "Home shortcut and tinted cards"; home.lifetime = .keepAlways; add(home)
        pin.press(forDuration: 1)
        app.buttons["编辑"].tap()
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: "Daily reading".count))
        name.typeText("Reading")
        app.buttons["保存"].tap()
        XCTAssertEqual(pin.label, "Reading")
        pin.press(forDuration: 1)
        app.buttons["删除"].tap()
        XCTAssertFalse(pin.exists)
    }
    @MainActor func testFreshHomeKeyboardCardsAndBottomControls() {
        let app = launch(); defer { restore(app) }
        XCTAssertFalse(app.tabBars.firstMatch.exists)
        XCTAssertFalse(app.buttons["首页"].exists)
        XCTAssertFalse(app.buttons["后退"].exists)
        XCTAssertFalse(app.buttons["前进"].exists)
        XCTAssertTrue(app.buttons["我的书签"].isHittable)
        XCTAssertTrue(app.buttons["打开电子书"].isHittable)
        let address = app.buttons["browser-address"]
        XCTAssertGreaterThan(address.frame.midY, app.frame.height * 0.75)
        app.buttons["浏览网页"].tap()
        XCTAssertTrue(app.textFields["browser-address-input"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["我的书签"].isHittable)
        XCTAssertTrue(app.buttons["打开电子书"].isHittable)
        app.buttons["后退"].tap()
        XCTAssertTrue(address.waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Browser-first Home"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
    @MainActor func testInlineFoldersAndArticleHistory() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch.firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        let article = app.buttons["browser-resource-fixture-reader"].firstMatch
        XCTAssertTrue(article.waitForExistence(timeout: 10)); article.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["browser-address"].isHittable)
        app.buttons["后退"].tap()
        XCTAssertTrue(article.waitForExistence(timeout: 5))
        app.buttons["前进"].tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
    }
    @MainActor func testRecentCoverCardsInLightAppearance() throws { try verifyRecentCoverCards(dark: false) }
    @MainActor func testRecentCoverCardsInDarkAppearance() throws { try verifyRecentCoverCards(dark: true) }
    @MainActor private func verifyRecentCoverCards(dark: Bool) throws {
        let page = try BrowserPageServer(artwork: !dark); defer { page.listener.cancel() }
        let app = launch(extraArguments: ["--workspace-recent-card-fixtures", "--workspace-webpage-url", page.url] + (dark ? ["--dark-appearance"] : []))
        defer { restore(app) }
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["首页"].tap()
        let card = app.buttons["browser-recent-webpage-" + page.url]
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        func revealCards() {
            let last = app.buttons["browser-resume-fixture-reader"]
            for _ in 0..<3 {
                if last.exists, last.frame.maxY <= app.buttons["browser-address"].frame.minY { break }
                app.swipeUp()
            }
        }
        revealCards()
        XCTAssertEqual(card.frame.width / card.frame.height, 16.0 / 9, accuracy: 0.03)
        XCTAssertGreaterThan(card.frame.width, 100)
        XCTAssertEqual(card.value as? String, URL(string: page.url)?.host)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = dark ? "Dark recent cover cards" : "Light recent cover cards"
        screenshot.lifetime = .keepAlways; add(screenshot)
        card.tap()
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["首页"].tap()
        revealCards()
        let book = app.buttons["browser-resume-workspace-epub"]
        XCTAssertTrue(book.waitForExistence(timeout: 5))
        XCTAssertEqual(book.value as? String, "Field notes")
        XCTAssertEqual(book.frame.width / book.frame.height, 16.0 / 9, accuracy: 0.03)
        XCTAssertEqual(card.frame.width, book.frame.width, accuracy: 1)
        XCTAssertEqual(card.frame.minY, book.frame.minY, accuracy: 1)
        let covers = XCTAttachment(screenshot: app.screenshot())
        covers.name = dark ? "Dark emoji cover cards" : "Light emoji cover cards"
        covers.lifetime = .keepAlways; add(covers)
        book.tap()
        XCTAssertTrue(app.otherElements["ebook-reader"].waitForExistence(timeout: 15))
        app.buttons["首页"].tap()
        revealCards()
        app.buttons["browser-resume-fixture-forest"].press(forDuration: 1)
        app.buttons["从主页隐藏"].tap()
        let last = app.buttons["browser-resume-fixture-reader"]
        XCTAssertEqual(last.frame.midX, app.frame.midX, accuracy: 1)
        XCTAssertEqual(app.staticTexts["继续浏览"].frame.midX, app.frame.midX, accuracy: 1)
        let centered = XCTAttachment(screenshot: app.screenshot())
        centered.name = "Centered heading and incomplete card row"
        centered.lifetime = .keepAlways; add(centered)
    }

    @MainActor func testRecentReadingKeepsNavigationAndAddressCancellationWorking() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        let article = app.buttons["browser-resource-fixture-reader"].firstMatch
        XCTAssertTrue(article.waitForExistence(timeout: 10)); article.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 10))
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        let recent = app.buttons["browser-resume-fixture-reader"]
        XCTAssertTrue(recent.waitForExistence(timeout: 5)); recent.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
        app.buttons["后退"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(recent.waitForExistence(timeout: 5))
        app.buttons["前进"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
        app.buttons["browser-address"].tap()
        XCTAssertTrue(app.textFields["browser-address-input"].waitForExistence(timeout: 5))
        app.buttons["后退"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(app.buttons["browser-address"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.textFields["browser-address-input"].exists)
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(recent.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["首页"].exists)
    }
    @MainActor func testHomeContinuesThreeResourcesAndOneWebpageWithResourceTypes() throws {
        let page = try BrowserPageServer(); defer { page.listener.cancel() }
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        for id in ["fixture-reader", "fixture-forest", "workspace-epub"] {
            let resource = app.buttons["browser-resource-" + id].firstMatch
            XCTAssertTrue(resource.waitForExistence(timeout: 10))
            if !resource.isHittable { app.swipeUp() }
            resource.tap()
            let reader = id == "workspace-epub" ? app.otherElements["ebook-reader"] : app.textViews["reading-document"]
            XCTAssertTrue(reader.waitForExistence(timeout: 15))
            app.buttons["后退"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        }
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        let reading = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "browser-resume-"))
        XCTAssertEqual(reading.count, 3)
        XCTAssertTrue(app.staticTexts["继续浏览"].exists)
        XCTAssertFalse(app.staticTexts["继续阅读"].exists)
        XCTAssertFalse(app.staticTexts["最近浏览"].exists)
        let oldest = app.buttons["browser-resume-fixture-reader"]
        if !oldest.isHittable { app.swipeUp() }
        oldest.tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
        app.buttons["后退"].tap()
        XCTAssertEqual(reading.count, 3, "Revisiting an article does not duplicate it")
        XCTAssertTrue(app.buttons["browser-resume-fixture-reader"].exists)
        XCTAssertEqual(app.buttons["browser-resume-workspace-epub"].label, "A river journey，电子书")
        XCTAssertEqual(app.buttons["browser-resume-fixture-forest"].label, "A quiet forest，文章")
        for visit in 1...4 {
            app.buttons["browser-address"].tap()
            let input = app.textFields["browser-address-input"]
            XCTAssertTrue(input.waitForExistence(timeout: 5))
            input.tap()
            input.typeText(page.url + "?visit=\(visit)\n")
            XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
            app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
            let stored = app.buttons["browser-recent-webpage-" + page.url + "?visit=\(visit)"]
            expectation(for: NSPredicate(format: "label == %@", "A quiet forest，网页"), evaluatedWith: stored)
            waitForExpectations(timeout: 5)
        }
        let browsed = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "browser-recent-webpage-"))
        XCTAssertEqual(browsed.count, 1)
        XCTAssertLessThanOrEqual(browsed.firstMatch.frame.minY, reading.firstMatch.frame.minY)
        XCTAssertFalse(app.buttons["browser-recent-webpage-" + page.url + "?visit=1"].exists)
        for link in browsed.allElementsBoundByIndex { XCTAssertEqual(link.label, "A quiet forest，网页") }
        app.buttons["browser-recent-webpage-" + page.url + "?visit=4"].tap()
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertEqual(browsed.count, 1)
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Continue browsing with three resources and one webpage"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
    @MainActor func testHiddenRecentsReturnWhenReopenedFromBookmarksAndHistory() throws {
        let page = try BrowserPageServer(); defer { page.listener.cancel() }
        let app = launch(extraArguments: ["--workspace-webpage-url", page.url]); defer { restore(app) }
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        let webpage = app.buttons["browser-recent-webpage-" + page.url]
        XCTAssertTrue(webpage.waitForExistence(timeout: 5))
        webpage.press(forDuration: 1)
        app.buttons["从主页隐藏"].tap()
        XCTAssertTrue(webpage.waitForNonExistence(timeout: 5))
        app.buttons["后退"].tap()
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(webpage.waitForExistence(timeout: 5))

        for id in ["fixture-reader", "workspace-epub"] {
            app.buttons["我的书签"].tap()
            let resource = app.buttons["browser-resource-" + id].firstMatch
            if id == "fixture-reader" {
                let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
                XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
            }
            XCTAssertTrue(resource.waitForExistence(timeout: 10))
            if !resource.isHittable { app.swipeUp() }
            resource.tap()
            let reader = id == "workspace-epub" ? app.otherElements["ebook-reader"] : app.textViews["reading-document"]
            XCTAssertTrue(reader.waitForExistence(timeout: 15))
            app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
            let recent = app.buttons["browser-resume-" + id]
            XCTAssertTrue(recent.waitForExistence(timeout: 5))
            recent.press(forDuration: 1)
            app.buttons["从主页隐藏"].tap()
            XCTAssertTrue(recent.waitForNonExistence(timeout: 5))
            app.buttons["我的书签"].tap()
            XCTAssertTrue(resource.waitForExistence(timeout: 10))
            if !resource.isHittable { app.swipeUp() }
            resource.tap()
            XCTAssertTrue(reader.waitForExistence(timeout: 15))
            app.buttons["首页"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
            XCTAssertTrue(recent.waitForExistence(timeout: 5))
            XCTAssertEqual(app.buttons.matching(identifier: "browser-resume-" + id).count, 1)
        }
    }
    @MainActor func testMoreOnlyShowsContextAndOpensNativeActivitySheet() {
        let app = launch(); defer { restore(app) }
        app.buttons["browser-more"].tap()
        XCTAssertFalse(app.buttons["已存词汇"].exists)
        app.buttons["文章注释队列"].tap()
        XCTAssertTrue(app.staticTexts["暂无预注释文章"].waitForExistence(timeout: 5))
        app.buttons["annotation-activity-close"].tap()
        XCTAssertTrue(app.buttons["browser-address"].waitForExistence(timeout: 5))
    }
    @MainActor func testDefuddleImportAndCompletionAcrossDestinations() throws {
        let page = try BrowserPageServer(); defer { page.listener.cancel() }
        let app = launch(extraArguments: ["--workspace-hold-annotations", "--workspace-webpage-url", page.url]); defer { restore(app) }
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["browser-magic-save"].tap()
        XCTAssertTrue(app.staticTexts["全文预览"].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "morning light")).firstMatch.exists, app.debugDescription)
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "选择文件夹")).firstMatch.tap()
        app.buttons.matching(identifier: "browser-select-folder-workspace-folder").matching(NSPredicate(format: "label == %@", "选择")).firstMatch.tap()
        app.buttons["browser-import-submit"].tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 10))
        app.buttons["首页"].tap()
        let more = app.buttons["browser-more"]
        expectation(for: NSPredicate(format: "value == %@", "1 篇预注释已完成"), evaluatedWith: more)
        waitForExpectations(timeout: 15)
        more.tap(); app.buttons["文章注释队列"].tap()
        app.buttons["browser-resource-workspace-import"].tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
        XCTAssertEqual(more.value as? String, "")
    }
    @MainActor func testEbookControlsShareTheBottomBar() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch.tap()
        let book = app.buttons["browser-resource-workspace-epub"]
        XCTAssertTrue(book.waitForExistence(timeout: 10)); book.tap()
        let reader = app.otherElements["ebook-reader"]
        XCTAssertTrue(reader.waitForExistence(timeout: 15))
        let ready = NSPredicate(format: "value CONTAINS %@", "epub已打开")
        expectation(for: ready, evaluatedWith: reader); waitForExpectations(timeout: 20)
        reader.tap()
        XCTAssertTrue(app.buttons["ebook-contents"].waitForExistence(timeout: 5))
        app.buttons["ebook-contents"].tap()
        XCTAssertTrue(app.navigationBars["目录"].waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Native ebook contents"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
}
