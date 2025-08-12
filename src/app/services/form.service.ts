import { Injectable } from "@angular/core"
import { BehaviorSubject, type Observable } from "rxjs"

type DataSourceType = 'dvf' | 'dpe' | 'parcelles' | 'none'
type FilterMode = 'exact' | 'range'
type EnergyFilterMode = 'exact' | 'range' | 'multiple'

// Interface pour la persistance de l'état des filtres
export interface FilterState {
  // États des toggles de filtres
  priceToggle: boolean
  dateToggle: boolean
  surfaceToggle: boolean
  energyToggle: boolean
  consumptionToggle: boolean
  
  // États d'expansion des chevrons
  priceExpanded: boolean
  dateExpanded: boolean
  surfaceExpanded: boolean
  energyExpanded: boolean
  consumptionExpanded: boolean
  
  // Valeurs des filtres
  priceFilter: [number, number] | null
  exactPrice: number | null
  dateFilter: [string, string] | null
  exactDate: string | null
  surfaceFilter: [number, number] | null
  exactSurface: number | null
  energyClassRange: [string, string] | null
  exactEnergyClass: string | null
  selectedEnergyClasses: string[] | null
  consumptionFilter: [number, number] | null
  exactConsumption: number | null
  
  // Modes des filtres
  priceMode: FilterMode
  dateMode: FilterMode
  surfaceMode: FilterMode
  energyMode: EnergyFilterMode
  consumptionMode: FilterMode
  
  // États de l'interface
  markersVisible: boolean
  leftSidebarOpen: boolean
  tableCollapsed: boolean
  
  // Métadonnées
  timestamp: number
  version: string
}

@Injectable({ providedIn: "root" })
export class FormService {
  private readonly priceFilterSubject = new BehaviorSubject<[number, number] | null>(null)
  private readonly exactPriceSubject = new BehaviorSubject<number | null>(null)
  
  private readonly dateFilterSubject = new BehaviorSubject<[string, string] | null>(null)
  private readonly exactDateSubject = new BehaviorSubject<string | null>(null)
  
  private readonly surfaceFilterSubject = new BehaviorSubject<[number, number] | null>(null)
  private readonly exactSurfaceSubject = new BehaviorSubject<number | null>(null)
  
  // Filtres de classe énergétique
  private readonly energyClassRangeSubject = new BehaviorSubject<[string, string] | null>(null)
  private readonly exactEnergyClassSubject = new BehaviorSubject<string | null>(null)
  private readonly selectedEnergyClassesSubject = new BehaviorSubject<string[] | null>(null)
  
  // Filtres de consommation énergétique
  private readonly consumptionFilterSubject = new BehaviorSubject<[number, number] | null>(null)
  private readonly exactConsumptionSubject = new BehaviorSubject<number | null>(null)
  
  // État de visibilité des marqueurs
  private readonly markersVisibleSubject = new BehaviorSubject<boolean>(true)
  
  // États des toggles de filtres
  private readonly priceToggleSubject = new BehaviorSubject<boolean>(false)
  private readonly dateToggleSubject = new BehaviorSubject<boolean>(false)
  private readonly surfaceToggleSubject = new BehaviorSubject<boolean>(false)
  private readonly energyToggleSubject = new BehaviorSubject<boolean>(false)
  private readonly consumptionToggleSubject = new BehaviorSubject<boolean>(false)

  // États de chargement des filtres
  private readonly priceLoadingSubject = new BehaviorSubject<boolean>(false)
  private readonly dateLoadingSubject = new BehaviorSubject<boolean>(false)
  private readonly surfaceLoadingSubject = new BehaviorSubject<boolean>(false)
  private readonly energyLoadingSubject = new BehaviorSubject<boolean>(false)
  private readonly consumptionLoadingSubject = new BehaviorSubject<boolean>(false)

  // États d'expansion des sections de filtres (chevrons)
  private readonly priceExpandedSubject = new BehaviorSubject<boolean>(false)
  private readonly dateExpandedSubject = new BehaviorSubject<boolean>(false)
  private readonly surfaceExpandedSubject = new BehaviorSubject<boolean>(false)
  private readonly energyExpandedSubject = new BehaviorSubject<boolean>(false)
  private readonly consumptionExpandedSubject = new BehaviorSubject<boolean>(false)

  // Modes des filtres
  private readonly priceModeSubject = new BehaviorSubject<FilterMode>('range')
  private readonly dateModeSubject = new BehaviorSubject<FilterMode>('range')
  private readonly surfaceModeSubject = new BehaviorSubject<FilterMode>('range')
  private readonly energyModeSubject = new BehaviorSubject<EnergyFilterMode>('multiple')
  private readonly consumptionModeSubject = new BehaviorSubject<FilterMode>('range')

