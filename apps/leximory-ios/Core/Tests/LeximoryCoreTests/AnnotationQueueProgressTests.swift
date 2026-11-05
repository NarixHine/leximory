import Testing
@testable import LeximoryCore

struct AnnotationQueueProgressTests {
    @Test func pendingProgressIncludesReadyAndPendingArticles() {
        #expect(annotationQueueProgressLabel(readyCount: 0, pendingCount: 1) == "0/1")
        #expect(annotationQueueProgressLabel(readyCount: 1, pendingCount: 2) == "1/3")
    }

    @Test func completionShowsTheUnreadCount() {
        #expect(annotationQueueProgressLabel(readyCount: 1, pendingCount: 0) == "1")
        #expect(annotationQueueProgressLabel(readyCount: 101, pendingCount: 0) == "101")
    }

    @Test func anEmptyOrAcknowledgedQueueHasNoSuffix() {
        #expect(annotationQueueProgressLabel(readyCount: 0, pendingCount: 0) == nil)
    }
}
