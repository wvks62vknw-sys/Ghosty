#!/bin/sh
# Builds quake.js (Quake for the arcade) from WebQuake at the commit SOURCE.md names: a copy of its Client folder,
# patched with patches/*.diff, bundled with Ghosty's platform file ghosty.js by bundle.mjs (plain Node, no packages).
#   sh build.sh /path/to/webquake          (a clone of https://github.com/Triang3l/webquake)
# The clone is only read: its files are copied to a scratch directory and patched there.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
src=${1:?usage: sh build.sh /path/to/webquake}
want=917617ffdfe42fa9dca41bf1762f16a2e71f2d7b
# The clone's commit, read from its .git directory (no tools needed): it must be the one named above, unchanged.
head=$(cat "$src/.git/HEAD")
case $head in
  ref:*) ref=${head#ref: }; have=$(cat "$src/.git/$ref" 2>/dev/null || sed -n "s| $ref\$||p" "$src/.git/packed-refs") ;;
  *) have=$head ;;
esac
[ "$have" = "$want" ] || { echo "webquake is at $have, not $want" >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -R "$src/Client" "$work/Client"
for p in "$here"/patches/*.diff; do patch -s -d "$work" -p1 < "$p"; done
node "$here/bundle.mjs" "$work/Client" "$here/ghosty.js" "$here/quake.js"
echo "built $here/quake.js ($(wc -c < "$here/quake.js") bytes)"
