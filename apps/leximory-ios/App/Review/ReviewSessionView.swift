import SwiftUI
import LeximoryCore

private enum ReviewPanel: Identifiable {
    case story, translation(Int), conversation
    var id: String {
        switch self { case .story: "story"; case .translation(let index): "translation-\(index)"; case .conversation: "conversation" }
    }
}

struct ReviewSessionView: View {
    let onExit: (ReviewSnapshot) -> Void
    @State private var model: ReviewModel
    @State private var panel: ReviewPanel?
    @State private var catPoint = UnitPoint(x: 0.4, y: 0.78)
    @State private var moving = false
    @State private var retryID = UUID()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.scenePhase) private var scenePhase

    init(client: MobileClient, selection: ReviewSelection, onExit: @escaping (ReviewSnapshot) -> Void = { _ in }) {
        self.onExit = onExit
        _model = State(initialValue: ReviewModel(client: client, selection: selection))
    }
    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: 20) {
                        VStack(spacing: 10) {
                            Text(model.selection.date).font(.system(size: 12, design: .monospaced)).foregroundStyle(.secondary)
                            Text("回忆旧知，创造新知").editorialFont(26, relativeTo: .title2)
                            if let snapshot = model.snapshot, snapshot.exists {
                                ReviewProgressView(value: snapshot.percentage)
                            }
                            if model.snapshot?.exists != true && model.error == nil {
                                HStack(spacing: 10) { ProgressView(); Text("正在准备你的复习").font(LeximoryTypography.interface(14)).foregroundStyle(.secondary) }
                            }
                        }.padding(.top, 16)
                        if let error = model.error, model.snapshot?.exists != true && model.snapshot?.inProgress != true {
                            LeximoryUnavailableView("复习暂时无法打开", systemImage: "leaf", message: error) {
                                Button("重试") { retryID = UUID() }
                            }
                        } else {
                            lawn(width: min(840, max(0, geometry.size.width - 40)), availableHeight: geometry.size.height - 150)
                        }
                    }.padding(.horizontal, 20).frame(maxWidth: 880).frame(maxWidth: .infinity)
                }.scrollBounceBehavior(.basedOnSize).accessibilityIdentifier("review-session-scroll")
            }.background(LeximoryPalette.paper)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("返回", systemImage: "xmark") { if let snapshot = model.snapshot { onExit(snapshot) }; dismiss() }.accessibilityIdentifier("review-session-close") }
                    ToolbarItem(placement: .principal) { Text(learningLanguageName(model.selection.language)).font(LeximoryTypography.interface(16)) }
                }
                .sheet(item: $panel) { item in
                    switch item {
                    case .story: ReviewStorySheet(document: model.snapshot?.storyDocument, language: learningLanguageName(model.selection.language), identity: model.selection.id)
                    case .translation(let index): ReviewExerciseSheet(model: model, index: index)
                    case .conversation: ReviewExerciseSheet(model: model, index: nil)
                    }
                }
        }.tint(.primary)
            .task(id: "\(retryID):\(scenePhase == .active)") { if scenePhase == .active { await model.observe() } }
    }

    private func lawn(width: CGFloat, availableHeight: CGFloat) -> some View {
        let translations = (model.snapshot?.translations ?? []).enumerated().map { ReviewTranslationItem(index: $0.offset, value: $0.element) }
        let columns = width > 700 && !typeSize.isAccessibilitySize ? 3 : typeSize.isAccessibilitySize ? 1 : 2
        let rows = Int(ceil(Double(translations.count) / Double(columns)))
        let baseHeight = width >= 700 ? min(availableHeight, width * 0.65) : availableHeight
        let height = max(420, baseHeight, CGFloat(rows) * (typeSize.isAccessibilitySize ? 144 : 100) + 320)
        return ZStack {
            if let lawn = ReviewArtwork.lawn(dark: colorScheme == .dark, vertical: width < 700) {
                Image(uiImage: lawn).resizable().scaledToFill().frame(width: width, height: height).clipped().accessibilityHidden(true)
            }
            VStack(spacing: 28) {
                if model.snapshot?.story != nil {
                    taskPill("连词成文", symbol: "book", completed: false) { open(.story, at: UnitPoint(x: 0.5, y: 0.18)) }
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: columns), spacing: 20) {
                    ForEach(translations) { task in
                        let index = task.index
                        let item = task.value
                        taskPill(item.keyword, symbol: item.status == .pending ? "hourglass" : nil, completed: item.status == .complete) {
                            let point = UnitPoint(x: (Double(index % columns) + 0.5) / Double(columns), y: 0.25 + 0.42 * (Double(index / columns) + 0.5) / Double(max(1, rows)))
                            open(.translation(index), at: point)
                        }
                    }
                }.padding(.horizontal, 12)
                Spacer(minLength: 60)
                if model.snapshot?.conversation != nil {
                    Button { open(.conversation, at: UnitPoint(x: 0.7, y: 0.82)) } label: {
                        VStack(spacing: 0) {
                            ReviewCat(black: true, moving: false).frame(width: 146, height: 80)
                            Label(model.snapshot?.conversation?.status == .complete ? "每日练笔 · 已完成" : "每日练笔", systemImage: model.snapshot?.conversationUnlocked == true ? "pencil.line" : "lock")
                                .font(LeximoryTypography.interface(15)).foregroundStyle(.primary)
                                .padding(.horizontal, 16).padding(.vertical, 10)
                                .background(LeximoryPalette.paper.opacity(0.92), in: .capsule)
                        }
                    }.buttonStyle(.plain).frame(maxWidth: .infinity, alignment: .trailing)
                        .accessibilityLabel(model.snapshot?.conversationUnlocked == true ? "每日练笔" : "每日练笔，完成六成翻译后解锁")
                }
            }.padding(.horizontal, 16).padding(.top, 55).padding(.bottom, 48)
            GeometryReader { geometry in
                ReviewCat(black: false, moving: moving)
                    .frame(width: 110, height: 60)
                    .position(x: catPoint.x * geometry.size.width, y: catPoint.y * geometry.size.height)
                    .allowsHitTesting(false).accessibilityHidden(true)
            }
        }.frame(width: width, height: height).clipShape(.rect(cornerRadius: 36))
    }
    private func taskPill(_ title: String, symbol: String?, completed: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let symbol { Image(systemName: symbol) }
                Text(title).strikethrough(completed).fixedSize(horizontal: false, vertical: true)
                if completed { Image(systemName: "checkmark").font(.caption) }
            }.font(LeximoryTypography.interface(16)).foregroundStyle(completed ? .secondary : .primary)
                .padding(.horizontal, 14).padding(.vertical, 10).frame(minHeight: 44)
                .background(LeximoryPalette.shell.opacity(0.96), in: .capsule)
                .overlay { Capsule().strokeBorder(LeximoryPalette.secondaryBorder, lineWidth: 3) }
        }.buttonStyle(.plain).accessibilityIdentifier("review-task-" + title).accessibilityLabel("\(title)\(completed ? "，已完成" : "")")
    }
    private func open(_ item: ReviewPanel, at point: UnitPoint) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.45)) { catPoint = point }
        moving = !reduceMotion
        panel = item
        Task { try? await Task.sleep(for: .milliseconds(500)); moving = false }
    }
}

