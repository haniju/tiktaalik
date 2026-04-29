#!/bin/bash
# deploy.sh — Déploiement de tiktaalik.haniju.fr via FTP
# Prérequis : lftp installé (brew install lftp)
#             fichier .env à la racine avec FTP_PASS=...
# Usage : ./deploy.sh

set -e

# ── Config ────────────────────────────────────────────────────────────────
REMOTE_USER="hanijuf2"
REMOTE_HOST="frweb12.pulseheberg.net"
REMOTE_PATH="/tiktaalik.haniju.fr/"
# ──────────────────────────────────────────────────────────────────────────

echo ""
echo "🦎 Déploiement de tiktaalik.haniju.fr (STABLE)"
echo "═══════════════════════════════════════════════"
echo ""

# 1. Vérifier la branche
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ Branche actuelle : $CURRENT_BRANCH"
  echo "   Le deploy stable doit être lancé depuis : main"
  exit 1
fi
echo "✅ Branche : main"

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
echo "✅ Déploiement terminé !"
echo "🕐 Déployé le $(date '+%Y-%m-%d à %H:%M:%S')"
echo "🌐 https://tiktaalik.haniju.fr"
echo ""
