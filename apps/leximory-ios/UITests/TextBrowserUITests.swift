import XCTest
import Network

final class TextBrowserUITests: XCTestCase {
    @MainActor func testAddressBarSettingsDoNotReopenDismissedDefinition() throws {
        let page = try BrowserPageServer()
        defer { page.listener.cancel() }
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--authoring-fixtures", "--reset-browser"]
        app.launch()
        let browse = app.buttons["冲浪"].firstMatch
        XCTAssertTrue(browse.waitForExistence(timeout: 10)); browse.tap()
        app.buttons["browser-address"].tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5)); input.typeText(page.url + "\n")
        let heading = app.webViews.staticTexts["A quiet forest"].firstMatch
        XCTAssertTrue(heading.waitForExistence(timeout: 15)); heading.press(forDuration: 1)
        let lookup = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "🐈 猫忆查")).firstMatch
        XCTAssertTrue(lookup.waitForExistence(timeout: 5)); lookup.tap()
        let definition = app.textViews["annotation-markdown"].firstMatch
        XCTAssertTrue(definition.waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.6)).tap()
        expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: definition)
        waitForExpectations(timeout: 5)
        app.buttons["网页选项"].tap()
        app.buttons["词汇收藏设置"].tap()
        let done = app.buttons["完成"]
        XCTAssertTrue(done.waitForExistence(timeout: 10))
        let enabled = NSPredicate(format: "enabled == true")
        expectation(for: enabled, evaluatedWith: done); waitForExpectations(timeout: 10)
        done.tap()
        XCTAssertTrue(app.buttons["browser-address"].waitForExistence(timeout: 5))
        XCTAssertFalse(definition.exists)
        XCTAssertFalse(app.staticTexts["正在理解语境"].exists)
    }

    @MainActor func testBrowserNavigationAddressEditingAndHistory() throws {
        let page = try BrowserPageServer()
        defer { page.listener.cancel() }
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--authoring-fixtures", "--reset-browser"]
        app.launch()
        let browse = app.buttons["冲浪"].firstMatch
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        let navigation = XCTAttachment(screenshot: app.screenshot()); navigation.name = "Browser navigation"; navigation.lifetime = .keepAlways; add(navigation)
        browse.tap()
        let bar = app.buttons["browser-address"]
        XCTAssertTrue(bar.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["关闭"].exists)
        XCTAssertTrue(app.buttons["文库"].firstMatch.isHittable)
        app.buttons["账号"].firstMatch.tap()
        XCTAssertTrue(browse.waitForExistence(timeout: 5)); browse.tap()
        XCTAssertTrue(bar.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["后退"].exists)
        bar.tap()
        let input = app.textFields["browser-address-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        XCTAssertLessThanOrEqual(input.frame.height, 56)
        input.typeText(page.url + "\n")
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["后退"].exists)
        let headingY = app.webViews.staticTexts["A quiet forest"].firstMatch.frame.minY
        bar.tap()
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        XCTAssertEqual(app.webViews.staticTexts["A quiet forest"].firstMatch.frame.minY, headingY, accuracy: 1)
        XCTAssertLessThanOrEqual(input.frame.height, 56)
        let editing = XCTAttachment(screenshot: app.screenshot()); editing.name = "Expanded address"; editing.lifetime = .keepAlways; add(editing)
        input.typeText("https://example.invalid")
        XCTAssertEqual(input.value as? String, "https://example.invalid")
        app.buttons["取消"].tap()
        XCTAssertTrue(bar.waitForExistence(timeout: 5))
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.exists)
        app.webViews.links["Continue walking"].firstMatch.tap()
        XCTAssertTrue(app.buttons["后退"].waitForExistence(timeout: 10))
        app.buttons["后退"].tap()
        XCTAssertTrue(bar.waitForExistence(timeout: 5))
        let gone = NSPredicate(format: "exists == false")
        expectation(for: gone, evaluatedWith: app.buttons["后退"])
        waitForExpectations(timeout: 10)
        app.buttons["文库"].firstMatch.tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "测试文库")).firstMatch.waitForExistence(timeout: 5))
        browse.tap()
        XCTAssertTrue(bar.waitForExistence(timeout: 5))
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 5))
        app.buttons["文库"].firstMatch.tap()
        app.terminate()
        app.launchArguments = ["--authoring-fixtures"]
        app.launch()
        XCTAssertTrue(browse.waitForExistence(timeout: 10)); browse.tap()
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["文库"].firstMatch.tap()
    }

    @MainActor func testBrowserControlsFollowTabBarPlacement() throws {
        let app = XCUIApplication()
        defer {
            XCUIDevice.shared.orientation = .portrait
            app.terminate(); app.launchArguments = []; app.launch()
        }
        app.launchArguments = ["--authoring-fixtures", "--reset-browser", "--browser-chrome-fixture"]
        app.launch()
        let surf = app.buttons["冲浪"].firstMatch
        XCTAssertTrue(surf.waitForExistence(timeout: 10)); surf.tap()
        let address = app.buttons["browser-address"]
        XCTAssertTrue(address.waitForExistence(timeout: 10))
        let webpage = app.webViews.firstMatch
        let header = webpage.staticTexts["Important page controls"].firstMatch
        XCTAssertTrue(header.waitForExistence(timeout: 60))
        let navigationAtBottom = surf.frame.midY > app.frame.height / 2
        if navigationAtBottom {
            XCTAssertLessThan(address.frame.maxY, app.frame.height / 3)
            XCTAssertGreaterThanOrEqual(header.frame.minY, address.frame.maxY)
        } else { XCTAssertGreaterThan(address.frame.minY, app.frame.height / 2) }
        XCTAssertTrue(app.buttons["网页选项"].isHittable)
        let initialY = address.frame.minY
        let capture = XCTAttachment(screenshot: app.screenshot())
        capture.name = "Top Browser controls protect webpage header"; capture.lifetime = .keepAlways; add(capture)
        webpage.swipeUp(); webpage.swipeUp()
        XCTAssertEqual(address.frame.minY, initialY, accuracy: 2)
        if navigationAtBottom { XCTAssertGreaterThanOrEqual(header.frame.minY, address.frame.maxY) }
        for orientation in [UIDeviceOrientation.portrait, .landscapeLeft] {
            XCUIDevice.shared.orientation = orientation
            XCTAssertTrue(address.waitForExistence(timeout: 5)); address.tap()
            let input = app.textFields["browser-address-input"]
            XCTAssertTrue(input.waitForExistence(timeout: 5))
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
            XCTAssertLessThan(input.frame.maxY, app.keyboards.firstMatch.frame.minY)
            if surf.frame.midY > app.frame.height / 2 {
                XCTAssertGreaterThanOrEqual(header.frame.minY, input.frame.maxY)
            }
            app.buttons["取消"].tap()
            XCTAssertTrue(address.waitForExistence(timeout: 5))
        }
    }

    @MainActor func testBookmarkCreationReturnsToLibraryAndOpensWebpage() throws {
        let page = try BrowserPageServer()
        defer { page.listener.cancel() }
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--authoring-fixtures", "--reset-browser", "--slow-browser-lookup"]
        app.launch()
        let library = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "测试文库")).firstMatch
        XCTAssertTrue(library.waitForExistence(timeout: 10)); library.tap()
        let create = app.buttons["导入"]
        XCTAssertTrue(create.waitForExistence(timeout: 10)); create.tap()
        XCTAssertTrue(app.buttons["网页"].exists)
        XCTAssertTrue(app.buttons["文本"].exists)
        XCTAssertTrue(app.buttons["电子书"].exists)
        app.buttons["网页"].tap()
        let address = app.textFields["import-网址"]
        XCTAssertTrue(address.waitForExistence(timeout: 5)); address.tap(); address.typeText(page.url)
        let save = app.buttons["content-bookmark-submit"]
        XCTAssertTrue(save.exists)
        XCTAssertTrue(app.buttons["content-import-submit"].exists)
        let creation = XCTAttachment(screenshot: app.screenshot()); creation.name = "Bookmark and import actions"; creation.lifetime = .keepAlways; add(creation)
        save.tap()
        let bookmark = app.buttons["text-new-bookmark"]
        XCTAssertTrue(bookmark.waitForExistence(timeout: 10))
        XCTAssertFalse(app.webViews.firstMatch.exists)
        bookmark.tap()
        XCTAssertTrue(app.buttons["browser-address"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 10))
        let heading = app.webViews.staticTexts["A quiet forest"].firstMatch
        XCTAssertTrue(heading.waitForExistence(timeout: 15), app.debugDescription)
        let browser = XCTAttachment(screenshot: app.screenshot()); browser.name = "Single-page browser"; browser.lifetime = .keepAlways; add(browser)
        heading.press(forDuration: 1)
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "🐈 猫忆查")).firstMatch.waitForExistence(timeout: 5), app.debugDescription)
        let menu = XCTAttachment(screenshot: app.screenshot()); menu.name = "Article-matched selection menu"; menu.lifetime = .keepAlways; add(menu)
        XCTAssertTrue(app.menuItems["拷贝"].exists)
        for title in ["拷贝高亮标记的链接", "Copy Link with Highlight", "查找所选内容", "翻译", "搜索网页"] {
            XCTAssertFalse(app.menuItems[title].exists)
        }
        XCTAssertFalse(app.buttons["共享"].exists)
        XCTAssertFalse(app.buttons["全选"].exists)
        assertNativeDefineAfterLeximory(in: app, actions: ["🐈 猫忆查"])
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "🐈 猫忆查")).firstMatch.tap()
        XCTAssertTrue(app.staticTexts["正在理解语境"].firstMatch.waitForExistence(timeout: 1))
        let loading = XCTAttachment(screenshot: app.screenshot()); loading.name = "Immediate context loading"; loading.lifetime = .keepAlways; add(loading)
        let definitionText = app.textViews["annotation-markdown"].firstMatch
        XCTAssertTrue(definitionText.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(definitionText.value as? String, "安静的")
        app.buttons["收藏词汇"].tap()
        XCTAssertTrue(app.buttons["编辑词汇"].waitForExistence(timeout: 5))
        let saved = XCTAttachment(screenshot: app.screenshot()); saved.name = "Saved browser tray"; saved.lifetime = .keepAlways; add(saved)
        app.buttons["编辑词汇"].tap()
        XCTAssertTrue(app.textFields["edit-词条"].waitForExistence(timeout: 5))
        app.buttons["取消"].tap()
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.6)).tap()
        app.buttons["关闭"].tap()
        XCTAssertTrue(bookmark.waitForExistence(timeout: 5))
    }
}

