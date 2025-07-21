import { Injectable } from '@angular/core'

export interface MapState {
  center: [number, number]
  zoom: number
  mapType?: 'street' | 'satellite' | 'cadastre'
}

@Injectable({
  providedIn: 'root'
})
export class MapStateService {
  private readonly STORAGE_KEY = 'map-state'
  
  /**
   * Sauvegarde l'état actuel de la carte dans le localStorage
   */
  saveMapState(state: MapState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state))
      console.log('🗺️ État de la carte sauvegardé:', state)
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde de l\'état de la carte:', error)
    }
  }
  
  /**
   * Récupère l'état sauvegardé de la carte depuis le localStorage
   */
  getMapState(): MapState | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY)
      if (saved) {
        const state = JSON.parse(saved) as MapState
        console.log('🗺️ État de la carte restauré:', state)
        return state
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'état de la carte:', error)
    }
    return null
  }
  
  /**
   * Supprime l'état sauvegardé de la carte
   */
  clearMapState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('🗺️ État de la carte supprimé')
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de l\'état de la carte:', error)
    }
  }
  
  /**
   * Retourne l'état par défaut de la carte
   */
  getDefaultMapState(): MapState {
    return {
      center: [46.603354, 1.888334], // Centre de la France
      zoom: 6,
      mapType: 'street'
    }
  }
}
