#!/usr/bin/env bash
# Gera a build web-mobile do Cocos, valida e cria o zip de release.
# Uso: scripts/build-release.sh [versao]   (ex.: scripts/build-release.sh v1.0.0)
# Com versao: tambem cria a tag local (o push da tag aciona .github/workflows/release.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/PlayableAd"
BUILD="$PROJECT/build/web-mobile"
COCOS="${COCOS_CREATOR:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
VERSION="${1:-}"
ZIP="$PROJECT/build/merge-merge-merge-web-mobile${VERSION:+-$VERSION}.zip"

[ -x "$COCOS" ] || { echo "Cocos Creator nao encontrado em $COCOS (defina COCOS_CREATOR)"; exit 1; }

echo "==> Build Cocos (web-mobile, release)"
LOG="$(mktemp)"
# O Cocos costuma sair com codigo != 0 mesmo com sucesso (ex.: 36): valida pelo log e pelos arquivos.
"$COCOS" --project "$PROJECT" --build "platform=web-mobile;debug=false" >"$LOG" 2>&1 || true
grep -q "build Task (web-mobile) Finished" "$LOG" || { echo "Build falhou. Log: $LOG"; tail -20 "$LOG"; exit 1; }
[ -f "$BUILD/index.html" ] || { echo "index.html ausente em $BUILD"; exit 1; }
grep -q "poki-sdk\|poki.com" "$BUILD/index.html" || { echo "Poki SDK ausente no index.html"; exit 1; }

echo "==> Zip"
rm -f "$ZIP"
(cd "$BUILD" && zip -qr -X "$ZIP" . -x "*.DS_Store")
echo "    $ZIP ($(du -h "$ZIP" | cut -f1))"

if [ -n "$VERSION" ]; then
  echo "==> Tag $VERSION (local)"
  git -C "$ROOT" tag "$VERSION"
  echo "    Para publicar: git add -A && git commit && git push origin main && git push origin $VERSION"
fi
echo "Pronto."
