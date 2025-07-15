import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { DpeProperty } from '../models/dpe.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DpeService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Récupère les données DPE depuis le backend
   * @param topLeft Coordonnées du coin haut-gauche [lat, lng]
   * @param bottomRight Coordonnées du coin bas-droit [lat, lng]
   * @param energyClass Classe(s) énergétique(s) sélectionnée(s) ou null si désactivé
   * @param filterMode Mode de filtre: 'exact', 'interval', ou 'class'
   */
  getDpeProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    energyClass: string[] | null = null,
    filterMode: 'exact' | 'interval' | 'class' = 'class'
  ): Observable<DpeProperty[]> {
    const params: any = {
      lat_min: bottomRight[0],
      lat_max: topLeft[0],
      lon_min: topLeft[1],
      lon_max: bottomRight[1],
      filter_mode: filterMode
    };

    if (energyClass && energyClass.length > 0) {
      params.energy_class = energyClass.join(',');
    }

    const apiUrl = `${environment.apiUrl}/dpe`;
    console.log('📡 API DPE URL:', `${apiUrl}?${new URLSearchParams(params).toString()}`);

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
          console.error('Failed to parse DPE response:', e);
          console.log('Raw DPE response:', response);
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

          return {
            id: item.id ?? '',
            latitude: isNaN(latitude) ? 0 : latitude,
            longitude: isNaN(longitude) ? 0 : longitude,
            address: item.address ?? '',
            energyClass: item.energy_class ?? 'G',
            gesClass: item.ges_class ?? 'G',
            year: item.year ?? new Date().getFullYear(),
            city: item.city ?? '',
            postalCode: item.postal_code ?? ''
          } as DpeProperty;
        });
      }),
      catchError(error => {
        console.error('❌ Erreur API DPE:', error);
        return of([]);
      })
    );
  }
}