  // États de l'interface utilisateur
  private readonly leftSidebarOpenSubject = new BehaviorSubject<boolean>(true)
  private readonly tableCollapsedSubject = new BehaviorSubject<boolean>(false)

  private readonly dataSourceSubject = new BehaviorSubject<DataSourceType>('none')

  // Clé de stockage localStorage
  private readonly STORAGE_KEY = 'dvf-map-filter-state'
  private readonly STORAGE_VERSION = '1.0'

  getPriceFilterObservable(): Observable<[number, number] | null> {
    return this.priceFilterSubject.asObservable()
  }

  getDateFilterObservable(): Observable<[string, string] | null> {
    return this.dateFilterSubject.asObservable()
  }

  getSurfaceFilterObservable(): Observable<[number, number] | null> {
    return this.surfaceFilterSubject.asObservable()
  }
  
  getExactSurfaceObservable(): Observable<number | null> {
    return this.exactSurfaceSubject.asObservable()
  }

  getExactEnergyClassObservable(): Observable<string | null> {
    return this.exactEnergyClassSubject.asObservable()
  }
  
  getEnergyClassRangeObservable(): Observable<[string, string] | null> {
    return this.energyClassRangeSubject.asObservable()
  }
  
  getSelectedEnergyClassesObservable(): Observable<string[] | null> {
    return this.selectedEnergyClassesSubject.asObservable()
  }

  // Nouveaux observables pour la consommation
  getConsumptionFilterObservable(): Observable<[number, number] | null> {
    return this.consumptionFilterSubject.asObservable()
  }

  getExactConsumptionObservable(): Observable<number | null> {
    return this.exactConsumptionSubject.asObservable()
  }

  getDataSourceObservable(): Observable<DataSourceType> {
    return this.dataSourceSubject.asObservable()
  }

  getMarkersVisibleObservable(): Observable<boolean> {
    return this.markersVisibleSubject.asObservable()
  }

  // Toggle state observables
  getPriceToggleObservable(): Observable<boolean> {
    return this.priceToggleSubject.asObservable()
  }

  getDateToggleObservable(): Observable<boolean> {
    return this.dateToggleSubject.asObservable()
  }

  getSurfaceToggleObservable(): Observable<boolean> {
    return this.surfaceToggleSubject.asObservable()
  }

  getEnergyToggleObservable(): Observable<boolean> {
    return this.energyToggleSubject.asObservable()
  }

  getConsumptionToggleObservable(): Observable<boolean> {
    return this.consumptionToggleSubject.asObservable()
  }

  // Loading state observables
  getPriceLoadingObservable(): Observable<boolean> {
    return this.priceLoadingSubject.asObservable()
  }

  getDateLoadingObservable(): Observable<boolean> {
    return this.dateLoadingSubject.asObservable()
  }

  getSurfaceLoadingObservable(): Observable<boolean> {
    return this.surfaceLoadingSubject.asObservable()
  }

  getEnergyLoadingObservable(): Observable<boolean> {
    return this.energyLoadingSubject.asObservable()
  }

  getConsumptionLoadingObservable(): Observable<boolean> {
    return this.consumptionLoadingSubject.asObservable()
  }

  // Observables pour les états d'expansion des chevrons
  getPriceExpandedObservable(): Observable<boolean> {
    return this.priceExpandedSubject.asObservable()
  }

  getDateExpandedObservable(): Observable<boolean> {
    return this.dateExpandedSubject.asObservable()
  }

  getSurfaceExpandedObservable(): Observable<boolean> {
    return this.surfaceExpandedSubject.asObservable()
  }

  getEnergyExpandedObservable(): Observable<boolean> {
    return this.energyExpandedSubject.asObservable()
  }

  getConsumptionExpandedObservable(): Observable<boolean> {
    return this.consumptionExpandedSubject.asObservable()
  }

  // Observables pour les modes des filtres
  getPriceModeObservable(): Observable<FilterMode> {
    return this.priceModeSubject.asObservable()
  }

  getDateModeObservable(): Observable<FilterMode> {
    return this.dateModeSubject.asObservable()
  }

  getSurfaceModeObservable(): Observable<FilterMode> {
    return this.surfaceModeSubject.asObservable()
  }

  getEnergyModeObservable(): Observable<EnergyFilterMode> {
    return this.energyModeSubject.asObservable()
  }

  getConsumptionModeObservable(): Observable<FilterMode> {
    return this.consumptionModeSubject.asObservable()
  }

