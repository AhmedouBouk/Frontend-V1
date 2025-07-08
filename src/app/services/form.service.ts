import { Injectable } from "@angular/core"
import { BehaviorSubject, type Observable } from "rxjs"

@Injectable({ providedIn: "root" })
export class FormService {
  private priceFilterSubject = new BehaviorSubject<[number, number] | null>(null)
  private dateFilterSubject = new BehaviorSubject<[string, string] | null>(null)

  getPriceFilterObservable(): Observable<[number, number] | null> {
    return this.priceFilterSubject.asObservable()
  }

  getDateFilterObservable(): Observable<[string, string] | null> {
    return this.dateFilterSubject.asObservable()
  }




  setPriceFilter(minPrice: number, maxPrice: number): void {
    this.priceFilterSubject.next([minPrice, maxPrice])
  }

  setDateFilter(startDate: string, endDate: string): void {
    this.dateFilterSubject.next([startDate, endDate])
  }

  

  clearPriceFilter(): void {
    this.priceFilterSubject.next(null)
  }

  clearDateFilter(): void {
    this.dateFilterSubject.next(null)
  }

  
}
