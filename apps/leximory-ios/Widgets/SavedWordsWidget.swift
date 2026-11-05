import SwiftUI
import WidgetKit

struct SavedWordsEntry: TimelineEntry {
    let date: Date
    let snapshot: SavedWordsSnapshot?
}

struct SavedWordsProvider: TimelineProvider {
    func placeholder(in context: Context) -> SavedWordsEntry {
        SavedWordsEntry(date: .now, snapshot: .sample())
    }

    func getSnapshot(in context: Context, completion: @escaping (SavedWordsEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : current())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SavedWordsEntry>) -> Void) {
        let now = Date.now
        let midnight = SavedWordsSnapshot.calendar.date(byAdding: .day, value: 1,
            to: SavedWordsSnapshot.calendar.startOfDay(for: now))!
        let snapshot = SavedWordsWidgetStore().snapshot
        completion(Timeline(entries: [
            SavedWordsEntry(date: now, snapshot: snapshot?.ending(on: now)),
            SavedWordsEntry(date: midnight, snapshot: snapshot?.ending(on: midnight))
        ], policy: .after(midnight.addingTimeInterval(300))))
    }

    private func current() -> SavedWordsEntry {
        SavedWordsEntry(date: .now, snapshot: SavedWordsWidgetStore().snapshot?.ending(on: .now))
    }
}

struct SavedWordsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: SavedWordsWidgetStore.kind, provider: SavedWordsProvider()) { entry in
            SavedWordsEntryView(entry: entry)
        }
        .configurationDisplayName("Saved words")
        .description("Your saved words over the last 30 days.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

private struct SavedWordsEntryView: View {
    let entry: SavedWordsEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        SavedWordsWidgetView(snapshot: entry.snapshot, family: family, date: entry.date)
    }
}

@main
struct LeximoryWidgets: WidgetBundle {
    var body: some Widget {
        SavedWordsWidget()
    }
}

#Preview(as: .systemSmall) {
    SavedWordsWidget()
} timeline: {
    SavedWordsEntry(date: .now, snapshot: .sample())
    SavedWordsEntry(date: .now, snapshot: SavedWordsSnapshot(activity: [], endingOn: "2026-10-30"))
    SavedWordsEntry(date: .now, snapshot: nil)
}

#Preview(as: .systemMedium) {
    SavedWordsWidget()
} timeline: {
    SavedWordsEntry(date: .now, snapshot: .sample())
}
