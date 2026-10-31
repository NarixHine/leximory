import XCTest
import UIKit

final class BrowserWorkspaceUITests: XCTestCase {
    @MainActor func testWebSelectionUsesCustomGlassMenu() throws {
        let page = try BrowserPageServer()
        defer { page.listener.cancel() }
        let app = launch(); defer { restore(app) }
        app.buttons["browser-address"].tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.typeText(page.url + "\n")
        let heading = app.webViews.staticTexts["A quiet forest"].firstMatch
        XCTAssertTrue(heading.waitForExistence(timeout: 15))
        heading.press(forDuration: 1)
        let lookup = app.buttons["reading-selection-猫忆查"]
        XCTAssertTrue(lookup.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(app.buttons["reading-selection-web-search"].isHittable)
        XCTAssertFalse(app.buttons["reading-selection-更多"].exists)
        XCTAssertFalse(app.menuItems["猫忆查"].exists)
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = "Web custom selection menu"; image.lifetime = .keepAlways; add(image)
        lookup.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch.waitForExistence(timeout: 10))
    }

    @MainActor func testDynamicDefinitionRecoveryAndSaveStayInPlace() {
        for dark in [false, true] {
            let app = launch(extraArguments: ["--workspace-definition-fixtures"] + (dark ? ["--dark-appearance"] : []))
            defer { restore(app) }
            app.buttons["我的书签"].tap()
            let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
            XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
            app.buttons["browser-resource-fixture-reader"].tap()
            let paragraph = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "A quiet page")).firstMatch
            XCTAssertTrue(paragraph.waitForExistence(timeout: 10))
            paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.5)).press(forDuration: 1)
            let lookup = app.buttons["猫忆查"]
            XCTAssertTrue(lookup.waitForExistence(timeout: 5)); lookup.tap()
            XCTAssertTrue(app.staticTexts["正在理解语境"].waitForExistence(timeout: 5))
            let headword = app.staticTexts["definition-headword"]
            XCTAssertTrue(headword.exists)
            XCTAssertFalse(headword.label.isEmpty)
            let loading = XCTAttachment(screenshot: app.screenshot())
            loading.name = "Annotation loading, \(dark ? "dark" : "light")"
            loading.lifetime = .keepAlways; add(loading)
            let definition = app.textViews.matching(NSPredicate(format: "value == %@", "河岸，河流两侧的陆地。")).firstMatch
            XCTAssertTrue(definition.waitForExistence(timeout: 10))
            XCTAssertFalse(app.staticTexts["正在理解语境"].exists)
            XCTAssertTrue(app.staticTexts["语源"].waitForExistence(timeout: 5))
            let beforeRecovery = definition.frame
            let save = app.buttons["收藏词汇"]
            let deadline = Date().addingTimeInterval(10)
            while !save.exists && Date() < deadline {
                XCTAssertTrue(definition.exists)
                XCTAssertFalse(app.textViews.containing(NSPredicate(format: "value CONTAINS %@", "REPLAY")).firstMatch.exists)
                if save.waitForExistence(timeout: 0.3) { break }
            }
            XCTAssertTrue(save.exists)
            XCTAssertEqual(definition.frame.minY, beforeRecovery.minY, accuracy: 1)
            let buttonFrame = save.frame
            save.tap()
            XCTAssertTrue(save.waitForNonExistence(timeout: 3))
            let edit = app.buttons["编辑词汇"]
            XCTAssertTrue(edit.waitForExistence(timeout: 5))
            XCTAssertFalse(app.activityIndicators["definition-generating"].exists)
            XCTAssertEqual(edit.frame.midX, buttonFrame.midX, accuracy: 1)
            XCTAssertEqual(edit.frame.midY, buttonFrame.midY, accuracy: 1)
            let capture = XCTAttachment(screenshot: app.screenshot())
            capture.name = "Recovered annotation with stationary save control"
            capture.lifetime = .keepAlways; add(capture)
            edit.tap()
            XCTAssertTrue(app.buttons["取消"].waitForExistence(timeout: 5))
        }
    }

    @MainActor func testAnnotationDictionaryOpensInWorkspaceAndReturnsToArticle() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        app.buttons["browser-resource-fixture-reader"].tap()
        let paragraph = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "We walked along the bank")).firstMatch
        XCTAssertTrue(paragraph.waitForExistence(timeout: 10))
        let position = UIDevice.current.userInterfaceIdiom == .pad ? CGVector(dx: 0.61, dy: 0.22) : CGVector(dx: 0.065, dy: 0.75)
        paragraph.coordinate(withNormalizedOffset: position).tap()
        let dictionary = app.links["在词典中查看"]
        XCTAssertTrue(dictionary.waitForExistence(timeout: 5)); dictionary.tap()
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertTrue(app.buttons["browser-magic-save"].waitForExistence(timeout: 10))
        app.buttons["browser-address"].tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        XCTAssertTrue((input.value as? String ?? "").contains("etymonline.com/word/bank"))
        app.buttons["后退"].tap()
        app.buttons["后退"].tap()
        XCTAssertTrue(app.textViews["reading-document"].waitForExistence(timeout: 5))
    }

    @MainActor func testChineseInterfaceWithJapanesePreferredLanguage() {
        for dark in [false, true] {
            let app = launch(extraArguments: ["-AppleLanguages", "(ja)", "-AppleLocale", "ja_JP"] + (dark ? ["--dark-appearance"] : []))
            defer { restore(app) }
            app.buttons["我的书签"].tap()
            let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
            XCTAssertTrue(folder.waitForExistence(timeout: 10))
            folder.tap()
            XCTAssertTrue(app.buttons["browser-resource-fixture-reader"].waitForExistence(timeout: 10))
            let capture = XCTAttachment(screenshot: app.screenshot())
            capture.name = "Chinese interface, Japanese system, \(dark ? "dark" : "light")"
            capture.lifetime = .keepAlways
            add(capture)
        }
    }

    @MainActor func testEbookAddressEditingRestoresTransparentControls() {
        for dark in [false, true] {
            let app = launch(extraArguments: dark ? ["--dark-appearance"] : [])
            defer { restore(app) }
            app.buttons["我的书签"].tap()
            let book = app.buttons["browser-resource-workspace-epub"]
            if !book.exists {
                app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch.tap()
            }
            XCTAssertTrue(book.waitForExistence(timeout: 10)); book.tap()
            let reader = app.otherElements["ebook-reader"]
            XCTAssertTrue(reader.waitForExistence(timeout: 15))
            expectation(for: NSPredicate(format: "value CONTAINS %@", "epub已打开"), evaluatedWith: reader)
            waitForExpectations(timeout: 30)
            let position = app.staticTexts["ebook-page-position"].value as? String
            for editing in [true, false] {
                app.buttons[editing ? "browser-address" : "后退"].tap()
                let input = app.textFields["browser-address-input"]
                expectation(for: NSPredicate(format: "exists == %@", NSNumber(value: editing)), evaluatedWith: input)
                waitForExpectations(timeout: 5)
                if editing {
                    XCTAssertTrue(input.isHittable)
                    XCTAssertFalse(app.buttons["browser-more"].exists)
                } else {
                    XCTAssertTrue(app.buttons["browser-address"].isHittable)
                    XCTAssertTrue(app.buttons["browser-more"].isHittable)
                    XCTAssertEqual(app.staticTexts["ebook-page-position"].value as? String, position)
                }
                let capture = XCTAttachment(screenshot: app.screenshot())
                capture.name = "EPUB controls \(editing ? "editing" : "reading") \(dark ? "dark" : "light")"
                capture.lifetime = .keepAlways; add(capture)
            }
        }
    }
    @MainActor func testImportUsesTheSelectedFoldersLanguageLimit() throws {
        let page = try BrowserPageServer(extraArticleContent: "<p>" + String(repeating: "A quiet river flows beside the forest. ", count: 350) + "</p>")
        defer { page.listener.cancel() }
        let app = launch(extraArguments: ["--workspace-webpage-url", page.url]); defer { restore(app) }
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["browser-magic-save"].tap()
        let choose = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "选择文件夹")).firstMatch
        XCTAssertTrue(choose.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["browser-import-submit"].isEnabled)
        choose.tap()
        app.buttons.matching(identifier: "browser-select-folder-workspace-folder").matching(NSPredicate(format: "label == %@", "选择")).firstMatch.tap()
        XCTAssertTrue(app.buttons["browser-import-submit"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["browser-import-submit"].isEnabled)
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@ AND label BEGINSWITH %@", "Field notes", "文件夹")).firstMatch.tap()
        app.buttons.matching(identifier: "browser-select-folder-workspace-japanese-folder").matching(NSPredicate(format: "label == %@", "选择")).firstMatch.tap()
        XCTAssertFalse(app.buttons["browser-import-submit"].isEnabled)
    }
    @MainActor func testEbookAddressControlsAcrossReadingThemes() {
        for dark in [false, true] {
            let app = launch(extraArguments: dark ? ["--dark-appearance"] : [])
            defer { restore(app) }
            app.buttons["我的书签"].tap()
            let book = app.buttons["browser-resource-workspace-epub"]
            if !book.exists {
                app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch.tap()
            }
            XCTAssertTrue(book.waitForExistence(timeout: 10)); book.tap()
            let reader = app.otherElements["ebook-reader"]
            XCTAssertTrue(reader.waitForExistence(timeout: 15))
            expectation(for: NSPredicate(format: "value CONTAINS %@", "epub已打开"), evaluatedWith: reader)
            waitForExpectations(timeout: 30)
            for theme in ["paper", "gray", "sepia", "cream"] {
                let settings = app.buttons["ebook-settings"]
                if !settings.isHittable { reader.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.48)).tap() }
                XCTAssertTrue(settings.waitForExistence(timeout: 5)); settings.tap()
                let choice = app.buttons["ebook-theme-\(theme)"]
                XCTAssertTrue(choice.waitForExistence(timeout: 5)); choice.tap()
                XCTAssertTrue(choice.isSelected)
                app.navigationBars["阅读选项"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                    .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)))
                expectation(for: NSPredicate(format: "hittable == true"), evaluatedWith: app.buttons["browser-address"])
                waitForExpectations(timeout: 10)
                XCTAssertTrue(app.buttons["browser-address"].isHittable)
                XCTAssertTrue(app.buttons["首页"].isHittable)
                XCTAssertTrue(app.buttons["browser-more"].isHittable)
                let capture = XCTAttachment(screenshot: app.screenshot())
                capture.name = "Ebook address controls \(theme) \(dark ? "dark" : "light")"
                capture.lifetime = .keepAlways; add(capture)
            }
        }
    }
    @MainActor func testEbookExportOpensNativeShareSheet() {
        for (format, title) in [("pdf", "River pages"), ("epub", "A river journey")] {
            let app = launch(); defer { restore(app) }
            app.buttons["browser-more"].tap()
            XCTAssertFalse(app.buttons["导出电子书"].exists)
            app.tap()
            app.buttons["我的书签"].tap()
            let book = app.buttons["browser-resource-workspace-\(format)"]
            if !book.exists {
                let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
                XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
            }
            XCTAssertTrue(book.waitForExistence(timeout: 10)); book.tap()
            let reader = app.otherElements["ebook-reader"]
            XCTAssertTrue(reader.waitForExistence(timeout: 15))
            expectation(for: NSPredicate(format: "value CONTAINS %@", "\(format)已打开"), evaluatedWith: reader)
            waitForExpectations(timeout: 20)
            let position = app.staticTexts["ebook-page-position"].value as? String
            app.buttons["browser-more"].tap()
            let export = app.buttons["导出电子书"]
            XCTAssertTrue(export.waitForExistence(timeout: 5)); XCTAssertTrue(export.isEnabled); export.tap()
            XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout: 10))
            XCTAssertTrue(app.navigationBars["\(title).\(format)"].exists)
            XCTAssertTrue(app.cells.containing(NSPredicate(format: "label CONTAINS[c] %@ OR label CONTAINS %@ OR label CONTAINS %@",
                "Files", "文件", "ファイル")).firstMatch.exists)
            let capture = XCTAttachment(screenshot: app.screenshot())
            capture.name = "Native \(format.uppercased()) export"; capture.lifetime = .keepAlways; add(capture)
            app.swipeDown()
            expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: app.otherElements["ActivityListView"])
            waitForExpectations(timeout: 5)
            XCTAssertTrue(app.buttons["browser-more"].waitForExistence(timeout: 5))
            XCTAssertEqual(app.staticTexts["ebook-page-position"].value as? String, position)
        }
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
        app.buttons["browser-address"].tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.typeText("A river journey")
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
        for query in ["r", "no matches here", "A river journey"] {
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
        XCTAssertTrue(app.buttons["browser-bookmarks"].waitForExistence(timeout: 5))
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
        app.buttons["browser-address"].tap()
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
        XCTAssertTrue(app.buttons["browser-bookmarks"].waitForExistence(timeout: 5))
    }

    @MainActor func testFindIsAvailableForWebpagesAndSearchablePDFs() throws {
        let page = try BrowserPageServer(); defer { page.listener.cancel() }
        let app = launch(); defer { restore(app) }
        app.buttons["browser-address"].tap()
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
    @MainActor func testPDFFindEndsHandwritingAndDismissesOnPageTapAndBackground() {
        let app = launch(); defer { restore(app) }
        app.buttons["我的书签"].tap()
        let folder = app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Field notes")).firstMatch
        XCTAssertTrue(folder.waitForExistence(timeout: 10)); folder.tap()
        let pdf = app.buttons["browser-resource-workspace-pdf"].firstMatch
        XCTAssertTrue(pdf.waitForExistence(timeout: 10))
        if !pdf.isHittable { app.swipeUp() }
        pdf.tap()
        let reader = app.otherElements["ebook-reader"]
        XCTAssertTrue(reader.waitForExistence(timeout: 10))
        let drawing = app.buttons["pdf-drawing-toggle"]
        if !drawing.isHittable { reader.tap() }
        XCTAssertTrue(drawing.waitForExistence(timeout: 5)); drawing.tap()
        XCTAssertEqual(drawing.label, "完成手写")
        reader.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.35)).tap()
        for identifier in ["pdf-drawing-toggle", "ebook-contents", "ebook-bookmarks", "ebook-settings"] {
            XCTAssertTrue(app.buttons[identifier].isHittable)
        }
        func beginFind() {
            app.buttons["browser-more"].tap()
            let find = app.buttons["在 PDF 中查找"]
            XCTAssertTrue(find.waitForExistence(timeout: 5)); find.tap()
            XCTAssertTrue(app.searchFields.firstMatch.waitForExistence(timeout: 5))
        }
        beginFind()
        let backdrop = app.buttons["browser-find-backdrop"]
        XCTAssertTrue(backdrop.waitForExistence(timeout: 5))
        XCTAssertEqual(backdrop.frame.minY, app.frame.minY, accuracy: 1)
        XCTAssertEqual(backdrop.frame.height, app.frame.height, accuracy: 1)
        XCTAssertEqual(drawing.label, "手写笔记")
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Full-height PDF Find after handwriting"; screenshot.lifetime = .keepAlways; add(screenshot)
        reader.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)).tap()
        XCTAssertTrue(app.searchFields.firstMatch.waitForNonExistence(timeout: 5))
        XCTAssertTrue(app.buttons["browser-more"].isHittable)
        beginFind()
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.searchFields.firstMatch.waitForNonExistence(timeout: 5))
        XCTAssertTrue(app.buttons["browser-more"].isHittable)
        XCTAssertGreaterThan(reader.frame.height, app.frame.height * 0.8)
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
        XCTAssertFalse(app.buttons["browser-account"].exists)
        XCTAssertFalse(app.staticTexts["Leximory Browser"].exists)
        XCTAssertTrue(app.buttons["browser-browse"].isHittable)
        let address = app.buttons["browser-address"]
        XCTAssertGreaterThan(address.frame.midY, app.frame.height * 0.75)
        app.buttons["browser-address"].tap()
        XCTAssertTrue(app.textFields["browser-address-input"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["我的书签"].isHittable)
        XCTAssertTrue(app.buttons["打开电子书"].isHittable)
        app.buttons["后退"].tap()
        XCTAssertTrue(address.waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Browser-first Home"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
    @MainActor func testHomeShortcutsReflowForLargeTextAndLandscape() {
        let app = launch(extraArguments: ["--workspace-recent-card-fixtures",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        defer { XCUIDevice.shared.orientation = .portrait; restore(app) }
        let bookmarks = app.buttons["browser-bookmarks"]
        let lastCard = app.buttons["browser-review"]
        XCTAssertGreaterThanOrEqual(lastCard.frame.minY, bookmarks.frame.maxY)
        for _ in 0..<5 where !lastCard.isHittable { app.swipeUp() }
        XCTAssertTrue(lastCard.isHittable)
        XCTAssertGreaterThanOrEqual(lastCard.frame.width, 44)
        let large = XCTAttachment(screenshot: app.screenshot())
        large.name = "Home at accessibility text size"; large.lifetime = .keepAlways; add(large)
        app.terminate()
        app.launchArguments = ["--browser-workspace-fixtures", "--workspace-recent-card-fixtures"]
        XCUIDevice.shared.orientation = .landscapeLeft
        app.launch()
        XCTAssertTrue(bookmarks.waitForExistence(timeout: 15))
        XCTAssertTrue(bookmarks.isHittable)
        XCTAssertEqual(bookmarks.frame.width, bookmarks.frame.height, accuracy: 1)
        for _ in 0..<5 where !lastCard.isHittable { app.swipeUp() }
        XCTAssertTrue(lastCard.isHittable)
        let landscape = XCTAttachment(screenshot: app.screenshot())
        landscape.name = "Home in narrow landscape"; landscape.lifetime = .keepAlways; add(landscape)
    }

    @MainActor func testAccountIsAvailableFromTheMoreMenu() {
        let app = launch(); defer { restore(app) }
        XCTAssertFalse(app.buttons["browser-account"].exists)
        app.buttons["browser-more"].tap()
        let account = app.buttons["账号"]
        XCTAssertTrue(account.waitForExistence(timeout: 5))
        account.tap()
        XCTAssertTrue(app.buttons["后退"].waitForExistence(timeout: 5))
        app.buttons["browser-more"].tap()
        XCTAssertTrue(app.buttons["广告拦截"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["browser-account"].exists)
        XCTAssertFalse(app.buttons["账号"].exists)
        app.buttons["广告拦截"].tap()
        XCTAssertTrue(app.buttons["ad-blocking-cancel"].waitForExistence(timeout: 5))
        app.buttons["ad-blocking-cancel"].tap()
        app.buttons["后退"].tap()
        XCTAssertTrue(app.buttons["browser-browse"].waitForExistence(timeout: 5))
    }

    @MainActor func testIPadHomeRestoresOriginalCards() throws {
        let app = launch(extraArguments: ["--workspace-recent-card-fixtures", "--workspace-multiple-pins"])
        defer { restore(app) }
        try XCTSkipIf(app.frame.width < 760, "Verify this layout on iPad.")
        let cards = ["browser-browse", "browser-bookmarks", "browser-ebook", "browser-review"].map { app.buttons[$0] }
        for card in cards { XCTAssertTrue(card.isHittable) }
        let frames = cards.map(\.frame)
        XCTAssertGreaterThan(frames[0].width, 180)
        for pair in zip(frames, frames.dropFirst()) {
            XCTAssertLessThan(pair.1.minX, pair.0.maxX)
            XCTAssertEqual(pair.0.midY, pair.1.midY, accuracy: 2)
        }
        let pins = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "browser-pin-")).allElementsBoundByIndex.sorted { $0.frame.minX < $1.frame.minX }
        XCTAssertEqual(pins.count, 3)
        for pair in zip(pins, pins.dropFirst()) {
            XCTAssertEqual(pair.1.frame.midX - pair.0.frame.midX, 76, accuracy: 1)
        }
        XCTAssertFalse(app.staticTexts["继续浏览"].exists)
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = "iPad original Home cards"; image.lifetime = .keepAlways; add(image)
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
    @MainActor func testRecentListInLightAppearance() throws { try verifyRecentList(dark: false) }
    @MainActor func testRecentListInDarkAppearance() throws { try verifyRecentList(dark: true) }
    @MainActor private func verifyRecentList(dark: Bool) throws {
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
        XCTAssertGreaterThan(card.frame.width, card.frame.height * 2)
        XCTAssertGreaterThan(card.frame.width, 100)
        XCTAssertEqual(card.value as? String, URL(string: page.url)?.host)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = dark ? "Dark recent list" : "Light recent list"
        screenshot.lifetime = .keepAlways; add(screenshot)
        card.tap()
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["首页"].tap()
        revealCards()
        let book = app.buttons["browser-resume-workspace-epub"]
        XCTAssertTrue(book.waitForExistence(timeout: 5))
        XCTAssertEqual(book.value as? String, "Field notes")
        XCTAssertGreaterThan(book.frame.width, book.frame.height * 2)
        XCTAssertEqual(card.frame.width, book.frame.width, accuracy: 1)
        XCTAssertLessThanOrEqual(card.frame.maxY, book.frame.minY)
        let covers = XCTAttachment(screenshot: app.screenshot())
        covers.name = dark ? "Dark recent resources" : "Light recent resources"
        covers.lifetime = .keepAlways; add(covers)
        book.tap()
        XCTAssertTrue(app.otherElements["ebook-reader"].waitForExistence(timeout: 15))
        app.buttons["首页"].tap()
        revealCards()
        app.buttons["browser-resume-fixture-forest"].press(forDuration: 1)
        app.buttons["从主页隐藏"].tap()
        let last = app.buttons["browser-resume-fixture-reader"]
        XCTAssertEqual(last.frame.midX, app.frame.midX, accuracy: 1)
        XCTAssertFalse(app.staticTexts["继续浏览"].exists)
        let centered = XCTAttachment(screenshot: app.screenshot())
        centered.name = "Recent list after hiding a resource"
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
