import LeximoryCore
import Testing

struct PDFHighlightExcerptTests {
    @Test(arguments: [
        ("Japanese", "「春が来\nた。」\r\n庭へ行く。", "「春が来た。」庭へ行く。"),
        ("ja", "使い方は\nＰＤＦ\nを参照", "使い方はＰＤＦを参照"),
        ("Japanese", "𠮷野で\nNew\nYorkの話をした", "𠮷野でNew Yorkの話をした"),
        ("Japanese", "ﾊﾝ\nｶｸｶﾅ", "ﾊﾝｶｸｶﾅ"),
        ("zh", "人之初\u{2028}性本善，\r\n　性相近\r習相遠。", "人之初性本善，性相近習相遠。"),
        ("English", "《論\n語》", "《論語》"),
        ("zh", "見《\nThe Analects\n》", "見《The Analects》"),
        ("French", "L’\nété, qu'\non attendait, arriva.", "L’été, qu'on attendait, arriva."),
        ("French", "Il parle d\n'accord.", "Il parle d'accord."),
        ("fr", "Elle dit\n: «\nBonjour\n!\n»", "Elle dit\u{00A0}: «\u{00A0}Bonjour\u{202F}!\u{00A0}»"),
        ("French", "Bonjour\u{202F}\r\n! «\n\u{00A0}Salut\u{00A0}\n»", "Bonjour\u{202F}! «\u{00A0}Salut\u{00A0}»"),
        ("French", "‘Bonjour’\npuis elle rit.", "‘Bonjour’ puis elle rit."),
        ("French", "porte-\nmanteau et extra\u{00AD}\nordinaire", "porte-manteau et extraordinaire"),
        ("French", "Bonjour —\ncomment allez-vous\n?", "Bonjour — comment allez-vous\u{202F}?"),
        ("English", "\r\n  The first\r\n\t\nline\u{2029}continues\u{000C}here.\n ", "The first line continues here."),
        ("English", "Look (\nat this\n), please.", "Look (at this), please."),
        ("English", "cafe\n\u{0301}", "café"),
        ("English", "👩\u{200D}\n💻 at work", "👩‍💻 at work"),
        ("English", "one\u{200B}\ntwo", "one\u{200B}two"),
        ("English", "Already  formatted.", "Already  formatted."),
        ("English", "\r\n\t \u{2028}", ""),
        ("English", "", ""),
    ])
    func joinsPDFLines(language: String, quote: String, expected: String) {
        #expect(PDFHighlightExcerpt.reflow(quote, language: language) == expected)
    }
}
