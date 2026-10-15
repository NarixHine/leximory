import SwiftUI
import Charts
import LeximoryCore

struct ReviewTimelineView: View {
    let client: MobileClient
    let progressOverrides: [String: ReviewDay.Progress]
    let open: (ReviewSelection) -> Void
    @State private var days: [ReviewDay] = []
    @State private var cursor: String?
    @State private var loading = false
    @State private var paginationVisible = false
    @State private var loadFailed = false
    @State private var hasLoaded = false
    @State private var retryReset = true
    @Environment(\.browserResourceActive) private var resourceActive
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedWord: ReviewDay.Word?
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.browserChromeHeight) private var chromeHeight

    var body: some View {
        Group {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("FORMING CONNECTIONS", systemImage: "cablecar")
                            .font(ReviewStyle.mono(14)).tracking(0.7).foregroundStyle(ReviewStyle.meta)
                        Text("回忆旧知，创造新知").font(ReviewStyle.handwriting(22)).foregroundStyle(LeximoryPalette.ink)
                    }.padding(.leading, dateWidth + 24)
                    if days.count > 1 {
                        Chart(Array(days.reversed().enumerated()), id: \.element.id) { index, day in
                            AreaMark(x: .value("日期", index), y: .value("词汇", day.count))
                                .foregroundStyle(LinearGradient(stops: [.init(color: ReviewStyle.chart.opacity(0.3), location: 0.05), .init(color: ReviewStyle.chart.opacity(0), location: 0.95)], startPoint: .top, endPoint: .bottom))
                                .interpolationMethod(.catmullRom(alpha: 0))
                            LineMark(x: .value("日期", index), y: .value("词汇", day.count))
                                .foregroundStyle(ReviewStyle.chart).lineStyle(StrokeStyle(lineWidth: 1))
                                .interpolationMethod(.catmullRom(alpha: 0))
                        }.chartXAxis(.hidden).chartYAxis(.hidden).chartXScale(domain: 0...max(1, days.count - 1), range: .plotDimension(padding: 0)).chartYScale(domain: 0...max(1, days.map(\.count).max() ?? 1))
                            .frame(height: 112).padding(.vertical, 8)
                            .accessibilityLabel("每日已存词汇数量")
                    }
                    if !hasLoaded { ProgressView().frame(maxWidth: .infinity).padding(60) }
                    if hasLoaded && !loading && days.isEmpty {
                        LeximoryUnavailableView("还没有可复习的词汇", systemImage: "leaf", message: "阅读时保存词汇，明天在这里回忆旧知。")
                    }
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(days) { day in
                            dayRow(day)
                        }
                        if cursor != nil && !loadFailed {
                            ProgressView().frame(maxWidth: .infinity)
                                .onAppear { paginationVisible = true; if !loading { Task { await load(reset: false) } } }
                                .onDisappear { paginationVisible = false }
                        }
                    }
                }.padding(.horizontal, 24).padding(.top, 20).padding(.bottom, 32).frame(maxWidth: 720).frame(maxWidth: .infinity)
            }.safeAreaPadding(.bottom, chromeHeight).background(LeximoryPalette.paper).scrollBounceBehavior(.basedOnSize)
                .refreshable { await load(reset: true) }
                .onChange(of: progressOverrides) { Task { await cache() } }
                .onChange(of: loading) { _, value in
                    if !value && paginationVisible && cursor != nil && !loadFailed { Task { await load(reset: false) } }
                }
                .task(id: scenePhase == .active && resourceActive) {
                    guard scenePhase == .active && resourceActive else { return }
                    if !hasLoaded, let cached = await client.localStore?.value(ReviewTimeline.self, for: "review-timeline") {
                        days = cached.days; cursor = cached.nextCursor; hasLoaded = true
                    }
                    await load(reset: true)
                }
                .task(id: loadFailed && scenePhase == .active && resourceActive) {
                    guard loadFailed && scenePhase == .active && resourceActive else { return }
                    var delay = 5
                    while !Task.isCancelled && loadFailed {
                        do { try await Task.sleep(for: .seconds(delay)) } catch { return }
                        guard !Task.isCancelled else { return }
                        if !loading { await load(reset: retryReset) }
                        delay = min(delay * 2, 30)
                    }
                }

        }.tint(.primary)
    }

    private var dateWidth: CGFloat { sizeClass == .regular ? 64 : 40 }

    private func dayRow(_ day: ReviewDay) -> some View {
        HStack(alignment: .top, spacing: 24) {
            VStack(alignment: .trailing, spacing: 5) {
                Text(day.dayOfWeek).font(LeximoryTypography.interface(12))
                    .foregroundStyle(day.isToday ? LeximoryPalette.ink : ReviewStyle.meta)
                Text(String(day.date.dropFirst(5)).replacingOccurrences(of: "-", with: "/")).font(LeximoryTypography.interface(day.isToday ? 20 : 14))
                    .foregroundStyle(day.isToday ? LeximoryPalette.ink : LeximoryPalette.sage).monospacedDigit()
            }.frame(width: dateWidth, alignment: .trailing).padding(.top, 4)
            VStack(alignment: .leading, spacing: day.isToday ? 12 : 8) {
                if day.isToday {
                    Text("今日 \(day.count) 词").font(ReviewStyle.handwriting(14)).foregroundStyle(ReviewStyle.word)
                }
                ReviewFlowLayout {
                    ForEach(day.words) { word in
                        wordPill(word, today: day.isToday)
                    }
                }
                if !day.isToday {
                    ReviewFlowLayout(spacing: 12, rowSpacing: 0) {
                        ForEach(day.progressByLang.keys.sorted(), id: \.self) { lang in
                            let progress = progressOverrides[ReviewSelection(date: day.date, language: lang).id] ?? day.progressByLang[lang]
                            Button { open(ReviewSelection(date: day.date, language: lang)) } label: {
                                ReviewProgressView(value: progress?.percentage ?? 0, language: lang,
                                                   conversationCompleted: progress?.conversationCompleted ?? false)
                                    .frame(minHeight: 44, alignment: .top).contentShape(.rect)
                            }.buttonStyle(.plain)
                                .accessibilityLabel("\(learningLanguageName(lang))，复习进度 \(progress?.percentage ?? 0)%")
                        }
                    }
                }
            }.frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, day.isToday ? 20 : 4)
        .padding(.horizontal, day.isToday ? 20 : 0)
        .background {
            if day.isToday {
                RoundedRectangle(cornerRadius: 16).fill(ReviewStyle.today)
                    .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(ReviewStyle.todayBorder, lineWidth: 1) }
            }
        }.padding(.horizontal, day.isToday ? -16 : 0)
    }

    private func wordPill(_ word: ReviewDay.Word, today: Bool) -> some View {
        Button { selectedWord = word } label: {
            Text(word.word).font(LeximoryTypography.prose(today ? 18 : 14, language: learningLanguageName(word.lang)))
                .foregroundStyle(ReviewStyle.word).fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .frame(minHeight: 36).background(ReviewStyle.pill, in: .rect(cornerRadius: 16))
        }.buttonStyle(.plain).disabled(word.fields == nil).accessibilityIdentifier("review-word-" + word.id)
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
    @MainActor private func cache() async {
        let updated = days.map { day in
            var value = day
            for lang in day.progressByLang.keys {
                if let progress = progressOverrides[ReviewSelection(date: day.date, language: lang).id] { value.progressByLang[lang] = progress }
            }
            return value
        }
        await client.localStore?.save(ReviewTimeline(days: updated, nextCursor: cursor), for: "review-timeline")
    }
    @MainActor private func load(reset: Bool) async {
        guard !loading else { return }
        loading = true
        retryReset = reset
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
            cursor = result.nextCursor; hasLoaded = true; loadFailed = false
            await cache()
        } catch { if !Task.isCancelled { loadFailed = true } }
    }
}
