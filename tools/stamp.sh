#!/bin/bash
# Dopisuje do skryptow i stylu w index.html numer wersji (?v=...), zeby przegladarka po wdrozeniu pobierala nowe pliki.
# Uzycie przed commitem: bash tools/stamp.sh
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M%S)
sed -i '' -E "s#(src=\"js/[a-z0-9-]+\.js)(\?v=[0-9]+)?\"#\1?v=$V\"#g; s#(href=\"style\.css)(\?v=[0-9]+)?\"#\1?v=$V\"#" index.html
echo "wersja $V"