final class BrowserPageServer {
    let listener: NWListener
    let url: String
    init() throws {
        let listener = try NWListener(using: .tcp, on: .any)
        self.listener = listener
        let html = """
        <!doctype html><html><head><title>A quiet forest</title><meta name="theme-color" content="#d4ddc9"><meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{margin:0;background:#fffdf7;color:#192024;font:19px/1.7 Georgia,serif}main{max-width:560px;margin:100px auto;padding:24px}small{font:12px sans-serif;letter-spacing:2px;color:#5d7468}h1{font-size:38px;line-height:1.2}p{margin-top:28px}</style>
        </head><body><main><small>FIELD NOTES</small><h1>A quiet forest</h1>
        <p>The morning light fell across the winding river. We walked slowly beneath the trees, noticing the small things along the bank.</p>
        <p>A bird called from somewhere beyond the path. For a moment, the forest seemed to hold its breath.</p>
        <p>There was no need to hurry. Every turn offered another reason to look a little closer.</p><a href="/next">Continue walking</a></main></body></html>
        """
        let response = Data(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: \(html.utf8.count)\r\nConnection: close\r\n\r\n" + html).utf8)
        let ready = XCTestExpectation(description: "Local article server")
        listener.stateUpdateHandler = { state in if case .ready = state { ready.fulfill() } }
        listener.newConnectionHandler = { connection in
            connection.start(queue: .global(qos: .userInitiated))
            connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { _, _, _, _ in
                connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
            }
        }
        listener.start(queue: .global(qos: .userInitiated))
        guard XCTWaiter.wait(for: [ready], timeout: 5) == .completed, let port = listener.port else {
            listener.cancel(); throw NSError(domain: "BrowserPageServer", code: 1)
        }
        url = "http://127.0.0.1:\(port.rawValue)/article"
    }
}

@MainActor func assertNativeDefineAfterLeximory(in app: XCUIApplication, actions: [String], file: StaticString = #filePath, line: UInt = #line) {
    let native = app.menuItems.matching(NSPredicate(format: "label IN %@", ["查询", "Look Up", "Define", "定义"])).firstMatch
    var pages = 0
    while !native.isHittable && pages < 3 {
        let next = app.buttons["下一页"].firstMatch
        guard next.isHittable else { break }
        next.tap(); pages += 1
    }
    XCTAssertTrue(native.isHittable, "Native Define should remain available", file: file, line: line)
    if pages == 0, native.isHittable {
        for title in actions {
            let action = app.menuItems[title]
            if action.isHittable {
                let comesAfter = native.frame.minY > action.frame.minY + 5 || native.frame.minX > action.frame.minX
                XCTAssertTrue(comesAfter, "Native Define should follow \(title)", file: file, line: line)
            }
        }
    }
    for _ in 0..<pages {
        let previous = app.buttons["上一页"].firstMatch
        guard previous.isHittable else { break }
        previous.tap()
    }
}
