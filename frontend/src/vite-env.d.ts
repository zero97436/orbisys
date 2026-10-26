/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Fond de carte personnalisé (fournisseur avec clé ou serveur de tuiles interne). */
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
}