  // Observables pour les états de l'interface
  getLeftSidebarOpenObservable(): Observable<boolean> {
    return this.leftSidebarOpenSubject.asObservable()
  }

  getTableCollapsedObservable(): Observable<boolean> {
    return this.tableCollapsedSubject.asObservable()
  }

  // Observables pour les valeurs exactes (ajout des manquants)
  getExactPriceObservable(): Observable<number | null> {
    return this.exactPriceSubject.asObservable()
  }

  getExactDateObservable(): Observable<string | null> {
    return this.exactDateSubject.asObservable()
  }



  setPriceFilter(minPrice: number, maxPrice: number): void {
    this.priceFilterSubject.next([minPrice, maxPrice])
    this.exactPriceSubject.next(null)
    this.saveCurrentState()
  }

  setExactPrice(price: number): void {
    this.exactPriceSubject.next(price)
    this.priceFilterSubject.next(null)
    this.saveCurrentState()
  }

  setDateFilter(startDate: string, endDate: string): void {
    this.dateFilterSubject.next([startDate, endDate])
    this.exactDateSubject.next(null)
    this.saveCurrentState()
  }

  setExactDate(date: string): void {
    this.exactDateSubject.next(date)
    this.dateFilterSubject.next(null)
    this.saveCurrentState()
  }

  setSurfaceFilter(minSurface: number, maxSurface: number): void {
    this.surfaceFilterSubject.next([minSurface, maxSurface])
    this.exactSurfaceSubject.next(null)
    this.saveCurrentState()
  }
  
  setExactSurface(surface: number): void {
    this.exactSurfaceSubject.next(surface)
    this.surfaceFilterSubject.next(null)
    this.saveCurrentState()
  }

  setExactEnergyClass(energyClass: string): void {
    this.exactEnergyClassSubject.next(energyClass)
    this.energyClassRangeSubject.next(null)
    this.selectedEnergyClassesSubject.next(null)
  }

  setEnergyClassRange(min: string, max: string): void {
    this.energyClassRangeSubject.next([min, max])
    this.exactEnergyClassSubject.next(null)
    this.selectedEnergyClassesSubject.next(null)
  }

  setSelectedEnergyClasses(energyClasses: string[]): void {
    this.selectedEnergyClassesSubject.next(energyClasses)
    this.exactEnergyClassSubject.next(null)
    this.energyClassRangeSubject.next(null)
    this.saveCurrentState()
  }

  // Nouvelles méthodes pour la consommation
  setConsumptionFilter(minConsumption: number, maxConsumption: number): void {
    this.consumptionFilterSubject.next([minConsumption, maxConsumption])
    this.exactConsumptionSubject.next(null)
    this.saveCurrentState()
  }

  setExactConsumption(consumption: number): void {
    this.exactConsumptionSubject.next(consumption)
    this.consumptionFilterSubject.next(null)
    this.saveCurrentState()
  }

  setDataSource(source: DataSourceType): void {
    this.dataSourceSubject.next(source)
  }

  setMarkersVisible(visible: boolean): void {
    this.markersVisibleSubject.next(visible)
  }

  // Toggle state setters
  setPriceToggle(active: boolean): void {
    this.priceToggleSubject.next(active)
  }

  setDateToggle(active: boolean): void {
    this.dateToggleSubject.next(active)
  }

  setSurfaceToggle(active: boolean): void {
    this.surfaceToggleSubject.next(active)
  }

  setEnergyToggle(active: boolean): void {
    this.energyToggleSubject.next(active)
    this.saveCurrentState()
  }

  setConsumptionToggle(active: boolean): void {
    this.consumptionToggleSubject.next(active)
    this.saveCurrentState()
  }

  // Setters pour les états d'expansion des chevrons
  setPriceExpanded(expanded: boolean): void {
    this.priceExpandedSubject.next(expanded)
    this.saveCurrentState()
  }

  setDateExpanded(expanded: boolean): void {
    this.dateExpandedSubject.next(expanded)
    this.saveCurrentState()
  }

  setSurfaceExpanded(expanded: boolean): void {
    this.surfaceExpandedSubject.next(expanded)
    this.saveCurrentState()
  }

  setEnergyExpanded(expanded: boolean): void {
    this.energyExpandedSubject.next(expanded)
    this.saveCurrentState()
  }

  setConsumptionExpanded(expanded: boolean): void {
    this.consumptionExpandedSubject.next(expanded)
    this.saveCurrentState()
  }

  // Setters pour les modes des filtres
  setPriceMode(mode: FilterMode): void {
    this.priceModeSubject.next(mode)
    this.saveCurrentState()
  }

