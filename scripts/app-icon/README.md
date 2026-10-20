# App icon

`source/app-icon.png` (1024 px) and `source/app-icon.icns` are generated from
`icon.html`, which places `source/logo-transparent.png` on a macOS-style body:
1024 px canvas, 824 px continuous-corner squircle with 100 px margins, drop shadow
0/12/28 px at 50 % black, dark background with a red glow behind the logo.

To regenerate after changing the logo or the template:

1. Open `icon.html?v=glow` in Chrome with a 1024×1024 window and save a
   transparent screenshot as `source/app-icon.png` (any headless-Chrome screenshot
   with `omitBackground` works). Variants `grid` and `metal` are also available.
2. Build the `.icns`:

   ```bash
   ISET=$(mktemp -d)/app-icon.iconset && mkdir -p "$ISET"
   for s in 16 32 128 256 512; do
     sips -z $s $s source/app-icon.png --out "$ISET/icon_${s}x${s}.png"
     sips -z $((s*2)) $((s*2)) source/app-icon.png --out "$ISET/icon_${s}x${s}@2x.png"
   done
   iconutil -c icns "$ISET" -o source/app-icon.icns
   ```

`scripts/build-desktop.sh` copies both files into `frontend/build/` on every build.
