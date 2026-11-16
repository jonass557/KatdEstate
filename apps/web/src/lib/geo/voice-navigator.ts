/**
 * Système de guidage vocal pour la navigation GPS DOMORA.
 * Utilise l'API standard Web Speech API du navigateur (compatible Chrome, Safari iOS, Firefox, Android).
 */
export class VoiceNavigator {
  private isMuted = false;
  private lastSpokenText = '';
  private lastSpokenTime = 0;
  private minIntervalMs = 4000; // Anti-répétition : minimum 4s entre deux instructions

  constructor(initialMuted = false) {
    this.isMuted = initialMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public isVoiceMuted(): boolean {
    return this.isMuted;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Émet une consigne vocale naturelle si le guidage vocal n'est pas muet.
   * Empêche les répétitions superflues de la même phrase.
   */
  public speak(text: string, force = false): void {
    if (this.isMuted || !this.isSupported()) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    const now = Date.now();
    // Éviter de répéter exactement la même consigne en moins de 10 secondes, sauf si force=true
    if (!force && cleanText === this.lastSpokenText && now - this.lastSpokenTime < 10000) {
      return;
    }

    // Éviter le chevauchement si une phrase a été dite il y a moins de minIntervalMs
    if (!force && now - this.lastSpokenTime < this.minIntervalMs) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stoppe la phrase précédente avant la nouvelle

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.05; // Légèrement dynamique pour le guidage routier
      utterance.pitch = 1.0;

      // Sélectionner si possible une voix française naturelle
      const voices = window.speechSynthesis.getVoices();
      const frVoice =
        voices.find((v) => v.lang.startsWith('fr') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Audrey') || v.name.includes('Thomas'))) ||
        voices.find((v) => v.lang.startsWith('fr'));
      if (frVoice) {
        utterance.voice = frVoice;
      }

      utterance.onend = () => {
        this.lastSpokenTime = Date.now();
      };

      this.lastSpokenText = cleanText;
      this.lastSpokenTime = now;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignorer silencieusement si la synthèse vocale est refusée par le navigateur
    }
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}
