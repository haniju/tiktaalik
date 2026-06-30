// Capture l'événement beforeinstallprompt le plus tôt possible.
// Chrome peut l'émettre AVANT que React (et HomeScreen) ne soit monté, ou alors
// que l'utilisateur est sur une route /sketch — un listener posé dans un useEffect
// de HomeScreen raterait l'événement, qui ne refire jamais ensuite.
// Ce module attache le listener au niveau global, dès son évaluation (import dans main.tsx),
// et mémorise l'événement pour que HomeScreen puisse le consommer quand il le souhaite.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

function notify() {
  listeners.forEach(fn => fn(deferredPrompt));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  // App installée → l'événement est consommé, plus de bouton à afficher
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Retourne l'événement capturé (ou null s'il n'a pas encore été émis / déjà consommé). */
export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/** À appeler après prompt() pour éviter de réutiliser un événement périmé. */
export function clearInstallPrompt(): void {
  deferredPrompt = null;
  notify();
}

/** S'abonner aux changements d'état. Retourne une fonction de désabonnement. */
export function subscribeInstallPrompt(fn: (e: BeforeInstallPromptEvent | null) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
