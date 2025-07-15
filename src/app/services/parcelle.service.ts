import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ParcelleProperty } from '../models/parcelle.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ParcelleService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Récupère les données Parcelle depuis le backend
   * @param topLeft Coordonnées du coin haut-gauche [lat, lng]
   * @param bottomRight Coordonnées du coin bas-droit [lat, lng]
   * @param surfaceRange Plage de surface [min, max] ou null si désactivé
   * @param filterMode Mode de filtre: 'exact', 'interval'
   */
  getParcelleProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    surfaceRange: [number, number] | null = null,
    filterMode: 'exact' | 'interval' = 'interval'
  ): Observable<ParcelleProperty[]> {
    const params: any = {
      lat_min: bottomRight[0],
      lat_max: topLeft[0],
      lon_min: topLeft[1],
      lon_max: bottomRight[1],
      filter_mode: filterMode
    };

    if (surfaceRange) {
      params.surface_min = surfaceRange[0];
      params.surface_max = surfaceRange[1];
    }

    const apiUrl = `${environment.apiUrl}/parcelles`;
    console.log('📡 API Parcelle URL:', `${apiUrl}?${new URLSearchParams(params).toString()}`);

    return this.http.get(apiUrl, { 
      params, 
      responseType: 'text' 
    }).pipe(
      map(response => {
        // Try to parse the response manually
        let data;
        try {
          data = response ? JSON.parse(response) : [];
        } catch (e) {
          console.error('Failed to parse Parcelle response:', e);
          console.log('Raw Parcelle response:', response);
          return [];
        }
        
        // Handle both array responses and object responses with a message
        if (!data) return [];
        if (!Array.isArray(data)) {
          if (data.message) {
            console.log('API message:', data.message);
          } else {
            console.warn('API response is not an array:', data);
          }
          return [];
        }

        return data.map(item => {
          const latitude = parseFloat(item.latitude);
          const longitude = parseFloat(item.longitude);
          const surface = parseFloat(item.surface);

          return {
            id: item.id ?? '',
            latitude: isNaN(latitude) ? 0 : latitude,
            longitude: isNaN(longitude) ? 0 : longitude,
            number: item.number ?? '',
            surface: isNaN(surface) ? 0 : surface,
            address: item.address ?? '',
            city: item.city ?? '',
            postalCode: item.postal_code ?? ''
          } as ParcelleProperty;
        });
      }),
      catchError(error => {
        console.error('❌ Erreur API Parcelle:', error);
        return of([]);
      })
    );
  }
}
