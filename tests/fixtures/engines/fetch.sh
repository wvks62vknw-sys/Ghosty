#!/bin/sh
# Fetches the free game data tests/engines.spec.mjs plays, into tests/fixtures/engines/data/ (never committed): the
# same packages, mirrors, sizes and SHA-256 checksums as apps/web/src/arcade/shelf.ts (apps/edge/test/engines.test.mjs
# holds the two lists to each other). A file already there with the right checksum is kept.
#   sh tests/fixtures/engines/fetch.sh
set -eu

out="$(cd "$(dirname "$0")" && pwd)/data"
mkdir -p "$out"

get() { # file sha256 bytes url...
  file=$1 sum=$2 bytes=$3
  shift 3
  if [ -f "$out/$file" ] && [ "$(sha256sum "$out/$file" | cut -d' ' -f1)" = "$sum" ]; then
    echo "have $file"
    return 0
  fi
  for url in "$@"; do
    if curl -fsSL --retry 2 --max-filesize "$bytes" -o "$out/$file.part" "$url" &&
      [ "$(wc -c < "$out/$file.part")" -eq "$bytes" ] &&
      [ "$(sha256sum "$out/$file.part" | cut -d' ' -f1)" = "$sum" ]; then
      mv "$out/$file.part" "$out/$file"
      echo "got $file ($bytes bytes) from $url"
      return 0
    fi
    echo "no good copy of $file from $url" >&2
  done
  rm -f "$out/$file.part"
  return 1
}

# Freedoom 0.13.0 (BSD): both phases
get freedoom-0.13.0.zip 3f9b264f3e3ce503b4fb7f6bdcb1f419d93c7b546f4df3e874dd878db9688f59 24143781 \
  https://archive.org/cors/freedoom-0.13.0/freedoom-0.13.0.zip
# DOOM 1.9 shareware (id Software's terms: the unmodified package may be passed on)
get doom19s.zip cacf0142b31ca1af00796b4a0339e07992ac5f21bc3f81e7532fe1b5e1b486e6 2450688 \
  https://archive.org/cors/doom19s_202607/doom19s.zip \
  https://archive.org/cors/Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip
# Quake 1.06 shareware (id Software's shareware licence: passed on whole)
get msdos_Quake106_shareware.zip 920f4609801d0bdbea5b6738cec49da846df4ff8ce0d46c901ea080dd4437833 9050608 \
  https://archive.org/cors/msdos_Quake106_shareware/msdos_Quake106_shareware.zip \
  https://archive.org/cors/msdos_Quake106_shareware_201702/msdos_Quake106_shareware.zip
