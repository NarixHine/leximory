import Testing
@testable import LeximoryCore

struct ResourceHistoryTests {
    @Test func resourcesShareOneHistoryAndNewNavigationDiscardsTheForwardBranch() {
        var history = ResourceHistory(home: "home")
        history.visit("folders")
        history.visit("ebook")
        history.visit("website")
        let moved1 = history.go(-1)
        #expect(moved1)
        #expect(history.current == "ebook")
        #expect(history.canGoForward)
        history.visit("article")
        #expect(history.entries == ["home", "folders", "ebook", "article"])
        #expect(history.canGoForward == false)
        let moved2 = history.go(-1)
        #expect(moved2)
        #expect(history.current == "ebook")
        let moved3 = history.go(1)
        #expect(moved3)
        #expect(history.current == "article")
    }
    @Test func boundariesAndStateUpdatesDoNotCreateDestinations() {
        var history = ResourceHistory(home: "home")
        let moved4 = history.go(-1)
        #expect(moved4 == false)
        history.visit("article:top")
        history.replaceCurrent("article:paragraph-5")
        #expect(history.entries == ["home", "article:paragraph-5"])
        let moved5 = history.go(1)
        #expect(moved5 == false)
        let moved6 = history.go(-1)
        #expect(moved6)
        let moved7 = history.go(1)
        #expect(moved7)
        #expect(history.current == "article:paragraph-5")
        history.reset(to: "home")
        #expect(history.entries == ["home"])
        #expect(history.canGoBack == false)
    }
}