  setDateMode(mode: FilterMode): void {
    this.dateModeSubject.next(mode)
    this.saveCurrentState()
  }

  setSurfaceMode(mode: FilterMode): void {
    this.surfaceModeSubject.next(mode)
    this.saveCurrentState()
  }

  setEnergyMode(mode: EnergyFilterMode): void {
    this.energyModeSubject.next(mode)
    this.saveCurrentState()
  }

  setConsumptionMode(mode: FilterMode): void {
    this.consumptionModeSubject.next(mode)
    this.saveCurrentState()
  }

  // Setters pour les états de l'interface
  setLeftSidebarOpen(open: boolean): void {
    this.leftSidebarOpenSubject.next(open)
    this.saveCurrentState()
  }

  setTableCollapsed(collapsed: boolean): void {
    this.tableCollapsedSubject.next(collapsed)
    this.saveCurrentState()
  }

  // Loading state setters
  setPriceLoading(loading: boolean): void {
    this.priceLoadingSubject.next(loading)
  }

  setDateLoading(loading: boolean): void {
    this.dateLoadingSubject.next(loading)
  }

  setSurfaceLoading(loading: boolean): void {
    this.surfaceLoadingSubject.next(loading)
  }

  setEnergyLoading(loading: boolean): void {
    this.energyLoadingSubject.next(loading)
  }

  setConsumptionLoading(loading: boolean): void {
    this.consumptionLoadingSubject.next(loading)
  }

  clearPriceFilter(): void {
    this.priceFilterSubject.next(null)
  }

  clearDateFilter(): void {
    this.dateFilterSubject.next(null)
  }

  clearSurfaceFilter(): void {
    this.surfaceFilterSubject.next(null)
    this.exactSurfaceSubject.next(null)
  }

  clearEnergyClassFilter(): void {
    this.exactEnergyClassSubject.next(null)
    this.energyClassRangeSubject.next(null)
    this.selectedEnergyClassesSubject.next(null)
  }

  clearConsumptionFilter(): void {
    this.consumptionFilterSubject.next(null)
    this.exactConsumptionSubject.next(null)
    this.saveCurrentState()
  }

  // ===== MÉTHODES DE PERSISTANCE =====

