import Foundation
import CoreHaptics
import UIKit
import LeximoryCore

@MainActor final class DefinitionPreviewBuffer {
    private var raw = ""
    private var retaining = false
    private var published: Definition?
    private var update: Task<Void, Never>?
    private let publish: (Definition) -> Void

    init(publish: @escaping (Definition) -> Void) { self.publish = publish }

    func restart(retaining: Bool) {
        cancel()
        raw = ""
        self.retaining = retaining
        published = nil
    }

    func append(_ text: String) {
        raw += text
        guard !retaining else { return }
        if published == nil { flush(); return }
        guard update == nil else { return }
        update = Task { [weak self] in
            do { try await Task.sleep(for: .milliseconds(32)) } catch { return }
            self?.flush()
        }
    }

    func cancel() { update?.cancel(); update = nil }

    func flush() {
        cancel()
        guard !retaining, let preview = Self.preview(raw), preview != published else { return }
        published = preview
        publish(preview)
    }

    static func preview(_ raw: String) -> Definition? {
        let fields = raw.components(separatedBy: "||")
        guard fields.count >= 3 else { return nil }
        func field(_ index: Int) -> String? {
            guard index < fields.count else { return nil }
            var value = fields[index]
            if index == fields.count - 1 {
                while value.last == "|" || value.last == "}" { value.removeLast() }
                value = readablePrefix(value)
            }
            value = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return value.isEmpty ? nil : value
        }
        guard let meaning = field(2) else { return nil }
        return Definition(lemma: field(1) ?? "", definition: meaning, etymology: field(3), cognates: field(4))
    }

    private static func readablePrefix(_ text: String) -> String {
        var end = text.endIndex
        if let ruby = text.range(of: "<ruby", options: .backwards),
           text[ruby.lowerBound...].range(of: "</ruby>") == nil { end = ruby.lowerBound }
        if let tag = text[..<end].lastIndex(of: "<"), !text[tag..<end].contains(">") { end = tag }
        var delimiters: [(token: Substring, start: String.Index)] = []
        var index = text.startIndex
        while index < end {
            let character = text[index]
            if character == "\\" {
                index = text.index(after: index)
                if index < end { index = text.index(after: index) }
                continue
            }
            guard character == "*" || character == "`" else { index = text.index(after: index); continue }
            let start = index
            repeat { index = text.index(after: index) } while index < end && text[index] == character
            let token = text[start..<index]
            if delimiters.last?.token == token { delimiters.removeLast() }
            else if delimiters.last?.token.first != "`" { delimiters.append((token, start)) }
        }
        if let unmatched = delimiters.first { end = min(end, unmatched.start) }
        return String(text[..<end])
    }
}

@MainActor enum AnnotationFeedback {
    static let preferenceKey = "annotation-haptics-enabled"
    static let supported = UIDevice.current.userInterfaceIdiom == .phone && CHHapticEngine.capabilitiesForHardware().supportsHaptics
}

struct DefinitionStreamFeedback {
    private var highWaterCount = 0
    private var lastPulse: ContinuousClock.Instant?
    private(set) var pulse = 0

    mutating func update(characterCount: Int, enabled: Bool = true, now: ContinuousClock.Instant = .now) {
        guard characterCount > highWaterCount else { return }
        highWaterCount = characterCount
        guard enabled, lastPulse.map({ now - $0 >= .milliseconds(120) }) ?? true else { return }
        lastPulse = now
        pulse += 1
    }
}
