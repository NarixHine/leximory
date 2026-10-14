import SwiftUI
import Charts
import LeximoryCore

struct ReviewTimelineView: View {
    let client: MobileClient
    @State private var days: [ReviewDay] = []
    @State private var streak: ReviewStreak?
    @State private var cursor: String?
    @State private var loading = true
    @State private var paginationVisible = false
    @State private var error: String?
    @State private var selected: ReviewSelection?
    @State private var selectedWord: ReviewDay.Word?
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dismiss) private var dismiss
    private let columns = [GridItem(.adaptive(minimum: 100), spacing: 8)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("FORMING CONNECTIONS", systemImage: "cablecar")
                            .font(.system(size: 11, design: .monospaced)).tracking(1.2).foregroundStyle(.secondary)
                        Text("回忆旧知，创造新知").editorialFont(28, relativeTo: .title)
                    }
                    if days.count > 1 {
                        Chart(days.reversed()) { day in
                            AreaMark(x: .value("日期", day.displayDate), y: .value("词汇", day.count))
                                .foregroundStyle(LeximoryPalette.sage.opacity(0.15)).interpolationMethod(.monotone)
                            LineMark(x: .value("日期", day.displayDate), y: .value("词汇", day.count))
                                .foregroundStyle(LeximoryPalette.sage).interpolationMethod(.monotone)
                        }.chartXAxis(.hidden).chartYAxis(.hidden).frame(height: 100)
                            .accessibilityLabel("每日已存词汇数量")
                    }
                    if let streak { streakView(streak) }
                    if loading && days.isEmpty { ProgressView().frame(maxWidth: .infinity).padding(60) }
                    if let error {
                        Text(error).foregroundStyle(.secondary)
                        Button("重试") { Task { await load(reset: days.isEmpty) } }
                    } else if !loading && days.isEmpty {
                        LeximoryUnavailableView("还没有可复习的词汇", systemImage: "leaf", message: "阅读时保存词汇，明天在这里回忆旧知。")
                    }
                    LazyVStack(alignment: .leading, spacing: 24) {
                        ForEach(days) { day in
                            VStack(alignment: .leading, spacing: 14) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(day.isToday ? "今天" : day.displayDate).editorialFont(22, relativeTo: .title3)
                                    Text(day.dayOfWeek).font(LeximoryTypography.interface(13)).foregroundStyle(.secondary)
                                    Spacer()
                                    Text("\(day.count) 词").font(LeximoryTypography.interface(13)).foregroundStyle(.secondary)
                                }
                                LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                                    ForEach(day.words) { word in
                                        Button { selectedWord = word } label: {
                                            AnnotationMarkdownText(content: word.word, size: 17, language: learningLanguageName(word.lang))
                                                .frame(maxWidth: .infinity, minHeight: 44).padding(.horizontal, 8)
                                                .background(LeximoryPalette.paper, in: .capsule)
                                        }.buttonStyle(.plain).disabled(word.fields == nil)
                                            .popover(isPresented: Binding(get: { selectedWord?.id == word.id }, set: { if !$0 { selectedWord = nil } })) {
                                                if let fields = word.fields {
                                                    CorpusWordTray(word: SavedWord(id: word.id, libraryId: word.lib, fields: fields),
                                                        library: FixtureLibrary(id: LibraryID(rawValue: word.lib), name: "", language: learningLanguageName(word.lang), articles: [], owned: true),
                                                        client: client, isPopover: sizeClass == .regular) { saved in
                                                            for dayIndex in days.indices {
                                                                if let wordIndex = days[dayIndex].words.firstIndex(where: { $0.id == saved.id }) {
                                                                    days[dayIndex].words[wordIndex].word = saved.fields.original
                                                                    days[dayIndex].words[wordIndex].fields = saved.fields
                                                                    Task { await cache() }
                                                                }
                                                            }
                                                        }.id(word.id).presentationCompactAdaptation(.sheet).presentationDragIndicator(.visible)
                                                }
                                            }
                                    }
                                }
                                if day.isToday {
                                    Text("今天的新词将在明天与你重逢。")
                                        .font(LeximoryTypography.interface(14)).foregroundStyle(.secondary)
                                } else {
                                    ForEach(day.progressByLang.keys.sorted(), id: \.self) { lang in
                                        let progress = day.progressByLang[lang]?.percentage ?? 0
                                        Button { selected = ReviewSelection(date: day.date, language: lang) } label: {
                                            HStack(spacing: 12) {
                                                Text(learningLanguageName(lang)).font(LeximoryTypography.interface(15))
                                                ProgressView(value: Double(progress), total: 100).tint(LeximoryPalette.sage)
                                                Text("\(progress)%").font(.system(size: 12, design: .monospaced))
                                                Image(systemName: progress == 100 ? "checkmark.circle.fill" : "arrow.right")
                                            }.foregroundStyle(.primary).padding(12)
                                                .background(LeximoryPalette.paper, in: .rect(cornerRadius: 16))
                                        }.buttonStyle(.plain).accessibilityLabel("\(learningLanguageName(lang))，复习进度 \(progress)%")
                                    }
                                }
                            }.padding(20).background(LeximoryPalette.shell, in: .rect(cornerRadius: 28))
                        }
                        if cursor != nil {
                            ProgressView().frame(maxWidth: .infinity)
                                .onAppear { paginationVisible = true; if !loading { Task { await load(reset: false) } } }
                                .onDisappear { paginationVisible = false }
                        }
                    }
                }.padding(24).frame(maxWidth: 640).frame(maxWidth: .infinity)
            }.background(LeximoryPalette.paper).scrollBounceBehavior(.basedOnSize)
                .refreshable { await load(reset: true) }
                .onChange(of: loading) { _, value in
                    if !value && paginationVisible && cursor != nil && error == nil { Task { await load(reset: false) } }
                }
                .toolbar {
                    ToolbarItem(placement: .principal) { Text("复习").font(LeximoryTypography.interface(17)) }
                    ToolbarItem(placement: .cancellationAction) { Button("完成", systemImage: "xmark") { dismiss() } }
                }
                .navigationBarTitleDisplayMode(.inline)
                .task {
                    if let cached = await client.localStore?.value(ReviewTimeline.self, for: "review-timeline") {
                        days = cached.days; streak = cached.streak; cursor = cached.nextCursor
                    }
                    await load(reset: true)
                }
                .fullScreenCover(item: $selected, onDismiss: { Task { await refreshStreak() } }) { selection in
                    ReviewSessionView(client: client, selection: selection) { snapshot in
                        if let index = days.firstIndex(where: { $0.date == selection.date }) {
                            days[index].progressByLang[selection.language] = .init(percentage: snapshot.percentage, conversationCompleted: snapshot.conversation?.status == .complete)
                            Task { await cache() }
                        }
                    }.id(selection.id)
                }
        }.tint(.primary).environment(\.openURL, OpenURLAction { _ in .systemAction })
    }

    private func streakView(_ streak: ReviewStreak) -> some View {
        VStack(spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(streak.total)").editorialFont(38, relativeTo: .largeTitle, language: nil)
                Text("天连续复习").font(LeximoryTypography.interface(15)).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity)
            HStack {
                ForEach(streak.checkDays) { day in
                    VStack(spacing: 7) {
                        Image(systemName: day.completed ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(day.completed ? LeximoryPalette.sage : LeximoryPalette.secondaryBorder).font(.title3)
                        Text(day.displayDate).font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity).accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(day.displayDate)，\(day.completed ? "已复习" : "未复习")")
                }
            }
        }
    }
    @MainActor private func cache() async {
        guard let streak else { return }
        let value = ReviewTimeline(days: days, nextCursor: cursor, streak: streak)
        await client.localStore?.save(value, for: "review-timeline")
    }
    @MainActor private func refreshStreak() async {
        guard let value = try? await client.reviewTimeline(), !Task.isCancelled else { return }
        streak = value.streak
        await cache()
    }
    @MainActor private func load(reset: Bool) async {
        if !reset && loading { return }
        loading = true
        defer { loading = false }
        do {
            let result = try await client.reviewTimeline(cursor: reset ? nil : cursor)
            try Task.checkCancellation()
            if reset { days = result.days } else {
                for day in result.days {
                    if let index = days.firstIndex(where: { $0.date == day.date }) {
                        let existingIDs = Set(days[index].words.map(\.id))
                        days[index].words += day.words.filter { !existingIDs.contains($0.id) }
                        days[index].progressByLang.merge(day.progressByLang) { _, new in new }
                    } else { days.append(day) }
                }
            }
            cursor = result.nextCursor; streak = result.streak; error = nil
            await cache()
        } catch { if !Task.isCancelled { self.error = "复习记录暂时无法打开。" } }
    }
}