  /**
   * Sauvegarde l'état actuel de tous les filtres dans localStorage
   */
  private saveCurrentState(): void {
    try {
      const currentState: FilterState = {
        // États des toggles de filtres
        priceToggle: this.priceToggleSubject.value,
        dateToggle: this.dateToggleSubject.value,
        surfaceToggle: this.surfaceToggleSubject.value,
        energyToggle: this.energyToggleSubject.value,
        consumptionToggle: this.consumptionToggleSubject.value,
        
        // États d'expansion des chevrons
        priceExpanded: this.priceExpandedSubject.value,
        dateExpanded: this.dateExpandedSubject.value,
        surfaceExpanded: this.surfaceExpandedSubject.value,
        energyExpanded: this.energyExpandedSubject.value,
        consumptionExpanded: this.consumptionExpandedSubject.value,
        
        // Valeurs des filtres
        priceFilter: this.priceFilterSubject.value,
        exactPrice: this.exactPriceSubject.value,
        dateFilter: this.dateFilterSubject.value,
        exactDate: this.exactDateSubject.value,
        surfaceFilter: this.surfaceFilterSubject.value,
        exactSurface: this.exactSurfaceSubject.value,
        energyClassRange: this.energyClassRangeSubject.value,
        exactEnergyClass: this.exactEnergyClassSubject.value,
        selectedEnergyClasses: this.selectedEnergyClassesSubject.value,
        consumptionFilter: this.consumptionFilterSubject.value,
        exactConsumption: this.exactConsumptionSubject.value,
        
        // Modes des filtres
        priceMode: this.priceModeSubject.value,
        dateMode: this.dateModeSubject.value,
        surfaceMode: this.surfaceModeSubject.value,
        energyMode: this.energyModeSubject.value,
        consumptionMode: this.consumptionModeSubject.value,
        
        // États de l'interface
        markersVisible: this.markersVisibleSubject.value,
        leftSidebarOpen: this.leftSidebarOpenSubject.value,
        tableCollapsed: this.tableCollapsedSubject.value,
        
        // Métadonnées
        timestamp: Date.now(),
        version: this.STORAGE_VERSION
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentState))
      console.log('💾 État des filtres sauvegardé:', currentState)
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde de l\'état des filtres:', error)
    }
  }

  /**
   * Restaure l'état des filtres depuis localStorage
   */
  restoreFilterState(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY)
      if (!saved) {
        console.log('📝 Aucun état sauvegardé trouvé')
        return
      }

      const savedState = JSON.parse(saved) as FilterState
      
      // Vérifier la version et l'expiration (7 jours)
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 jours en millisecondes
      if (savedState.version !== this.STORAGE_VERSION || 
          (Date.now() - savedState.timestamp) > maxAge) {
        console.log('🗑️ État sauvegardé expiré ou incompatible, suppression')
        localStorage.removeItem(this.STORAGE_KEY)
        return
      }

      console.log('🔄 Restauration de l\'état des filtres:', savedState)

      // Restaurer les états des toggles
      this.priceToggleSubject.next(savedState.priceToggle)
      this.dateToggleSubject.next(savedState.dateToggle)
      this.surfaceToggleSubject.next(savedState.surfaceToggle)
      this.energyToggleSubject.next(savedState.energyToggle)
      this.consumptionToggleSubject.next(savedState.consumptionToggle)

      // Restaurer les états d'expansion des chevrons
      this.priceExpandedSubject.next(savedState.priceExpanded)
      this.dateExpandedSubject.next(savedState.dateExpanded)
      this.surfaceExpandedSubject.next(savedState.surfaceExpanded)
      this.energyExpandedSubject.next(savedState.energyExpanded)
      this.consumptionExpandedSubject.next(savedState.consumptionExpanded)

      // Restaurer les valeurs des filtres
      this.priceFilterSubject.next(savedState.priceFilter)
      this.exactPriceSubject.next(savedState.exactPrice)
      this.dateFilterSubject.next(savedState.dateFilter)
      this.exactDateSubject.next(savedState.exactDate)
      this.surfaceFilterSubject.next(savedState.surfaceFilter)
      this.exactSurfaceSubject.next(savedState.exactSurface)
      this.energyClassRangeSubject.next(savedState.energyClassRange)
      this.exactEnergyClassSubject.next(savedState.exactEnergyClass)
      this.selectedEnergyClassesSubject.next(savedState.selectedEnergyClasses)
      this.consumptionFilterSubject.next(savedState.consumptionFilter)
      this.exactConsumptionSubject.next(savedState.exactConsumption)

      // Restaurer les modes des filtres
      this.priceModeSubject.next(savedState.priceMode)
      this.dateModeSubject.next(savedState.dateMode)
      this.surfaceModeSubject.next(savedState.surfaceMode)
      this.energyModeSubject.next(savedState.energyMode)
      this.consumptionModeSubject.next(savedState.consumptionMode)

      // Restaurer les états de l'interface
      this.markersVisibleSubject.next(savedState.markersVisible)
      this.leftSidebarOpenSubject.next(savedState.leftSidebarOpen)
      this.tableCollapsedSubject.next(savedState.tableCollapsed)

      console.log('✅ État des filtres restauré avec succès')
    } catch (error) {
      console.error('❌ Erreur lors de la restauration de l\'état des filtres:', error)
      // En cas d'erreur, supprimer l'état corrompu
      localStorage.removeItem(this.STORAGE_KEY)
    }
  }

  /**
   * Vérifie si des filtres sont actuellement actifs
   */
  hasActiveFilters(): boolean {
    return this.priceToggleSubject.value ||
           this.dateToggleSubject.value ||
           this.surfaceToggleSubject.value ||
           this.energyToggleSubject.value ||
           this.consumptionToggleSubject.value
  }

  /**
   * Efface tous les filtres et l'état sauvegardé
   */
  clearAllFilters(): void {
    // Effacer tous les toggles
    this.priceToggleSubject.next(false)
    this.dateToggleSubject.next(false)
    this.surfaceToggleSubject.next(false)
    this.energyToggleSubject.next(false)
    this.consumptionToggleSubject.next(false)

    // Effacer toutes les valeurs de filtres
    this.clearPriceFilter()
    this.clearDateFilter()
    this.clearSurfaceFilter()
    this.clearEnergyClassFilter()
    this.clearConsumptionFilter()

    // Fermer tous les chevrons
    this.priceExpandedSubject.next(false)
    this.dateExpandedSubject.next(false)
    this.surfaceExpandedSubject.next(false)
    this.energyExpandedSubject.next(false)
    this.consumptionExpandedSubject.next(false)

    // Réinitialiser les modes par défaut
    this.priceModeSubject.next('range')
    this.dateModeSubject.next('range')
    this.surfaceModeSubject.next('range')
    this.energyModeSubject.next('multiple')
    this.consumptionModeSubject.next('range')

    // Supprimer l'état sauvegardé
    localStorage.removeItem(this.STORAGE_KEY)
    console.log('🗑️ Tous les filtres effacés et état sauvegardé supprimé')
  }
}