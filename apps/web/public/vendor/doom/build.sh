#!/bin/sh
# Builds doom.js and doom.wasm (DOOM for the arcade) from doomgeneric at the commit SOURCE.md names, with Ghosty's
# platform file (doomgeneric_ghosty.c) and the patches in patches/, using Debian's Emscripten 3.1.6.
#   sh build.sh /path/to/doomgeneric          (a clone of https://github.com/ozkl/doomgeneric)
# The clone is only read: its sources are copied to a scratch directory, patched there and compiled.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
src=${1:?usage: sh build.sh /path/to/doomgeneric}
want=e257a09527062bfb986b6e5e0780839b6cbd5b71
# The clone's commit, read from its .git directory (no tools needed): it must be the one named above, unchanged.
head=$(cat "$src/.git/HEAD")
case $head in
  ref:*) ref=${head#ref: }; have=$(cat "$src/.git/$ref" 2>/dev/null || sed -n "s| $ref\$||p" "$src/.git/packed-refs") ;;
  *) have=$head ;;
esac
[ "$have" = "$want" ] || { echo "doomgeneric is at $have, not $want" >&2; exit 1; }
emcc --version | head -1 | grep -q ' 3\.1\.6 ' || echo "note: this build was made with Emscripten 3.1.6; yours is $(emcc --version | head -1)" >&2

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/doomgeneric"
cp "$src"/doomgeneric/*.c "$src"/doomgeneric/*.h "$work/doomgeneric/"
for p in "$here"/patches/*.diff; do patch -s -d "$work" -p1 < "$p"; done
cp "$here/doomgeneric_ghosty.c" "$work/doomgeneric/"

# The engine, as doomgeneric's own Emscripten makefile lists it, less its SDL platform, sound and music files.
SRC="dummy am_map doomdef doomstat dstrings d_event d_items d_iwad d_loop d_main d_mode d_net f_finale f_wipe g_game
hu_lib hu_stuff info i_cdmus i_endoom i_joystick i_scale i_sound i_system i_timer memio m_argv m_bbox m_cheat m_config
m_controls m_fixed m_menu m_misc m_random p_ceilng p_doors p_enemy p_floor p_inter p_lights p_map p_maputl p_mobj p_plats
p_pspr p_saveg p_setup p_sight p_spec p_switch p_telept p_tick p_user r_bsp r_data r_draw r_main r_plane r_segs r_sky
r_things sha1 sounds statdump st_lib st_stuff s_sound tables v_video wi_stuff w_checksum w_file w_main w_wad z_zone
w_file_stdc i_input i_video doomgeneric doomgeneric_ghosty"

cd "$work/doomgeneric"
objs=""
for f in $SRC; do
  # the 1993 code's many warnings are its own; the link below shows any real trouble
  emcc -O2 -w -DFEATURE_SOUND -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200 -c "$f.c" -o "$f.o"
  objs="$objs $f.o"
done
# The page starts the engine with dg_create (no main: this Emscripten and its compiler disagree on main's name).
# shellcheck disable=SC2086
emcc -O2 $objs --no-entry \
  -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=GhostyDoom -s ENVIRONMENT=web \
  -s EXIT_RUNTIME=0 -s FORCE_FILESYSTEM=1 -s DYNAMIC_EXECUTION=0 \
  -s INITIAL_MEMORY=67108864 -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS=_malloc -s EXPORTED_RUNTIME_METHODS=FS \
  -o "$work/doom.js"
cp "$work/doom.js" "$work/doom.wasm" "$here/"
echo "built $here/doom.js ($(wc -c < "$here/doom.js") bytes) and doom.wasm ($(wc -c < "$here/doom.wasm") bytes)"
