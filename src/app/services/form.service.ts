import { Injectable } from "@angular/core"
import { BehaviorSubject, type Observable } from "rxjs"

type DataSourceType = 'dvf' | 'dpe' | 'parcelles' | 'none'

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

  private readonly dataSourceSubject = new BehaviorSubject<DataSourceType>('none')

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

  setPriceFilter(minPrice: number, maxPrice: number): void {
    this.priceFilterSubject.next([minPrice, maxPrice])
  }

  setDateFilter(startDate: string, endDate: string): void {
    this.dateFilterSubject.next([startDate, endDate])
  }

  setSurfaceFilter(minSurface: number, maxSurface: number): void {
    this.surfaceFilterSubject.next([minSurface, maxSurface])
    this.exactSurfaceSubject.next(null)
  }
  
  setExactSurface(surface: number): void {
    this.exactSurfaceSubject.next(surface)
    this.surfaceFilterSubject.next(null)
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
  }

  // Nouvelles méthodes pour la consommation
  setConsumptionFilter(minConsumption: number, maxConsumption: number): void {
    this.consumptionFilterSubject.next([minConsumption, maxConsumption])
    this.exactConsumptionSubject.next(null)
  }

  setExactConsumption(consumption: number): void {
    this.exactConsumptionSubject.next(consumption)
    this.consumptionFilterSubject.next(null)
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
  }

  setConsumptionToggle(active: boolean): void {
    this.consumptionToggleSubject.next(active)
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
  }
}