private struct ReviewTranslationItem: Identifiable {
    let index: Int
    let value: ReviewTranslation
    var id: Int { index }
}

private struct ReviewProgressView: View {
    let value: Int
    var body: some View {
        let state = value < 1 ? 0 : value < 30 ? 1 : value < 60 ? 2 : 3
        HStack(spacing: 12) {
            VStack(spacing: 7) {
                HStack {
                    ForEach(["0%", "1%", "30%", "60%"], id: \.self) { label in
                        Text(label).frame(maxWidth: .infinity)
                    }
                }.font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary)
                HStack(spacing: 3) {
                    ForEach(1...3, id: \.self) { step in
                        RoundedRectangle(cornerRadius: 2).fill(state >= step ? LeximoryPalette.muted : LeximoryPalette.secondaryBorder).frame(height: 7)
                    }
                }.padding(.horizontal, 16)
            }
            Image(systemName: value == 100 ? "star.fill" : "star").foregroundStyle(.secondary)
        }.frame(maxWidth: 210).accessibilityElement(children: .ignore).accessibilityLabel("复习进度 \(value)%")
    }
}

private struct ReviewCat: View {
    let black: Bool
    let moving: Bool
    var body: some View {
        TimelineView(.animation(minimumInterval: 0.12, paused: !moving)) { timeline in
            let frames = black ? ReviewArtwork.blackFrames : CatFrames.frames
            let index = moving ? 3 + Int(timeline.date.timeIntervalSinceReferenceDate / 0.12) % 3 : 0
            if frames.indices.contains(index), let frame = frames[index] {
                Image(uiImage: frame).resizable().scaledToFit()
            }
        }.accessibilityHidden(true)
    }
}

private struct ReviewStorySheet: View {
    let document: ReadingDocument?
    let language: String
    let identity: String
    @State private var definition: DefinitionPresentation?
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Group {
                if let document {
                    ReadingTextView(document: document, language: language, textID: TextID(rawValue: identity), jumpToEnd: false, readOnly: true) { selection, note, _ in
                        if let note { definition = DefinitionPresentation(source: .article(selection), definition: note) }
                    }
                } else { ProgressView() }
            }.background(LeximoryPalette.paper)
                .navigationTitle("连词成文").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() }.accessibilityIdentifier("review-story-close") } }
                .sheet(item: $definition) { item in
                    DefinitionView(item: item, client: nil, language: language, isPopover: false)
                        .presentationDragIndicator(.visible)
                }
        }.presentationDetents([.large]).presentationDragIndicator(.visible).tint(.primary)
    }
}

@MainActor private enum ReviewArtwork {
    static let blackFrames = CatFrames.load("review-black-cat.webp")
    private static let day = UIImage(named: "lawn.png")
    private static let night = UIImage(named: "lawn-night.png")
    private static let portrait = UIImage(named: "lawn-portrait.png")
    static func lawn(dark: Bool, vertical: Bool) -> UIImage? {
        if !vertical { return dark ? night : day }
        if !dark { return portrait }
        guard let night, let pixels = night.cgImage else { return nil }
        return UIImage(cgImage: pixels, scale: night.scale, orientation: .right)
    }
}
