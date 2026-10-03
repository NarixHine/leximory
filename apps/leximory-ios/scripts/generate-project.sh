#!/bin/bash
set -euo pipefail
app_dir="$(cd "$(dirname "$0")/.." && pwd)"
tool_dir="$app_dir/.tools"
tool="$tool_dir/xcodegen/bin/xcodegen"
if [[ ! -x "$tool" ]]; then
    mkdir -p "$tool_dir"
    curl --fail --location --silent --show-error \
        https://github.com/yonaskolb/XcodeGen/releases/download/2.44.1/xcodegen.zip \
        -o "$tool_dir/xcodegen.zip"
    echo 'a2e905fb68446e9bb4008cdfe2e13e3f176d0cbcca828b71770f8e53fca91b73  '"$tool_dir/xcodegen.zip" | shasum -a 256 -c -
    unzip -q "$tool_dir/xcodegen.zip" -d "$tool_dir"
fi
[[ "$($tool --version)" == 'Version: 2.44.1' ]]
"$tool" generate --spec "$app_dir/project.yml"
