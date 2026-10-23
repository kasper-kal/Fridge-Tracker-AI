# Environment for the browser audits.
#
# This VM has no system Chromium libraries and no fonts, and installing them
# needs root. scripts/audit/setup-browser.sh unpacks the missing .deb files into
# /tmp/pwlibs instead, so the launcher is pointed at them here.
#
# Everything is optional: on a machine that has the libraries, sourcing this
# file changes nothing.

export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1

if [ -d /tmp/pwlibs/root/usr/lib/x86_64-linux-gnu ]; then
  export LD_LIBRARY_PATH="/tmp/pwlibs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

if [ -f /tmp/pwlibs/root/etc/fonts/fonts.conf ]; then
  export FONTCONFIG_FILE=/tmp/pwlibs/root/etc/fonts/fonts.conf
fi
