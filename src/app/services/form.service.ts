import { Injectable } from "@angular/core"
import { BehaviorSubject, type Observable } from "rxjs"

// Type alias pour les sources de données
type DataSourceType = 'dvf' | 'dpe' | 'parcelles'

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
  
  // Type alias pour les sources de données
  private readonly dataSourceSubject = new BehaviorSubject<DataSourceType>('dvf')

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

  // Nouveaux observables pour la classe énergétique
  getExactEnergyClassObservable(): Observable<string | null> {
    return this.exactEnergyClassSubject.asObservable()
  }
  
  getEnergyClassRangeObservable(): Observable<[string, string] | null> {
    return this.energyClassRangeSubject.asObservable()
  }
  
  getSelectedEnergyClassesObservable(): Observable<string[] | null> {
    return this.selectedEnergyClassesSubject.asObservable()
  }

  getDataSourceObservable(): Observable<DataSourceType> {
    return this.dataSourceSubject.asObservable()
  }

  setPriceFilter(minPrice: number, maxPrice: number): void {
    this.priceFilterSubject.next([minPrice, maxPrice])
  }

  setDateFilter(startDate: string, endDate: string): void {
    this.dateFilterSubject.next([startDate, endDate])
  }

  // Méthodes pour les filtres de surface
  setSurfaceFilter(minSurface: number, maxSurface: number): void {
    this.surfaceFilterSubject.next([minSurface, maxSurface])
    this.exactSurfaceSubject.next(null)
  }
  
  setExactSurface(surface: number): void {
    this.exactSurfaceSubject.next(surface)
    this.surfaceFilterSubject.next(null)
  }

  // Méthodes pour définir les filtres de classe énergétique
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

  setDataSource(source: DataSourceType): void {
    this.dataSourceSubject.next(source)
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
}
