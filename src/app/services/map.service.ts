import { Injectable } from "@angular/core"
import { BehaviorSubject, type Observable, Subject } from "rxjs"

export interface MapCoordinates {
  topLeft: [number, number]
  topRight: [number, number]
  bottomLeft: [number, number]
  bottomRight: [number, number]
}

@Injectable({
  providedIn: "root",
})
export class MapService {
  private readonly coordinatesSubject = new BehaviorSubject<MapCoordinates>({
    topLeft: [0, 0],
    topRight: [0, 0],
    bottomLeft: [0, 0],
    bottomRight: [0, 0],
  })

  // Subject for triggering map refresh
  private readonly refreshSubject = new Subject<void>()

  // Nouveaux subjects pour les fonctionnalités ajoutées
  private readonly mapTypeSubject = new Subject<"street" | "satellite" | "cadastre">()
  private readonly centerMapSubject = new Subject<void>()
  private readonly locationSubject = new Subject<{lat: number, lon: number, name: string}>()
  private readonly userLocationSubject = new Subject<{lat: number, lon: number, accuracy: number}>()

  constructor() {}

  // Convertit des coordonnées WGS84 (latitude, longitude) en Lambert93
  toLambert93(lat: number, lng: number): [number, number] {
  
    const x = lng * 100000 // Longitude -> X Lambert93
    const y = lat * 100000 // Latitude -> Y Lambert93

    return [x, y]
  }

  // Convertit des coordonnées Lambert93 en WGS84 (latitude, longitude)
  fromLambert93(x: number, y: number): [number, number] {
    
    const lat = y / 100000 // Y Lambert93 -> Latitude
    const lng = x / 100000 // X Lambert93 -> Longitude

    return [lat, lng]
  }

  // Met à jour les coordonnées de la carte
  setCoordinates(coordinates: MapCoordinates): void {
    this.coordinatesSubject.next(coordinates)
  }

  // Récupère les coordonnées actuelles de la carte
  getCoordinates(): MapCoordinates {
    return this.coordinatesSubject.value
  }

  // Observable pour s'abonner aux changements de coordonnées
  getCoordinatesObservable(): Observable<MapCoordinates> {
    return this.coordinatesSubject.asObservable()
  }

  /**
   * Triggers a map refresh to apply new filters
   */
  refreshMap(): void {
    this.refreshSubject.next()
  }

  /**
   * Returns an observable that emits when the map should be refreshed
   */
  getRefreshObservable(): Observable<void> {
    return this.refreshSubject.asObservable()
  }

  /**
   * Change le type de carte (plan ou satellite)
   */
  setMapType(type: "street" | "satellite" |"cadastre"): void {
    this.mapTypeSubject.next(type)
  }

  /**
   * Observable pour s'abonner aux changements de type de carte
   */
  getMapTypeObservable(): Observable<"street" | "satellite" | "cadastre"> {
    return this.mapTypeSubject.asObservable()
  }

  /**
   * Déclenche un recentrage de la carte
   */
  centerMap(): void {
    this.centerMapSubject.next()
  }

  /**
   * Observable pour s'abonner aux événements de recentrage
   */
  getCenterMapObservable(): Observable<void> {
    return this.centerMapSubject.asObservable()
  }

  /**
   * Définit une location spécifique sur la carte
   */
  setLocation(lat: number, lon: number, name: string): void {
    this.locationSubject.next({ lat, lon, name })
  }

  /**
   * Observable pour s'abonner aux changements de location
   */
  getLocationObservable(): Observable<{lat: number, lon: number, name: string}> {
    return this.locationSubject.asObservable()
  }

  /**
   * Définit la location de l'utilisateur
   */
  setUserLocation(lat: number, lon: number, accuracy: number): void {
    this.userLocationSubject.next({ lat, lon, accuracy })
  }

  /**
   * Observable pour s'abonner aux changements de location utilisateur
   */
  getUserLocationObservable(): Observable<{lat: number, lon: number, accuracy: number}> {
    return this.userLocationSubject.asObservable()
  }
}
