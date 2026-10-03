# Reader offset feasibility checks

These Swift Testing tests exercise Foundation string offsets. They do not implement a reader or verify iOS selection, ruby, or audio. Run on a compatible Swift 6.2+ toolchain:

```sh
swift test --package-path docs/native-ios/probes
```

Full Xcode 27 is now installed and the native app builds and tests normally. Use the normal command above with Xcode's Swift toolchain. The workaround below records the earlier Command Line Tools issue; it is no longer needed for the native app.

The earlier Command Line Tools installation combined Swift 6.4 public PackageDescription interfaces with older private interfaces. That broke manifest compilation. Its incremental build also needed the Testing macro plugin loaded explicitly. The review passed all five tests with the temporary-copy workaround below. It did not modify the installed toolchain.

From the repository root:

```sh
leximory_probe_libs=$(mktemp -d /tmp/leximory-swift-libs.XXXXXX)
cp -R /Library/Developer/CommandLineTools/usr/lib/swift/pm/ManifestAPI "$leximory_probe_libs/ManifestAPI"
rm "$leximory_probe_libs/ManifestAPI/PackageDescription.swiftmodule/arm64-apple-macos.private.swiftinterface" \
   "$leximory_probe_libs/ManifestAPI/PackageDescription.swiftmodule/x86_64-apple-macos.private.swiftinterface"
SWIFTPM_CUSTOM_LIBS_DIR="$leximory_probe_libs" \
SWIFTPM_MODULECACHE_OVERRIDE="$leximory_probe_libs/module-cache" \
swift test --package-path docs/native-ios/probes --manifest-cache none --build-system swiftbuild \
  -Xswiftc -load-plugin-library \
  -Xswiftc /Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing/libTestingMacros.dylib
```

Use this workaround only for the affected installation. A repaired toolchain should use the normal command.
