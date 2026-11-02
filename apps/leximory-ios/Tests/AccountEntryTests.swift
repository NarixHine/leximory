import Foundation
import Testing
import LeximoryCore
@testable import Leximory

struct AccountEntryTests {
    @Test func accountCallbacksAcceptOnlyTheRegisteredRoute() {
        #expect(AccountSession.isAuthCallback(URL(string: "leximory://auth/callback?code=verified")!))
        #expect(AccountSession.isAuthCallback(URL(string: "https://auth/callback?code=verified")!) == false)
        #expect(AccountSession.isAuthCallback(URL(string: "leximory://untrusted/callback?code=verified")!) == false)
        #expect(AccountSession.isAuthCallback(URL(string: "leximory://auth/other?code=verified")!) == false)
        #expect(AccountSession.isAuthCallback(URL(string: "leximory://user@auth/callback?code=verified")!) == false)
        #expect(AccountSession.isAuthCallback(URL(string: "leximory://auth:1000/callback?code=verified")!) == false)
    }

    @Test func passwordRecoveryRecognizesPkceAndImplicitRedirects() {
        #expect(AccountSession.isPasswordRecoveryCallback(URL(string: "leximory://auth/callback?flow=recovery&code=verified")!))
        #expect(AccountSession.isPasswordRecoveryCallback(URL(string: "leximory://auth/callback#type=recovery&access_token=verified")!))
        #expect(AccountSession.isPasswordRecoveryCallback(URL(string: "leximory://auth/callback?code=verified")!) == false)
        #expect(AccountSession.isPasswordRecoveryCallback(URL(string: "https://auth/callback?flow=recovery")!) == false)
    }

    @Test func optionalVocabularyEntryUsesTheActualReadingWord() {
        let word = AccountWordContext(definition: Definition(lemma: "riverbank", definition: "河岸"), original: "bank",
                                      quote: "Along the bank", title: "River path", language: "en")
        let entry = AccountEntryContext(purpose: .words, word: word)
        #expect(entry.word?.definition.lemma == "riverbank")
        #expect(entry.word?.quote == "Along the bank")
        #expect(entry.heading == "登录解锁词汇本")
        #expect(entry.benefit == "登录后即可在云端同步生词并定期复盘噢！")
        #expect(entry.action == "登录并保存")
        #expect(AccountEntryContext().word == nil)
    }
    @Test func browserSelectionsCarryActualContextWithoutInventingATitleOrTranslation() throws {
        let selection = try JSONDecoder().decode(BrowserSelection.self, from: Data(#"{"quote":"children","context":"The children waved at me.","offset":4,"url":"https://example.com/reading"}"#.utf8))
        let item = DefinitionPresentation(source: .webpage(id: UUID(), selection: selection, bookmarkID: nil, libraryID: nil), definition: nil)
        let actual = try item.source.guestSelection(title: item.sourceTitle, language: "English")
        let definition = Definition(lemma: "child", definition: "**n. 孩子** `tʃaɪld` a young human being: *The child waved at me.*")
        let word = AccountWordContext(definition: definition, original: actual.quote, quote: actual.excerpt, title: actual.title, language: "en")
        #expect(word.original == "children")
        #expect(word.definition.lemma == "child")
        #expect(word.quote == "The children waved at me.")
        #expect(word.title == nil)
        #expect(word.definition.definition == definition.definition)
    }
    @Test func ebookSelectionsPreserveTheCapturedBookTitleAndDoNotRepeatAContextlessSelection() throws {
        let item = DefinitionPresentation(source: .ebook(textID: "book", quote: "腕組", context: "腕組", offset: 0),
            definition: nil, sourceTitle: "  銀河鉄道の夜  ")
        let selection = try item.source.guestSelection(title: item.sourceTitle, language: "Japanese")
        #expect(selection.title == "銀河鉄道の夜")
        #expect(selection.excerpt == nil)
        #expect(selection.quote == "腕組")
    }
    @Test func displayLanguageNeverReplacesTheCanonicalSaveLanguage() {
        let word = AccountWordContext(definition: Definition(lemma: "ontdekken", definition: "发现"), original: "ontdekt",
            quote: nil, title: nil, language: "nl")
        #expect(word.language == "nl")
        #expect(word.displayLanguage == "其他")
    }
}
