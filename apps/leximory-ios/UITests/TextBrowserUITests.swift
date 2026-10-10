import XCTest
import Network

final class TextBrowserUITests: XCTestCase {
    @MainActor func testBrowserNavigationAddressEditingAndHistory() throws {
        let page = try BrowserPageServer()
        defer { page.listener.cancel() }
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--authoring-fixtures", "--reset-browser"]
        app.launch()
        let browse = app.buttons["浏览"].firstMatch
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        let navigation = XCTAttachment(screenshot: app.screenshot()); navigation.name = "Browser navigation"; navigation.lifetime = .keepAlways; add(navigation)
        browse.tap()
        let bar = app.buttons["browser-address"]
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
        app.buttons["关闭"].tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "测试文库")).firstMatch.waitForExistence(timeout: 5))
        browse.tap()
        XCTAssertTrue(bar.waitForExistence(timeout: 5))
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 5))
        app.buttons["关闭"].tap()
        app.terminate()
        app.launchArguments = ["--authoring-fixtures"]
        app.launch()
        XCTAssertTrue(browse.waitForExistence(timeout: 10)); browse.tap()
        XCTAssertTrue(app.webViews.staticTexts["A quiet forest"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["关闭"].tap()
    }

    @MainActor func testBookmarkCreationReturnsToLibraryAndOpensWebpage() throws {
        let page = try BrowserPageServer()
        defer { page.listener.cancel() }
        let app = XCUIApplication()
        defer { app.terminate(); app.launchArguments = []; app.launch() }
        app.launchArguments = ["--authoring-fixtures", "--reset-browser"]
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
        for title in ["拷贝高亮标记的链接", "Copy Link with Highlight", "翻译", "查询", "搜索网页"] {
            XCTAssertFalse(app.menuItems[title].exists)
        }
        XCTAssertFalse(app.buttons["共享"].exists)
        XCTAssertFalse(app.buttons["全选"].exists)
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "🐈 猫忆查")).firstMatch.tap()
        XCTAssertTrue(app.staticTexts["安静的"].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.6)).tap()
        app.buttons["关闭"].tap()
        XCTAssertTrue(bookmark.waitForExistence(timeout: 5))
    }
}

private final class BrowserPageServer {
    let listener: NWListener
    let url: String
    init() throws {
        let listener = try NWListener(using: .tcp, on: .any)
        self.listener = listener
        let html = """
        <!doctype html><html><head><title>A quiet forest</title><meta name="viewport" content="width=device-width, initial-scale=1">
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
