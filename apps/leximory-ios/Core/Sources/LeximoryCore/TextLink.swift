import Foundation

public enum TextLink {
    public static func textID(from url: URL, webURL: URL) -> TextID? {
        let parts: [String]
        if url.scheme == "leximory", let host = url.host {
            parts = [host] + url.path.split(separator: "/").map(String.init)
        } else if url.scheme == webURL.scheme, url.host == webURL.host, url.port == webURL.port {
            parts = url.path.split(separator: "/").map(String.init)
        } else { return nil }
        let id: String
        if parts.count == 2, parts[0] == "read" { id = parts[1] }
        else if parts.count == 3, parts[0] == "library" { id = parts[2] }
        else { return nil }
        guard !id.isEmpty, id.count <= 128, id.utf8.allSatisfy({ (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 45 || $0 == 95 }) else { return nil }
        return TextID(rawValue: id)
    }
}
