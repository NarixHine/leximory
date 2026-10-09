#!/bin/sh
set -eu
# Verify direct taps turn every requested page without animated sheets.
cd "$(dirname "$0")/.."
: "${EPUB_TEST_SIMULATOR:=1BBF4081-1196-45C6-9B5A-A4103BF44820}"
xcodebuild test -project Leximory.xcodeproj -scheme Leximory \
  -destination "platform=iOS Simulator,id=$EPUB_TEST_SIMULATOR" \
  -derivedDataPath /tmp/leximory-epub-tests -parallel-testing-enabled NO \
  -skipPackageUpdates ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO \
  '-only-testing:LeximoryTests/JapaneseEbookTests/tapsTurnPagesWithoutAnimatedSheets(rightToLeft:advancing:)'
