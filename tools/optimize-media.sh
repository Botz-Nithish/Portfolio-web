#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# optimize-media.sh - crunch raw project recordings into web-ready MP4s.
#
# 1. Drop your raw recordings into  assets/projects/raw/  named after the
#    project slug, e.g.  zingbot.mp4  wms.mov  vmeet.mkv
#    (valid slugs: zingbot wms pixelpipe vmeet neurorythm scholar kallos finsol)
# 2. Run:  bash tools/optimize-media.sh
# 3. Optimized files land at  assets/projects/<slug>.mp4
#
# Then point the project at it in js/gallery.js:
#     media: "assets/projects/<slug>.mp4", poster: "assets/projects/<slug>.svg"
#
# Tunables (env vars):  CRF=27  MAXW=1280  FPS=30
#   lower CRF = higher quality + bigger file (try 23–30)
#
# Audio is dropped entirely (the `-an` flag below) so every output is silent -
# the gallery autoplays these on loop, where sound would be unwanted anyway.
# ---------------------------------------------------------------------------
set -euo pipefail

# resolve repo root (this script lives in <root>/tools/)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW="$ROOT/assets/projects/raw"
OUT="$ROOT/assets/projects"

CRF="${CRF:-27}"
MAXW="${MAXW:-1280}"
FPS="${FPS:-30}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg not found on PATH. Install it (winget install Gyan.FFmpeg) and retry." >&2
  exit 1
fi

mkdir -p "$RAW"

shopt -s nullglob nocaseglob
inputs=("$RAW"/*.mp4 "$RAW"/*.mov "$RAW"/*.mkv "$RAW"/*.webm "$RAW"/*.m4v)
shopt -u nocaseglob

if [ ${#inputs[@]} -eq 0 ]; then
  echo "No raw videos found in: $RAW"
  echo "Drop recordings there named <slug>.mp4 (e.g. zingbot.mp4) and re-run."
  exit 0
fi

human () { # bytes -> human readable
  local b=$1
  if   [ "$b" -ge 1048576 ]; then awk "BEGIN{printf \"%.1f MB\", $b/1048576}"
  elif [ "$b" -ge 1024 ];    then awk "BEGIN{printf \"%.0f KB\", $b/1024}"
  else echo "${b} B"; fi
}

printf "%-14s %10s  ->  %-10s %8s\n" "PROJECT" "IN" "OUT" "DUR"
printf '%.0s-' {1..52}; echo

total_in=0; total_out=0; count=0
for in in "${inputs[@]}"; do
  slug="$(basename "$in")"; slug="${slug%.*}"
  out="$OUT/$slug.mp4"

  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in" 2>/dev/null || echo "?")"
  dur="$(awk "BEGIN{printf \"%.1fs\", ${dur:-0}}" 2>/dev/null || echo "?")"

  # -an = strip the audio track completely (silent / muted output)
  ffmpeg -y -loglevel error -i "$in" \
    -vf "scale='min(${MAXW},iw)':-2:flags=lanczos,fps=${FPS}" \
    -an -c:v libx264 -profile:v high -pix_fmt yuv420p -crf "${CRF}" -preset slow \
    -movflags +faststart \
    "$out"

  in_b=$(stat -c%s "$in" 2>/dev/null || stat -f%z "$in")
  out_b=$(stat -c%s "$out" 2>/dev/null || stat -f%z "$out")
  total_in=$((total_in + in_b)); total_out=$((total_out + out_b)); count=$((count + 1))

  printf "%-14s %10s  ->  %-10s %8s\n" "$slug" "$(human "$in_b")" "$(human "$out_b")" "$dur"
done

printf '%.0s-' {1..52}; echo
echo "Done: $count file(s).  $(human "$total_in")  ->  $(human "$total_out")"
echo
echo "Next: in js/gallery.js, for each project set"
echo '   media: "assets/projects/<slug>.mp4", poster: "assets/projects/<slug>.svg"'
echo "(the SVG stays on the sphere tile; the MP4 plays on the project page)"
