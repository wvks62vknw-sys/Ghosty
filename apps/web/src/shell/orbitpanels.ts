/**
 * THE PANELS OF A SCREEN, as chips on a hub's recent card in ORBIT (BRIEF-ORBIT-HUD 4; d1/hub-440.png: "Reader · Shelf · Ask the library"). Each is a
 * place inside the screen that already has its own address (a screen inside another, a section's `?arg`), so a chip is a real way in and
 * never a label for something that is not there. A screen with no panel of its own shows no chips. Pure: no document, no state.
 */
export interface PanelChip {
  label: string;
  /** Where it goes: a screen id, or `screen?section`. */
  to: string;
}

const PANELS: Record<string, PanelChip[]> = {
  library: [
    { label: 'Reader', to: 'reader' },
    { label: 'Shelf', to: 'library?shelf' },
    { label: 'Ask the library', to: 'library?ask' },
  ],
  eye: [{ label: 'Machine view', to: 'eye?machine' }],
};

/** The chips of a screen (at most three). */
export const panelsOf = (screen: string): PanelChip[] => (PANELS[screen] ?? []).slice(0, 3);
