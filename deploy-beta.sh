#!/bin/bash
# deploy-beta.sh — Déploiement de tiktaalikbeta.haniju.fr via FTP
# Prérequis : lftp installé (brew install lftp)
#             fichier .env à la racine avec FTP_PASS=...
# Usage : ./deploy-beta.sh

set -e

# ── Config ────────────────────────────────────────────────────────────────
REMOTE_USER="hanijuf2"
REMOTE_HOST="frweb12.pulseheberg.net"
REMOTE_PATH="/tiktaalikbeta.haniju.fr/"
ALLOWED_BRANCHES=("dev" "feat/unified-color-picker")
# ──────────────────────────────────────────────────────────────────────────

echo ""
echo "🦎 Déploiement de tiktaalikbeta.haniju.fr (BETA)"
echo "════════════════════════════════════════════════"
echo ""

# 1. Vérifier la branche
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BRANCH_OK=false
for b in "${ALLOWED_BRANCHES[@]}"; do
  if [ "$CURRENT_BRANCH" = "$b" ]; then
    BRANCH_OK=true
    break
  fi
done

if [ "$BRANCH_OK" = false ]; then
  echo "❌ Branche actuelle : $CURRENT_BRANCH"
  echo "   Le deploy beta doit être lancé depuis : ${ALLOWED_BRANCHES[*]}"
  exit 1
fi
echo "✅ Branche : $CURRENT_BRANCH"

# 2. Charger le mot de passe depuis .env
if [ ! -f .env ]; then
  echo "❌ Fichier .env introuvable. Crée-le avec : FTP_PASS=ton_mot_de_passe"
  exit 1
fi
source .env

if [ -z "$FTP_PASS" ]; then
  echo "❌ FTP_PASS absent du .env"
  exit 1
fi

# 3. Build
echo "📦 Build en cours..."
npm run build
echo "✅ Build OK → dossier dist/ prêt"
echo ""

# 4. Confirmation
echo "📡 Destination : $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
read -p "   Continuer ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Déploiement annulé"
  exit 1
fi

# 5. Upload via lftp
echo ""
echo "🚀 Upload en cours..."
lftp -u "$REMOTE_USER","$FTP_PASS" "ftp://$REMOTE_HOST" << EOF
mirror -R --delete --verbose --exclude='.DS_Store' dist/ $REMOTE_PATH
quit
EOF

echo ""
echo "✅ Déploiement BETA terminé !"
echo "🕐 Déployé le $(date '+%Y-%m-%d à %H:%M:%S')"
echo "🌐 https://tiktaalikbeta.haniju.fr"
echo ""
