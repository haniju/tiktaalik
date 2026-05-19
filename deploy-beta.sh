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
VITE_BETA=true npm run build
echo "✅ Build OK → dossier dist/ prêt"
echo ""

# 4. Calcul du diff avec le dernier deploy
MANIFEST=".last-deploy-beta.md5"
MANIFEST_NEW=$(mktemp)

# Générer les checksums du build actuel
(cd dist && find . -type f ! -name '.DS_Store' -exec md5 -r {} \;) | sort > "$MANIFEST_NEW"

FILES_TO_UPLOAD=()
FILES_TO_DELETE=()

if [ -f "$MANIFEST" ]; then
  # Fichiers nouveaux ou modifiés (checksum différent)
  while IFS= read -r line; do
    hash=$(echo "$line" | awk '{print $1}')
    file=$(echo "$line" | awk '{print $2}')
    old_hash=$(grep " ${file}$" "$MANIFEST" | awk '{print $1}')
    if [ "$hash" != "$old_hash" ]; then
      FILES_TO_UPLOAD+=("$file")
    fi
  done < "$MANIFEST_NEW"

  # Fichiers supprimés (présents dans l'ancien manifeste mais pas le nouveau)
  while IFS= read -r line; do
    file=$(echo "$line" | awk '{print $2}')
    if ! grep -q " ${file}$" "$MANIFEST_NEW"; then
      FILES_TO_DELETE+=("$file")
    fi
  done < "$MANIFEST"
else
  echo "   Premier deploy (pas de manifeste précédent) → upload complet"
  while IFS= read -r line; do
    file=$(echo "$line" | awk '{print $2}')
    FILES_TO_UPLOAD+=("$file")
  done < "$MANIFEST_NEW"
fi

TOTAL_CHANGES=$(( ${#FILES_TO_UPLOAD[@]} + ${#FILES_TO_DELETE[@]} ))

if [ "$TOTAL_CHANGES" -eq 0 ]; then
  echo ""
  echo "✅ Aucun changement détecté — rien à déployer."
  rm "$MANIFEST_NEW"
  exit 0
fi

echo ""
echo "📊 Changements détectés :"
echo "   📤 ${#FILES_TO_UPLOAD[@]} fichier(s) à envoyer"
echo "   🗑  ${#FILES_TO_DELETE[@]} fichier(s) à supprimer"

# 5. Confirmation
echo ""
echo "📡 Destination : $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
read -p "   Continuer ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Déploiement annulé"
  rm "$MANIFEST_NEW"
  exit 1
fi

# 6. Upload incrémental via lftp
echo ""
echo "🚀 Upload en cours..."

LFTP_CMDS=""

# Créer les répertoires nécessaires et uploader les fichiers
for f in "${FILES_TO_UPLOAD[@]}"; do
  remote_dir=$(dirname "${REMOTE_PATH}${f#./}")
  LFTP_CMDS+="mkdir -p $remote_dir
"
  LFTP_CMDS+="put dist/${f#./} -o ${REMOTE_PATH}${f#./}
"
  echo "   📤 ${f#./}"
done

# Supprimer les fichiers obsolètes
for f in "${FILES_TO_DELETE[@]}"; do
  LFTP_CMDS+="rm -f ${REMOTE_PATH}${f#./}
"
  echo "   🗑  ${f#./}"
done

lftp -u "$REMOTE_USER","$FTP_PASS" "ftp://$REMOTE_HOST" << EOF
$LFTP_CMDS
quit
EOF

# 7. Sauvegarder le manifeste pour le prochain deploy
mv "$MANIFEST_NEW" "$MANIFEST"

echo ""
echo "✅ Déploiement BETA terminé ! ($TOTAL_CHANGES fichier(s) traité(s))"
echo "🕐 Déployé le $(date '+%Y-%m-%d à %H:%M:%S')"
echo "🌐 https://tiktaalikbeta.haniju.fr"
echo ""
