import { Injectable } from '@angular/core';

export interface FilterState {
  // États des toggles
  priceToggle: boolean;
  dateToggle: boolean;
  surfaceToggle: boolean;
  energyToggle: boolean;
  consumptionToggle: boolean;
  
  // Paramètres des filtres
  priceFilter: [number, number] | null;
  exactPrice: number | null;
  dateFilter: [string, string] | null;
  exactDate: string | null;
  surfaceFilter: [number, number] | null;
  exactSurface: number | null;
  energyClassRange: [string, string] | null;
  exactEnergyClass: string | null;
  selectedEnergyClasses: string[] | null;
  consumptionFilter: [number, number] | null;
  exactConsumption: number | null;
  
  // État de visibilité
  markersVisible: boolean;
  
  // Modes de filtres (pour les formulaires)
  priceMode: 'exact' | 'range';
  dateMode: 'exact' | 'range';
  surfaceMode: 'exact' | 'range';
  energyMode: 'exact' | 'range' | 'multiple';
  consumptionMode: 'exact' | 'range';
  
  // États d'expansion des sections
  priceExpanded: boolean;
  dateExpanded: boolean;
  surfaceExpanded: boolean;
  energyExpanded: boolean;
  consumptionExpanded: boolean;
  
  // État du sidebar
  tableCollapsed: boolean;
  leftSidebarOpen: boolean;
  
  // Source de données
  dataSource: string;
  
  // Timestamp de sauvegarde
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class FilterStateService {
  private readonly STORAGE_KEY = 'dvf-map-filter-state';
  private readonly STORAGE_VERSION = '1.0';

  constructor() {}

  /**
   * Sauvegarde l'état des filtres dans localStorage
   */
  saveFilterState(state: FilterState): void {
    try {
      const stateWithVersion = {
        ...state,
        version: this.STORAGE_VERSION,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateWithVersion));
      
    } catch (error) {
      console.error('❌ Error saving filter state:', error);
    }
  }

  /**
   * Restaure l'état des filtres depuis localStorage
   */
  getFilterState(): FilterState | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        
        return null;
      }

      const parsed = JSON.parse(stored);
      
      // Vérifier la version pour éviter les incompatibilités
      if (parsed.version !== this.STORAGE_VERSION) {
        
        this.clearFilterState();
        return null;
      }

      // Vérifier que l'état n'est pas trop ancien (7 jours)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours en millisecondes
      if (Date.now() - parsed.timestamp > maxAge) {
        
        this.clearFilterState();
        return null;
      }

      
      return parsed as FilterState;
    } catch (error) {
      console.error('❌ Error loading filter state:', error);
      this.clearFilterState();
      return null;
    }
  }

  /**
   * Efface l'état sauvegardé
   */
  clearFilterState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      
    } catch (error) {
      console.error('❌ Error clearing filter state:', error);
    }
  }

  /**
   * Retourne l'état par défaut des filtres
   */
  getDefaultFilterState(): FilterState {
    return {
      // États des toggles (tous désactivés par défaut)
      priceToggle: false,
      dateToggle: false,
      surfaceToggle: false,
      energyToggle: false,
      consumptionToggle: false,
      
      // Paramètres des filtres (tous null par défaut)
      priceFilter: null,
      exactPrice: null,
      dateFilter: null,
      exactDate: null,
      surfaceFilter: null,
      exactSurface: null,
      energyClassRange: null,
      exactEnergyClass: null,
      selectedEnergyClasses: null,
      consumptionFilter: null,
      exactConsumption: null,
      
      // État de visibilité (visible par défaut)
      markersVisible: true,
      
      // Modes de filtres (range par défaut)
      priceMode: 'range',
      dateMode: 'range',
      surfaceMode: 'range',
      energyMode: 'multiple',
      consumptionMode: 'range',
      
      // États d'expansion (fermés par défaut)
      priceExpanded: false,
      dateExpanded: false,
      surfaceExpanded: false,
      energyExpanded: false,
      consumptionExpanded: false,
      
      // État du sidebar (ouvert par défaut selon la mémoire)
      tableCollapsed: false,
      leftSidebarOpen: false,
      
      // Source de données par défaut
      dataSource: 'dvf',
      
      // Timestamp
      timestamp: Date.now()
    };
  }

  /**
   * Vérifie si un état sauvegardé existe
   */
  hasSavedState(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }
}
