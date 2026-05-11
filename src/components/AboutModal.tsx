const APP_VERSION = __APP_VERSION__;
const BUILD_TIME = __BUILD_TIME__;

interface Props {
  onClose: () => void;
}

const FEATURES: { category: string; items: string[] }[] = [
  {
    category: 'Galerie',
    items: [
      'Grille 2 colonnes avec vignettes A4',
      'Cr\u00e9ation de dessins',
      'S\u00e9lection multiple (long-press + tap)',
      'Drag-to-reorder avec ghost flottant',
      'Renommage et suppression',
      'Ordre personnalis\u00e9 persist\u00e9',
      'Installation PWA',
    ],
  },
  {
    category: 'Outils de dessin',
    items: [
      'Stylo avec lissage configurable',
      'Marqueur semi-transparent',
      'A\u00e9rographe (gradient radial, opacit\u00e9 centre/bord)',
      'Gomme avec auto-dissolve des groupes',
      'Outil texte multi-bo\u00eetes',
    ],
  },
  {
    category: 'Couleur',
    items: [
      'Palettes unifi\u00e9es (dessin, fond, texte)',
      'S\u00e9lecteur HSL avec pr\u00e9visualisation hex',
      'Fond canvas par dessin',
    ],
  },
  {
    category: 'Canvas',
    items: [
      'Zoom 10\u2013400% avec slider et boutons',
      'Monde navigable 3\u00d73 pages A4',
      'Pinch-to-zoom (d\u00e9sactivable)',
      'Mode pan (toggle + hold-to-pan)',
      'Undo / Redo',
    ],
  },
  {
    category: 'S\u00e9lection & manipulation',
    items: [
      'Lasso rectangulaire + tap-to-select',
      'S\u00e9lection \u00e0 deux niveaux (s\u00e9lection / focus)',
      'D\u00e9placement par drag',
      'Redimensionnement proportionnel (scale)',
      'Rotation libre',
      'S\u00e9lection panel avec pr\u00e9visualisations',
    ],
  },
  {
    category: 'Groupes',
    items: [
      'Groupement et d\u00e9groupement',
      'Groupes imbriqu\u00e9s (hi\u00e9rarchie)',
      'S\u00e9lection atomique de groupe',
      'Auto-dissolve des groupes < 2 membres',
    ],
  },
  {
    category: 'Texte',
    items: [
      'Bo\u00eetes de texte repositionnables',
      'Polices, taille, gras, italique, soulign\u00e9, alignement',
      'Duplication de bo\u00eete de texte',
      'Redimensionnement horizontal',
      'Rotation cumulative',
    ],
  },
  {
    category: 'Export & sauvegarde',
    items: [
      'Export SVG vectoriel complet',
      'Auto-save (debounce 4s + save imm\u00e9diat)',
      'Persistance de tous les r\u00e9glages outils',
    ],
  },
  {
    category: 'Boutons physiques',
    items: [
      'D\u00e9tection et mapping de boutons hardware',
      'Hold-to-pan sur boutons physiques',
    ],
  },
  {
    category: 'Mobile & PWA',
    items: [
      'Optimisations tactiles (guards, viewport)',
      'Mode PWA standalone',
      'Prompt d\u2019installation',
    ],
  },
];

export function AboutModal({ onClose }: Props) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.titleRow}>
              <span style={styles.title}>Tiktaalik</span>
              <span style={styles.badge}>BETA</span>
            </div>
            <div style={styles.version}>v{APP_VERSION}</div>
            <div style={styles.buildDate}>Build {BUILD_TIME}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div style={styles.divider} />

        {/* Description */}
        <p style={styles.description}>
          Carnet de croquis mobile-first. Dessinez, annotez et organisez vos
          cr\u00e9ations directement depuis votre navigateur.
        </p>

        {/* Features */}
        <div style={styles.featuresTitle}>Fonctionnalit\u00e9s</div>
        {FEATURES.map(group => (
          <div key={group.category} style={styles.featureGroup}>
            <div style={styles.categoryTitle}>{group.category}</div>
            <ul style={styles.featureList}>
              {group.items.map(item => (
                <li key={item} style={styles.featureItem}>{item}</li>
              ))}
            </ul>
          </div>
        ))}

        <div style={styles.divider} />

        {/* Footer */}
        <button style={styles.closeAction} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: '#fff', borderRadius: 16, width: '90%', maxWidth: 400,
    maxHeight: '80vh', overflowY: 'auto',
    boxShadow: '0 8px 40px rgba(0,0,0,0.25)', padding: 20,
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  titleRow: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#1a1a1a' },
  badge: {
    fontSize: 10, fontWeight: 700, color: '#fff', background: '#e63946',
    borderRadius: 6, padding: '2px 6px', letterSpacing: 0.5,
  },
  version: { fontSize: 14, fontWeight: 600, color: '#118ab2', marginTop: 2 },
  buildDate: { fontSize: 12, color: '#999', marginTop: 2 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 24, color: '#999',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  divider: {
    height: 1, background: '#e8e8e8', margin: '16px 0',
  },
  description: {
    fontSize: 14, color: '#555', lineHeight: 1.5, margin: '0 0 16px',
  },
  featuresTitle: {
    fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 12,
  },
  featureGroup: { marginBottom: 12 },
  categoryTitle: {
    fontSize: 13, fontWeight: 600, color: '#118ab2', marginBottom: 4,
  },
  featureList: {
    margin: 0, paddingLeft: 18, listStyleType: 'disc',
  },
  featureItem: {
    fontSize: 13, color: '#444', lineHeight: 1.6,
  },
  closeAction: {
    display: 'block', width: '100%', padding: '10px 16px', fontSize: 15,
    fontWeight: 600, color: '#fff', background: '#118ab2', border: 'none',
    borderRadius: 10, cursor: 'pointer',
  },
};
