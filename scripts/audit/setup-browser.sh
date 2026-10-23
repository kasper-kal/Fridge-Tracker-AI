#!/usr/bin/env bash
# One-time setup for the browser audits on a machine that has no root.
#
#   bash scripts/audit/setup-browser.sh
#
# What it does, and why each step is needed here:
#   1. Playwright is deliberately NOT a workspace dependency (it is 300 MB of
#      browser and not needed to build or run the app), so it is installed into
#      node_modules_pw_tmp and found through PLAYWRIGHT_PATH.
#   2. The Chromium binary is downloaded into ~/.cache/ms-playwright.
#   3. This VM has none of Chromium's shared libraries and no package manager
#      access as root, so the .deb files are unpacked into /tmp/pwlibs and the
#      launcher is pointed at them by scripts/audit/env.sh.
#   4. It also has no fonts at all, which changes text metrics and makes layout
#      measurements meaningless, so DejaVu Sans and Liberation are unpacked and
#      a fontconfig file points at them.
#
# /tmp is not persistent: after a restore, run this again.
set -euo pipefail
cd "$(dirname "$0")/../.." || exit 2

echo "== workspace dependencies =="
if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile
else
  echo "already installed"
fi

echo "== playwright =="
mkdir -p node_modules_pw_tmp
if [ ! -d node_modules_pw_tmp/node_modules/playwright ]; then
  (cd node_modules_pw_tmp && npm init -y >/dev/null 2>&1 && npm i playwright@1.56.1)
else
  echo "already installed"
fi
node_modules_pw_tmp/node_modules/.bin/playwright install chromium

echo "== chromium libraries and fonts (no root) =="
LIBS=/tmp/pwlibs
mkdir -p "$LIBS/debs" "$LIBS/root" "$LIBS/fontcache" "$LIBS/apt/lists/partial" "$LIBS/apt/cache"
if [ ! -d "$LIBS/root/usr/lib/x86_64-linux-gnu" ] || [ ! -d "$LIBS/root/usr/share/fonts" ]; then
  apt-get -o Dir::State::lists="$LIBS/apt/lists" -o Dir::Cache="$LIBS/apt/cache" update >/dev/null
  (cd "$LIBS/debs" && apt-get \
    -o Dir::State::lists="$LIBS/apt/lists" \
    -o Dir::Cache="$LIBS/apt/cache" \
    download \
    libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libxkbcommon0 \
    libatspi2.0-0t64 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libcairo2 \
    libpango-1.0-0 libasound2t64 libgbm1 libdrm2 libxshmfence1 libx11-6 libxcb1 \
    libxext6 libxrender1 libxi6 libxtst6 libegl1 libglvnd0 libglx0 libopengl0 \
    libxcb-dri3-0 libpangoft2-1.0-0 fonts-dejavu-core fonts-liberation)
  for package in "$LIBS"/debs/*.deb; do
    dpkg-deb -x "$package" "$LIBS/root"
  done
else
  echo "already unpacked"
fi

mkdir -p "$LIBS/root/etc/fonts"
cat > "$LIBS/root/etc/fonts/fonts.conf" <<'XML'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/pwlibs/root/usr/share/fonts</dir>
  <dir>/usr/share/fonts</dir>
  <cachedir>/tmp/pwlibs/fontcache</cachedir>
  <match target="pattern">
    <test qual="any" name="family"><string>sans-serif</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DejaVu Sans</string></edit>
  </match>
</fontconfig>
XML

echo "== check =="
# shellcheck source=scripts/audit/env.sh
. scripts/audit/env.sh
node -e '
const { chromium } = require("./node_modules_pw_tmp/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setContent("<p style=\"font-family:sans-serif\">fonts</p>");
  console.log("chromium launched, text width:", await page.evaluate(() => document.querySelector("p").getBoundingClientRect().width));
  await browser.close();
})().catch((error) => { console.error("launch failed:", error.message.split("\n")[0]); process.exit(1); });
'
echo "ready: bash scripts/audit/run.sh"
