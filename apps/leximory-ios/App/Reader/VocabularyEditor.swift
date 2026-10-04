import SwiftUI
import UIKit
import LeximoryCore

struct VocabularyEditor: View {
    let id: String
    let client: MobileClient
    let language: String
    let updated: (SavedWord) -> Void
    let cancel: () -> Void
    @State private var fields: VocabularyFields?
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?
    @FocusState private var focusedField: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let fields {
                field("词条", value: binding(\.lemma), lines: 1...3)
                field("释义", value: binding(\.definition), lines: 3...12)
                if fields.etymology != nil { field("语源", value: optionalBinding(\.etymology), lines: 2...8) }
                if fields.cognates != nil { field("同源词", value: optionalBinding(\.cognates), lines: 2...8) }
                HStack(spacing: 12) {
                    Button {
                        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                        focusedField = nil
                        Task { await save() }
                    } label: {
                        Group {
                            if saving { ProgressView().tint(LeximoryPalette.paper) }
                            else { Image(systemName: "checkmark.circle").font(.system(size: 22)) }
                        }.frame(width: 48, height: 48).foregroundStyle(LeximoryPalette.paper)
                            .background(LeximoryPalette.sage, in: Circle())
                    }.buttonStyle(.plain).disabled(saving || !fields.isValid).accessibilityLabel("保存修改")
                    Button("取消", systemImage: "xmark.circle", action: cancel)
                        .labelStyle(.iconOnly).frame(width: 44, height: 44).disabled(saving)
                }
            } else if loading { ProgressView("正在加载……").frame(maxWidth: .infinity, minHeight: 180) }
            if let error { Text(error).font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.muted) }
            if fields == nil && !loading { Button("重试") { Task { await load() } } }
        }.disabled(loading || saving)
            .task(id: id) { await load() }
    }
    private func binding(_ key: WritableKeyPath<VocabularyFields, String>) -> Binding<String> {
        Binding(get: { fields?[keyPath: key] ?? "" }, set: { fields?[keyPath: key] = $0 })
    }
    private func optionalBinding(_ key: WritableKeyPath<VocabularyFields, String?>) -> Binding<String> {
        Binding(get: { fields?[keyPath: key] ?? "" }, set: { fields?[keyPath: key] = $0 })
    }
    private func field(_ label: String, value: Binding<String>, lines: ClosedRange<Int>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(LeximoryTypography.interface(15)).foregroundStyle(LeximoryPalette.illustration)
            Group {
                if label == "词条" { TextField(label, text: value) }
                else { TextField(label, text: value, axis: .vertical).lineLimit(lines) }
            }
                .focused($focusedField, equals: label)
                .submitLabel(label == "词条" ? .done : .return)
                .onSubmit { if label == "词条" { focusedField = nil } }
                .font(LeximoryTypography.prose(18, language: language)).lineSpacing(4)
                .padding(12).background(LeximoryPalette.paper, in: RoundedRectangle(cornerRadius: 16))
                .accessibilityIdentifier("edit-\(label)")
        }
    }
    private func load() async {
        loading = true; error = nil
        defer { loading = false }
        do { fields = try await client.savedWord(id: id).fields }
        catch { if !Task.isCancelled { self.error = "暂时无法加载，请重试。" } }
    }
    private func save() async {
        guard let fields, fields.isValid else { return }
        saving = true; error = nil
        defer { saving = false }
        do { updated(try await client.editWord(id: id, fields: fields)) }
        catch { self.error = (MobileClient.cause(of: error) as? MobileFailure)?.error.message ?? "未能确认保存结果，请重新打开词条查看。" }
    }
}
