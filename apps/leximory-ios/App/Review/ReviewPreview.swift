#if DEBUG && targetEnvironment(simulator)
import Foundation
import LeximoryCore
import OpenAPIRuntime
import HTTPTypes

actor ReviewFixtureTransport: ClientTransport {
    private var translations: [[String: Any]] = ["quiet", "river", "discover", "connection", "wonder"].enumerated().map { index, word in
        ["prompt": "我们在河边发现了一个安静的地方。", "answer": "We discovered a quiet place by the river.", "keyword": word,
         "status": index < 2 ? "complete" : "idle", "submission": index < 2 ? "We found a quiet place." : NSNull(), "feedback": NSNull()]
    }
    private var conversation: [String: Any] = ["prompt": "小黑猫问：今天有什么让你停下脚步的小事？", "keywords": ["quiet", "discover", "wonder"], "status": "idle", "submission": NSNull(), "feedback": NSNull(), "reply": NSNull()]
    private var pendingIndex: Int?
    private var pendingConversation = false
    private var reads = 0
    private var initialFailuresRemaining = ProcessInfo.processInfo.arguments.contains("--review-recovery-fixture") ? 4 : 0
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        let path = (request.path ?? "").components(separatedBy: "?")[0]
        var payload: [String: Any]
        if request.method == .post {
            guard let body else { throw URLError(.badServerResponse) }
            let input = try JSONSerialization.jsonObject(with: await Data(collecting: body, upTo: 65536)) as? [String: Any] ?? [:]
            if path == "/review/translation", let index = input["index"] as? Int, translations.indices.contains(index) {
                translations[index]["submission"] = input["submission"]
                translations[index]["status"] = "pending"
                pendingIndex = index; reads = 0
            } else if path == "/review/conversation" {
                conversation["submission"] = input["submission"]; conversation["status"] = "pending"
                pendingConversation = true; reads = 0
            }
            payload = ["success": true]
        } else if path == "/review/check" {
            if initialFailuresRemaining > 0 {
                initialFailuresRemaining -= 1
                throw URLError(.timedOut)
            }
            reads += 1
            if reads > 2 {
                if let index = pendingIndex {
                    translations[index]["status"] = "complete"
                    translations[index]["feedback"] = ["rationale": "意思传达得很清楚。", "badPairs": [["original": "We find", "improved": "We found"]]]
                    pendingIndex = nil
                }
                if pendingConversation {
                    conversation["status"] = "complete"
                    conversation["feedback"] = ["goodPairs": [["original": "quiet", "note": "这个词很贴合语境。"]], "badPairs": []]
                    conversation["reply"] = "I love those quiet moments too. Tell me more about your day."
                    pendingConversation = false
                }
            }
            payload = ["exists": true, "inProgress": false, "stage": "complete", "story": "A quiet story", "translations": translations, "conversation": conversation]
        } else {
            let words = translations.enumerated().map { index, item in ["id": "review-\(index)", "word": item["keyword"]!, "lang": "en", "lib": "fixture", "fields": ["original": item["keyword"]!, "lemma": item["keyword"]!, "definition": "A word remembered from your reading."]] }
            let completed = translations.filter { $0["status"] as? String == "complete" }.count
            let percentage = conversation["status"] as? String == "complete" ? 100 : completed * 12
            payload = ["days": [["date": "2026-10-12", "displayDate": "10/12", "dayOfWeek": "Mon", "words": words, "count": 5,
                                 "progressByLang": ["en": ["percentage": percentage, "conversationCompleted": percentage == 100]], "isToday": false]]]
        }
        return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(try JSONSerialization.data(withJSONObject: payload)))
    }
}
#endif
