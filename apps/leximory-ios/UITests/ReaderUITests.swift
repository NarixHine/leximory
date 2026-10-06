import XCTest

final class ReaderUITests: XCTestCase {
    @MainActor func testJapaneseDefinitionRubyPopover() throws {
        let app = XCUIApplication(); app.launchArguments = ["--fixtures"]
        app.launch()
        let library = app.buttons["library-fixture-japanese"]
        XCTAssertTrue(library.waitForExistence(timeout: 10)); library.tap()
        app.buttons["text-fixture-garden"].tap()
        let paragraph = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "朝の光が庭に差し込む。")).firstMatch
        XCTAssertTrue(paragraph.waitForExistence(timeout: 10))
        paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0.45, dy: 0.5)).tap()
        let ruby = app.descendants(matching: .any).matching(identifier: "annotation-markdown-ruby").firstMatch
        XCTAssertTrue(ruby.waitForExistence(timeout: 5))
        XCTAssertTrue((ruby.value as? String ?? "").contains("ことば"))
        XCTAssertFalse((ruby.value as? String ?? "").unicodeScalars.contains { (0xE000...0xF8FF).contains($0.value) })
        capture(app, name: "Japanese definition ruby")
    }

    @MainActor func testJapaneseVerticalReaderTurnsRightAndKeepsContents() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        let library = app.buttons["library-fixture-japanese-ebooks"]
        XCTAssertTrue(library.waitForExistence(timeout: 10)); library.tap()
        let book = app.buttons["text-fixture-japanese-epub"]
        XCTAssertTrue(book.waitForExistence(timeout: 10)); book.tap()
        let reader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "epub已打开"), object: reader)], timeout: 30) == .completed)
        capture(app, name: "Japanese vertical ruby reading")
        let position = app.staticTexts["ebook-page-position"]
        let initial = position.value as? String
        app.webViews.firstMatch.swipeRight()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value != %@", initial ?? ""), object: position)], timeout: 10) == .completed)
        capture(app, name: "Japanese RTL next page")
        revealEbookControls(app)
        app.buttons["ebook-contents"].tap()
        app.buttons["第二章　朝の光"].tap()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "第二章"), object: reader)], timeout: 10) == .completed)
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(reader.exists)
        capture(app, name: "Japanese vertical landscape")
    }

    @MainActor func testSuppliedJapaneseBookTurnsAndOpensNestedContents() throws {
        let environment = ProcessInfo.processInfo.environment
        guard let path = environment["LEXIMORY_EXAMPLE_EPUB"] ?? environment["TEST_RUNNER_LEXIMORY_EXAMPLE_EPUB"] else { throw XCTSkip("Local example EPUB required") }
        let app = XCUIApplication(); app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launchEnvironment["LEXIMORY_EXAMPLE_EPUB"] = path
        app.launch()
        let library = app.buttons["library-fixture-japanese-ebooks"]
        XCTAssertTrue(library.waitForExistence(timeout: 10)); library.tap()
        let book = app.buttons["text-fixture-japanese-epub"]
        XCTAssertTrue(book.waitForExistence(timeout: 10)); book.tap()
        let reader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "epub已打开"), object: reader)], timeout: 30) == .completed)
        revealEbookControls(app); app.buttons["ebook-contents"].tap()
        let chapter = app.buttons["殿上の闇討"]
        XCTAssertTrue(chapter.waitForExistence(timeout: 10)); chapter.tap()
        let position = app.staticTexts["ebook-page-position"]
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "殿上の闇討"), object: position)], timeout: 10) == .completed)
        capture(app, name: "Supplied Japanese EPUB portrait")
        let initial = position.value as? String
        app.webViews.firstMatch.swipeRight()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value != %@", initial ?? ""), object: position)], timeout: 10) == .completed)
        app.webViews.firstMatch.swipeLeft()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", initial ?? ""), object: position)], timeout: 10) == .completed)
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.frame.width > app.frame.height && app.webViews.firstMatch.frame.width > app.webViews.firstMatch.frame.height
        }, object: app)], timeout: 10) == .completed)
        Thread.sleep(forTimeInterval: 0.7) // Wait for the native rotation transition before inspecting the page.
        XCTAssertTrue(reader.exists)
        capture(app, name: "Supplied Japanese EPUB landscape")
    }

    @MainActor func testCachedLiveAccountArticleAndEbookReopenWithoutNetwork() throws {
        let environment = ProcessInfo.processInfo.environment
        guard let email = environment["LEXIMORY_TEST_EMAIL"] ?? environment["TEST_RUNNER_LEXIMORY_TEST_EMAIL"],
              let password = environment["LEXIMORY_TEST_PASSWORD"] ?? environment["TEST_RUNNER_LEXIMORY_TEST_PASSWORD"] else { throw XCTSkip("Explicit live credentials required") }
        let app = XCUIApplication(); app.launchArguments = ["--ebook-read-only"]; app.launch()
        let library = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'library-' AND label CONTAINS %@", "AI,")).firstMatch
        if !library.waitForExistence(timeout: 5) {
            let start = app.buttons["onboarding-start"]; if start.waitForExistence(timeout: 5) { start.tap() }
            let field = app.textFields["sign-in-email"]; XCTAssertTrue(field.waitForExistence(timeout: 15))
            field.tap(); field.typeText(email)
            app.secureTextFields["sign-in-password"].tap(); app.secureTextFields["sign-in-password"].typeText(password)
            app.buttons["登录"].tap()
        }
        XCTAssertTrue(library.waitForExistence(timeout: 60)); library.tap()
        let article = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'text-'")).firstMatch
        XCTAssertTrue(article.waitForExistence(timeout: 30))
        let textID = String(article.identifier.dropFirst(5)); article.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 30))
        app.open(URL(string: "leximory://read/jJoWFnBnjIQE")!)
        let ebook = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "epub已打开"), object: ebook)], timeout: 60) == .completed)
        app.terminate(); app.launchArguments = ["--offline", "--ebook-read-only"]; app.launch()
        XCTAssertTrue(library.waitForExistence(timeout: 10))
        XCTAssertFalse(app.descendants(matching: .any).matching(identifier: "offline-reading-notice").firstMatch.exists)
        capture(app, name: "Offline restored account libraries")
        app.open(URL(string: "leximory://read/\(textID)")!)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 5))
        capture(app, name: "Offline article with cached annotations")
        app.open(URL(string: "leximory://read/jJoWFnBnjIQE")!)
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "epub已打开"), object: ebook)], timeout: 15) == .completed)
        revealEbookControls(app); app.buttons["ebook-contents"].tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "BOOK I -")).firstMatch.waitForExistence(timeout: 5))
        capture(app, name: "Offline EPUB contents")
    }

    override func setUp() async throws {
        try await super.setUp()
        await MainActor.run {
            XCUIApplication().terminate()
            XCUIDevice.shared.orientation = .portrait
        }
    }
    @MainActor func testLiveAccountBrowsingAndRestoration() throws {
        let environment = ProcessInfo.processInfo.environment
        let email = environment["LEXIMORY_TEST_EMAIL"] ?? environment["TEST_RUNNER_LEXIMORY_TEST_EMAIL"]
        let password = environment["LEXIMORY_TEST_PASSWORD"] ?? environment["TEST_RUNNER_LEXIMORY_TEST_PASSWORD"]
        guard let email, let password else { throw XCTSkip("Explicit live test credentials required") }
        let app = XCUIApplication()
        app.launch()
        let library = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'library-' AND label CONTAINS %@", "AI,")).firstMatch
        if !library.waitForExistence(timeout: 5) {
            let start = app.buttons["onboarding-start"]
            if start.waitForExistence(timeout: 5) { start.tap() }
            let field = app.textFields["sign-in-email"]
            XCTAssertTrue(field.waitForExistence(timeout: 15))
            field.tap(); field.typeText(email)
            let secure = app.secureTextFields["sign-in-password"]
            secure.tap(); secure.typeText(password)
            app.buttons["登录"].tap()
        }
        XCTAssertTrue(library.waitForExistence(timeout: 60))
        XCTAssertTrue(app.staticTexts["已归档"].exists)
        XCTAssertTrue(app.buttons["library-54b8b3f7-35ff-41a1-aff5-2305dbadd4d6"].exists)
        app.buttons["账户"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "本期词点")).firstMatch.waitForExistence(timeout: 10))
        capture(app, name: "Account tab")
        app.buttons["文库"].tap()
        XCTAssertTrue(library.exists)
        capture(app, name: "Authenticated libraries")
        library.tap()
        let article = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'text-'")).firstMatch
        XCTAssertTrue(article.waitForExistence(timeout: 30))
        capture(app, name: "Authenticated texts")
        let textID = String(article.identifier.dropFirst("text-".count))
        article.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 30))
        capture(app, name: "Authenticated reader")
        app.terminate(); app.launch()
        XCTAssertTrue(library.waitForExistence(timeout: 30))
        capture(app, name: "Restored account libraries")
        app.open(URL(string: "leximory://read/\(textID)")!)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 30))
        capture(app, name: "Article link navigation")
    }
    @MainActor func testExistingWebLibraryEbooksReadOnly() throws {
        guard ProcessInfo.processInfo.environment["TEST_RUNNER_LEXIMORY_TEST_EMAIL"] != nil || ProcessInfo.processInfo.environment["LEXIMORY_TEST_EMAIL"] != nil else { throw XCTSkip("Explicit live credentials required") }
        let app = XCUIApplication()
        app.launchArguments = ["--ebook-read-only"]
        app.launch()
        XCTAssertTrue(app.buttons["library-OfAIpjTrE9hx"].waitForExistence(timeout: 60))
        app.open(URL(string: "leximory://read/jJoWFnBnjIQE")!)
        guard app.webViews.firstMatch.waitForExistence(timeout: 20) else {
            capture(app, name: "Real EPUB loading diagnostic")
            XCTFail(app.debugDescription); return
        }
        XCTAssertGreaterThan(app.webViews.firstMatch.frame.height, 300)
        let epubReader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "epub已打开"), object: epubReader)], timeout: 30) == .completed)
        revealEbookControls(app)
        app.buttons["ebook-contents"].tap()
        let chapter = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "BOOK I -")).firstMatch
        for _ in 0..<12 where !chapter.isHittable { app.swipeUp() }
        XCTAssertTrue(chapter.isHittable)
        chapter.tap()
        let passage = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Herodotus")).firstMatch
        XCTAssertTrue(passage.waitForExistence(timeout: 30))
        capture(app, name: "Real EPUB first book")
        app.open(URL(string: "leximory://read/5dyKcRoJvWkd")!)
        revealEbookControls(app)
        XCTAssertTrue(app.buttons["ebook-contents"].waitForExistence(timeout: 60))
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.webViews.firstMatch)], timeout: 30) == .completed)
        let pdfReader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "pdf已打开"), object: pdfReader)], timeout: 30) == .completed)
        XCTAssertFalse(app.staticTexts["暂时无法打开电子书"].exists)
        capture(app, name: "Web library Histories V PDF")
        let initialPDFPosition = app.sliders["阅读进度"].value as? String
        XCTAssertNotNil(initialPDFPosition)
        app.swipeUp()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value != %@", initialPDFPosition!), object: app.sliders["阅读进度"])], timeout: 10) == .completed)
        capture(app, name: "Real PDF vertical scroll")
    }
    @MainActor private func revealEbookControls(_ app: XCUIApplication) {
        let reader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(reader.waitForExistence(timeout: 60))
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "已打开"), object: reader)], timeout: 30) == .completed)
        if !app.buttons["ebook-contents"].exists { reader.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.48)).tap() }
        XCTAssertTrue(app.buttons["ebook-contents"].waitForExistence(timeout: 5))
    }
    @MainActor func testEPUBSelectionMenuAndQuietChrome() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        app.buttons["text-fixture-epub"].tap()
        let passage = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "We walked along the bank")).firstMatch
        XCTAssertTrue(passage.waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["ebook-contents"].exists)
        capture(app, name: "EPUB quiet prose")
        passage.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).press(forDuration: 1.2)
        let lookup = app.menuItems["🐈 猫忆查"]
        XCTAssertTrue(lookup.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(app.menuItems["收藏"].exists)
        capture(app, name: "EPUB contextual learning menu")
        lookup.tap()
        let tray = app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch
        XCTAssertTrue(tray.waitForExistence(timeout: 5))
        XCTAssertGreaterThan(tray.frame.height, 300)
        XCTAssertTrue(app.otherElements["Popover"].exists == false)
        capture(app, name: "EPUB contextual annotation")
    }
    @MainActor func testEPUBPageTurnsAndChromeToggle() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        app.buttons["text-fixture-epub"].tap()
        let opening = app.webViews.staticTexts["The river"]
        XCTAssertTrue(opening.waitForExistence(timeout: 20))
        let pageLabel = app.staticTexts["ebook-page-position"]
        XCTAssertTrue(pageLabel.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["ebook-running-title"].exists)
        let initialPageLabel = pageLabel.value as? String
        let reader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        let initialPosition = reader.value as? String
        XCTAssertNotNil(initialPosition)
        app.swipeLeft()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value != %@", initialPosition!), object: reader)], timeout: 5) == .completed)
        XCTAssertNotEqual(pageLabel.value as? String, initialPageLabel)
        capture(app, name: "EPUB swipe to next page")
        app.swipeRight()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", initialPosition!), object: reader)], timeout: 5) == .completed)
        revealEbookControls(app)
        reader.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.48)).tap()
        XCTAssertFalse(app.buttons["ebook-contents"].exists)
        XCTAssertTrue(app.staticTexts["ebook-running-title"].exists)
        XCTAssertTrue(pageLabel.exists)
    }
    @MainActor func testEPUBTapZonesTurnPagesInReadingDirection() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        app.buttons["text-fixture-epub"].tap()
        XCTAssertTrue(app.webViews.staticTexts["The river"].waitForExistence(timeout: 20))
        let reader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "The river"), object: reader)], timeout: 5) == .completed)
        let opening = reader.value as? String
        reader.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value != %@", opening!), object: reader)], timeout: 5) == .completed)
        let second = reader.value as? String
        // A second tap keeps turning without waiting for the first animation to be acknowledged.
        reader.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value != %@", second!), object: reader)], timeout: 5) == .completed)
        // The far-left quarter turns back one page in an English book.
        reader.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.5)).tap()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", second!), object: reader)], timeout: 5) == .completed)
        capture(app, name: "EPUB tap zones in reading direction")
    }
    @MainActor func testCancelledEPUBDragAndEdgeBack() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        app.buttons["text-fixture-epub"].tap()
        XCTAssertTrue(app.webViews.staticTexts["The river"].waitForExistence(timeout: 20))
        let reader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "The river"), object: reader)], timeout: 5) == .completed)
        let position = reader.value as? String
        let start = reader.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.5))
        let end = reader.coordinate(withNormalizedOffset: CGVector(dx: 0.58, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.3)
        XCTAssertEqual(reader.value as? String, position)
        start.press(forDuration: 0.05, thenDragTo: reader.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.5)), withVelocity: .slow, thenHoldForDuration: 0.4)
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value != %@", position!), object: reader)], timeout: 5) == .completed)
        let edge = reader.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.5))
        edge.press(forDuration: 0.05, thenDragTo: start)
        XCTAssertTrue(app.buttons["text-fixture-epub"].waitForExistence(timeout: 5))
    }
    @MainActor func testPhoneLibrariesUseOneColumn() throws {
        guard UIDevice.current.userInterfaceIdiom == .phone else { throw XCTSkip("Phone library columns") }
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--tab-fixtures"]
        app.launch()
        let first = app.buttons["library-fixture-field-notes"]
        let second = app.buttons["library-fixture-japanese"]
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        XCTAssertTrue(second.exists)
        XCTAssertEqual(first.frame.minX, second.frame.minX, accuracy: 1)
        XCTAssertEqual(first.frame.width, second.frame.width, accuracy: 1)
        XCTAssertGreaterThan(second.frame.minY, first.frame.maxY)
        capture(app, name: "Single column phone libraries")
    }
    @MainActor func testPhoneCompactCardsAndScrollingTitle() throws {
        guard UIDevice.current.userInterfaceIdiom == .phone else { throw XCTSkip("Phone layout check") }
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures"]
        app.launch()
        app.buttons["library-fixture-field-notes"].tap()
        let card = app.buttons["text-fixture-reader"]
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        XCTAssertLessThan(card.frame.height, 180)
        capture(app, name: "Phone compact texts")
        card.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["reader-scrolled-title"].exists)
        capture(app, name: "Phone compact article header")
        app.swipeUp()
        XCTAssertTrue(app.staticTexts["reader-scrolled-title"].waitForExistence(timeout: 5))
        capture(app, name: "Garamond scrolling title")
        app.swipeDown()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.staticTexts["reader-scrolled-title"])], timeout: 5) == .completed)
    }
    @MainActor func testIPadAnchoredAnnotationAndRotation() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad presentation check") }
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures"]
        app.launch()
        openArticle(app)
        let paragraph = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "We walked along the bank")).firstMatch
        XCTAssertTrue(paragraph.waitForExistence(timeout: 10))
        let document = app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch
        XCTAssertEqual(document.frame.maxY, app.frame.maxY, accuracy: 2)
        paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0.61, dy: 0.22)).tap()
        let tray = app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch
        XCTAssertTrue(tray.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["The land beside a river."].exists)
        XCTAssertLessThan(tray.frame.width, 600)
        XCTAssertGreaterThan(tray.frame.width, 280)
        XCTAssertLessThan(tray.frame.width, 440)
        XCTAssertLessThan(tray.frame.height, 440)
        XCTAssertGreaterThan(tray.frame.maxY, app.staticTexts["embankment"].frame.maxY + 8)
        XCTAssertGreaterThan(app.links["在词典中查看"].frame.minY, app.staticTexts["embankment"].frame.maxY)
        let wordX = paragraph.frame.minX + paragraph.frame.width * 0.61
        XCTAssertLessThan(abs(tray.frame.midX - wordX), 120)
        capture(app, name: "iPad anchored annotation")
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.85)).tap()
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: tray)], timeout: 5) == .completed)
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.exists)
        capture(app, name: "iPad reader landscape")
        XCUIDevice.shared.orientation = .portrait
    }
    @MainActor func testEPUBContentsNavigationAndRotation() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        app.buttons["text-fixture-epub"].tap()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let opening = app.staticTexts["The river"]
        XCTAssertTrue(opening.waitForExistence(timeout: 20))
        let passage = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "We walked along the bank")).firstMatch
        XCTAssertTrue(passage.waitForExistence(timeout: 10))
        XCTAssertTrue(passage.isHittable)
        XCTAssertGreaterThan(app.webViews.firstMatch.frame.height, 300)
        capture(app, name: "EPUB opening")
        revealEbookControls(app)
        app.buttons["ebook-contents"].tap()
        let chapter = app.buttons["The garden"]
        XCTAssertTrue(chapter.waitForExistence(timeout: 10))
        capture(app, name: "Anchored contents tray")
        chapter.tap()
        XCTAssertTrue(app.staticTexts["The garden"].waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.webViews.firstMatch.exists)
        capture(app, name: "EPUB final chapter landscape")
        XCUIDevice.shared.orientation = .portrait
    }
    @MainActor func testPDFZoomActionsAreAlignedAndUsable() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        let pdf = app.buttons["text-fixture-pdf"]
        XCTAssertTrue(pdf.waitForExistence(timeout: 10)); pdf.tap()
        revealEbookControls(app)
        app.buttons["ebook-settings"].tap()
        let page = app.buttons["适合页面"], width = app.buttons["适合宽度"]
        XCTAssertTrue(page.waitForExistence(timeout: 5)); XCTAssertTrue(width.exists)
        XCTAssertGreaterThanOrEqual(page.frame.height, 44)
        XCTAssertGreaterThanOrEqual(width.frame.height, 44)
        XCTAssertEqual(page.frame.minX, width.frame.minX, accuracy: 1)
        XCTAssertEqual(page.frame.width, width.frame.width, accuracy: 1)
        capture(app, name: "PDF aligned zoom choices")
        page.tap()
        XCTAssertFalse(page.exists)
        app.buttons["ebook-settings"].tap(); width.tap()
        XCTAssertFalse(width.exists)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch.exists)
    }

    @MainActor func testPDFNavigation() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        let pdf = app.buttons["text-fixture-pdf"]
        for _ in 0..<4 where !pdf.isHittable { app.swipeUp() }
        pdf.tap()
        revealEbookControls(app)
        XCTAssertTrue(app.buttons["ebook-contents"].waitForExistence(timeout: 15))
        let reader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        for _ in 0..<3 where app.staticTexts["ebook-page-position"].value as? String != "第2页，共2页" {
            reader.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72)).press(forDuration: 0.05, thenDragTo: reader.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.24)))
        }
        XCTAssertEqual(app.staticTexts["ebook-page-position"].value as? String, "第2页，共2页")
        app.buttons["ebook-contents"].tap()
        XCTAssertTrue(app.buttons["1"].waitForExistence(timeout: 10)); app.buttons["1"].tap()
        app.buttons["ebook-contents"].tap()
        app.buttons["2"].tap()
        capture(app, name: "PDF final page")
    }
    @MainActor func testPDFContextualLearningMenu() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        let pdf = app.buttons["text-fixture-pdf"]
        for _ in 0..<4 where !pdf.isHittable { app.swipeUp() }
        pdf.tap()
        revealEbookControls(app)
        app.buttons["ebook-contents"].tap()
        app.buttons["2"].tap()
        let passage = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "The final PDF page")).firstMatch
        XCTAssertTrue(passage.waitForExistence(timeout: 10), app.debugDescription)
        passage.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5)).press(forDuration: 1.2)
        XCTAssertTrue(app.menuItems["🐈 猫忆查"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(app.menuItems["收藏"].exists)
        capture(app, name: "PDF contextual learning menu")
        app.menuItems["🐈 猫忆查"].tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch.waitForExistence(timeout: 5))
    }
    @MainActor func testEPUBControlsHaveFullTargetsAndStableTitle() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        app.buttons["text-fixture-epub"].tap()
        let reader = app.descendants(matching: .any).matching(identifier: "ebook-reader").firstMatch
        XCTAssertTrue(reader.waitForExistence(timeout: 15))
        let title = app.staticTexts["ebook-running-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        let originalTitle = title.frame
        revealEbookControls(app)
        XCTAssertEqual(title.frame.midX, originalTitle.midX, accuracy: 1)
        XCTAssertEqual(title.frame.midY, originalTitle.midY, accuracy: 1)
        let settings = app.buttons["ebook-settings"]
        XCTAssertTrue(settings.waitForExistence(timeout: 5))
        settings.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.9)).tap()
        XCTAssertTrue(app.sliders["字号"].waitForExistence(timeout: 5))
        app.buttons["完成"].tap()
        let contents = app.buttons["ebook-contents"]
        contents.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.9)).tap()
        XCTAssertTrue(app.buttons["完成"].waitForExistence(timeout: 5))
        app.buttons["完成"].tap()
        XCTAssertEqual(title.frame.midX, originalTitle.midX, accuracy: 1)
        XCTAssertEqual(title.frame.midY, originalTitle.midY, accuracy: 1)
        capture(app, name: "EPUB full control targets and stable title")
    }
    @MainActor func testEPUBReadingPreferencesPreserveChapter() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--ebook-fixtures"]
        app.launch()
        app.buttons["library-fixture-ebooks"].tap()
        app.buttons["text-fixture-epub"].tap()
        revealEbookControls(app)
        app.buttons["ebook-contents"].tap()
        app.buttons["The garden"].tap()
        XCTAssertTrue(app.webViews.staticTexts["The garden"].waitForExistence(timeout: 10))
        app.buttons["ebook-settings"].tap()
        let size = app.sliders["字号"]
        XCTAssertTrue(size.waitForExistence(timeout: 5))
        capture(app, name: "Native reading options")
        size.adjust(toNormalizedSliderPosition: 0.65)
        app.sliders["行距"].adjust(toNormalizedSliderPosition: 0.6)
        app.buttons["完成"].tap()
        XCTAssertTrue(app.webViews.staticTexts["The garden"].waitForExistence(timeout: 10))
        capture(app, name: "EPUB reading preferences")
        app.buttons["ebook-settings"].tap()
        app.sliders["字号"].adjust(toNormalizedSliderPosition: 2.0 / 14.0)
        app.sliders["行距"].adjust(toNormalizedSliderPosition: 1.0 / 7.0)
        app.buttons["完成"].tap()
    }
    @MainActor func testLibrarySwitchNeverDisplaysPreviousLanguageTexts() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("Sidebar switching check") }
        let app = XCUIApplication(); app.launchArguments = ["--fixtures", "--remote-gallery-fixtures"]
        app.launch()
        let english = app.buttons["library-fixture-field-notes"]
        let japanese = app.buttons["library-fixture-japanese"]
        XCTAssertTrue(english.waitForExistence(timeout: 10)); english.tap()
        XCTAssertTrue(app.buttons["text-fixture-reader"].waitForExistence(timeout: 10))
        japanese.tap()
        XCTAssertFalse(app.buttons["text-fixture-reader"].exists)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-loading-scene").firstMatch.exists)
        english.tap(); japanese.tap()
        XCTAssertTrue(app.buttons["text-fixture-garden"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["text-fixture-reader"].exists)
        sleep(2) // The non-cooperative old response must not replace this library.
        XCTAssertTrue(app.buttons["text-fixture-garden"].exists)
        XCTAssertFalse(app.buttons["text-fixture-reader"].exists)
        capture(app, name: "Library switch retains the selected language")
    }

    @MainActor func testIPadTabGutterDoesNotChangeAfterReading() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad tab gutter check") }
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--tab-fixtures", "--remote-gallery-fixtures"]
        app.launch()
        let library = app.buttons["library-fixture-field-notes"]
        XCTAssertTrue(library.waitForExistence(timeout: 10))
        library.tap()
        let article = app.buttons["text-fixture-forest"]
        XCTAssertTrue(article.waitForExistence(timeout: 10))
        let sidebarHeading = app.staticTexts["MY LIBRARIES"]
        let tabs = app.buttons["文库"].firstMatch
        XCTAssertTrue(sidebarHeading.exists)
        XCTAssertTrue(tabs.exists)
        XCTAssertLessThan(tabs.frame.minY, 60)
        XCTAssertGreaterThan(sidebarHeading.frame.minY, tabs.frame.maxY)
        let firstTitle = app.buttons["text-fixture-reader"].staticTexts["The art of noticing"].firstMatch
        XCTAssertLessThan(firstTitle.frame.minY, 200)
        XCTAssertEqual(app.staticTexts.matching(NSPredicate(format: "label == %@", "Field notes")).count, 1)
        let initialSidebarY = sidebarHeading.frame.minY
        let initialTextY = article.frame.minY
        capture(app, name: "Live gallery path after delayed API loading")
        article.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        app.buttons["BackButton"].tap()
        XCTAssertTrue(article.waitForExistence(timeout: 10))
        XCTAssertTrue(tabs.waitForExistence(timeout: 5))
        XCTAssertEqual(sidebarHeading.frame.minY, initialSidebarY, accuracy: 2)
        XCTAssertEqual(article.frame.minY, initialTextY, accuracy: 2)
        capture(app, name: "Library gutter after returning from text")
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(article.waitForExistence(timeout: 5))
        XCTAssertLessThan(tabs.frame.minY, 60)
        capture(app, name: "Library sidebar in landscape")
    }
    @MainActor func testIPadTextRailCounts() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad gallery check") }
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launchArguments = ["--fixtures", "--catalog-layout-fixtures"]
        app.launch()
        app.buttons["library-fixture-layout"].tap()
        let rail = app.descendants(matching: .any).matching(identifier: "texts-supporting-rail").firstMatch
        XCTAssertTrue(app.buttons["text-fixture-layout-0"].waitForExistence(timeout: 10))
        XCTAssertFalse(rail.exists)
        capture(app, name: "iPad portrait compact text column")
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "count == 5"), object: rail.buttons)], timeout: 5) == .completed)
        capture(app, name: "iPad landscape five supporting texts")
        app.buttons["text-fixture-layout-0"].tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        capture(app, name: "iPad reading cover title wash")
        XCUIDevice.shared.orientation = .portrait
    }
    @MainActor func testOnboardingOpensAndDismissesSignInTray() {
        let app = XCUIApplication()
        app.launchArguments = ["--onboarding"]
        app.launch()
        XCTAssertTrue(app.buttons["onboarding-start"].waitForExistence(timeout: 10))
        capture(app, name: "Chinese onboarding")
        app.buttons["onboarding-start"].coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.5)).tap()
        XCTAssertTrue(app.textFields["sign-in-email"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.secureTextFields["sign-in-password"].exists)
        capture(app, name: "Sign-in tray")
        app.buttons["取消"].tap()
        XCTAssertTrue(app.buttons["onboarding-start"].waitForExistence(timeout: 5))
    }

    @MainActor func testOnboardingAccessibilityAndDarkAppearance() {
        let app = XCUIApplication()
        app.launchArguments = ["--onboarding", "--dark-appearance", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.buttons["onboarding-start"].waitForExistence(timeout: 10))
        capture(app, name: "Onboarding dark accessibility text")
        app.buttons["onboarding-start"].coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        XCTAssertTrue(app.textFields["sign-in-email"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["取消"].exists)
        capture(app, name: "Sign-in tray dark accessibility text")
        app.buttons["取消"].tap()
        XCTAssertTrue(app.buttons["onboarding-start"].waitForExistence(timeout: 5))
    }
    @MainActor func testNavigationAndFinalSection() throws {
        let app = XCUIApplication()
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
        app.launch()
        capture(app, name: "Libraries")
        openArticle(app)
        let reader = app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch
        XCTAssertTrue(reader.waitForExistence(timeout: 10))
        capture(app, name: "Opening passage")
        let final = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "last sentence matters")).firstMatch
        for _ in 0..<8 where !final.exists { app.swipeUp() }
        XCTAssertTrue(final.waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = "Final section"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
    @MainActor func testMissingRecordingKeepsArticleText() throws {
        let app = XCUIApplication()
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
        app.launch()
        openArticle(app)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        app.buttons["录音"].tap()
        app.buttons["录音暂不可用"].tap()
        XCTAssertTrue(app.staticTexts["录音暂不可用"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.exists)
        app.buttons["停止播放"].tap()
        XCTAssertFalse(app.otherElements["playback-bar"].exists)
    }
    @MainActor func testLongReaderAndRotation() throws {
        let app = XCUIApplication()
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
        app.launchArguments.append("--reader-end")
        app.launch()
        openArticle(app, id: "fixture-long")
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "The final sentence of the long fixture")).firstMatch.waitForExistence(timeout: 5))
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch.exists)
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "The final sentence of the long fixture")).firstMatch.waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = "Long reader landscape"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        XCUIDevice.shared.orientation = .portrait
    }
    @MainActor func testMarkedWordOpensDefinition() throws {
        let app = XCUIApplication()
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
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
        capture(app, name: "Article highlighter strokes")
        // This coordinate targets the first marked bank in the default iPhone fixture layout.
        guard UIDevice.current.userInterfaceIdiom == .phone else { throw XCTSkip("iPhone fixture coordinate") }
        paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0.065, dy: 0.75)).tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["The land beside a river."].exists)
        capture(app, name: "Embedded definition")
        dismissDefinitionTray(app)
        XCTAssertTrue(paragraph.exists)
    }
    @MainActor func testSelectionKeepsCopyAndAddsDefine() throws {
        let app = XCUIApplication()
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
        app.launch()
        openArticle(app)
        let paragraph = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "A quiet page")).firstMatch
        XCTAssertTrue(paragraph.waitForExistence(timeout: 10))
        paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.5)).press(forDuration: 1)
        capture(app, name: "Selection menu")
        XCTAssertTrue(app.menuItems["拷贝"].waitForExistence(timeout: 5))
        let define = app.menuItems["🐈 猫忆查"]
        XCTAssertTrue(define.exists)
        for title in ["翻译", "查询", "搜索网页", "Translate", "Look Up", "Search Web"] {
            XCTAssertFalse(app.menuItems[title].exists)
        }
        define.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch.waitForExistence(timeout: 5))
        dismissDefinitionTray(app)
        XCTAssertTrue(paragraph.exists)
    }
    @MainActor func testDefinitionSheetPreservesAudioAndBackStopsIt() throws {
        guard UIDevice.current.userInterfaceIdiom == .phone else { throw XCTSkip("iPhone fixture coordinate") }
        let app = XCUIApplication()
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
        app.launch()
        openArticle(app)
        XCTAssertTrue(app.buttons["录音"].waitForExistence(timeout: 10))
        app.buttons["录音"].tap()
        app.buttons["播放测试音频"].tap()
        XCTAssertTrue(app.buttons["暂停"].waitForExistence(timeout: 10))
        let paragraph = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "We walked along the bank")).firstMatch
        XCTAssertTrue(paragraph.exists)
        paragraph.coordinate(withNormalizedOffset: CGVector(dx: 0.18, dy: 0.5)).tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch.waitForExistence(timeout: 5))
        dismissDefinitionTray(app)
        XCTAssertTrue(app.buttons["暂停"].exists)
        app.buttons["BackButton"].tap()
        XCTAssertTrue(app.buttons["text-fixture-reader"].waitForExistence(timeout: 5))
        app.buttons["text-fixture-reader"].tap()
        XCTAssertFalse(app.otherElements["playback-bar"].exists)
        XCTAssertFalse(app.buttons["暂停"].exists)
    }
    @MainActor func testRubyPassageRemainsReadable() throws {
        let app = XCUIApplication()
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
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
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
        app.launchArguments.append("--reader-end")
        app.launch()
        capture(app, name: "Libraries accessibility text")
        openArticle(app)
        let reader = app.descendants(matching: .any).matching(identifier: "reading-document").firstMatch
        XCTAssertTrue(reader.waitForExistence(timeout: 10))
        capture(app, name: "Accessibility text opening")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "last sentence matters")).firstMatch.waitForExistence(timeout: 5))
        capture(app, name: "Accessibility text final section")
    }
    @MainActor func testLibraryTextsReaderJourney() throws {
        let app = XCUIApplication()
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
        app.launch()
        XCTAssertFalse(app.buttons["text-fixture-reader"].exists)
        app.buttons["library-fixture-field-notes"].tap()
        XCTAssertTrue(app.buttons["text-fixture-reader"].waitForExistence(timeout: 5))
        capture(app, name: "文章")
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
        if !app.launchArguments.contains("--fixtures") { app.launchArguments.append("--fixtures") }
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
        for _ in 0..<5 where !article.isHittable { app.swipeUp() }
        XCTAssertTrue(article.waitForExistence(timeout: 5))
        if app.launchArguments.contains("UICTContentSizeCategoryAccessibilityXXXL") {
            capture(app, name: "Texts accessibility text")
        }
        article.tap()
    }
    @MainActor private func dismissDefinitionTray(_ app: XCUIApplication) {
        let tray = app.descendants(matching: .any).matching(identifier: "definition-tray").firstMatch
        if app.descendants(matching: .any).matching(identifier: "definition-top-tray").firstMatch.exists {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.8)).tap()
        } else if app.buttons["关闭释义"].exists {
            app.buttons["关闭释义"].tap()
        } else {
            let origin = app.coordinate(withNormalizedOffset: .zero)
            origin.withOffset(CGVector(dx: tray.frame.midX, dy: tray.frame.minY + 10))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)))
        }
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: tray)], timeout: 5) == .completed)
    }
    @MainActor private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
