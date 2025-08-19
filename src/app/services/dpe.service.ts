import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { DpeProperty } from '../models/dpe.model';
import { environment } from '../../environments/environment';
import { CoordinateConversionService } from './coordinate-conversion.service';

/**
 * Filter options interface to reduce parameter count
 */
export interface DpeFilterOptions {
  energyFilter?: string[] | number | [number, number] | null;
  filterMode?: 'exact' | 'interval' | 'class';
  surfaceRange?: [number, number] | null;
  exactDate?: string | null;
  dateRange?: [string, string] | null;
  consumptionFilter?: [number, number] | null;
  exactConsumption?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class DpeService {
  constructor(
    private readonly http: HttpClient,
    private readonly coordService: CoordinateConversionService
  ) {}

  /**
   * Convertit des coordonnees lat/lon (WGS84) en coordonnees Lambert 93 avec haute precision
   * Utilise la transformation officielle IGN
   */
  private convertLatLonToProjected(latLon: [number, number]): [number, number] {
    const [lat, lon] = latLon;
    
    // Validation des coordonnees pour la France
    if (!this.coordService.isValidFrenchCoordinates(lat, lon)) {
      console.warn(` Coordonnees hors France: [${lat}, ${lon}]`);
    }
    
    // Conversion precise WGS84 → Lambert93
    const [x_projected, y_projected] = this.coordService.wgs84ToLambert93(lat, lon);
    
    
    return [y_projected, x_projected];
  }

  /**
   * Convertit des coordonnees Lambert 93 vers lat/lon (WGS84) avec haute precision
   * Utilise la transformation inverse officielle IGN
   */
  private convertProjectedToLatLon(projected: [number, number]): [number, number] {
    const [y_projected, x_projected] = projected;
    
    // Conversion precise Lambert93 → WGS84
    const [lat, lon] = this.coordService.lambert93ToWgs84(x_projected, y_projected);
    
    
    return [lat, lon];
  }

  /**
   * Helper method to determine if a surface range should be ignored for SELECT * behavior
   * Returns true if the range is null, empty, or contains only default/placeholder values
   * @param range The numeric range to check
   * @returns true if this range should be ignored (SELECT * behavior)
   */
  private shouldIgnoreSurfaceRange(range: [number, number] | null): boolean {
    if (!range || !Array.isArray(range) || range.length !== 2) {
      return true; // No range provided - SELECT * behavior
    }
    
    // Check for surface filter default ranges that indicate "no real filter"
    const [min, max] = range;
    
    // Surface filter defaults: 0-10000 or larger
    if (min === 0 && max >= 10000) {
      return true; // Default surface range - SELECT * behavior
    }
    
    return false; // Valid user-provided surface range
  }

  /**
   * Helper method to determine if a consumption range should be ignored for SELECT * behavior
   * For consumption filters, we accept ALL user-provided ranges as valid
   * @param range The numeric range to check
   * @returns always false for consumption filters
   */
  private shouldIgnoreConsumptionRange(range: [number, number] | null): boolean {
    if (!range || !Array.isArray(range) || range.length !== 2) {
      return true; // No range provided - SELECT * behavior
    }
    
    // For consumption filter, accept ALL user-provided ranges as valid
    // Don't ignore any consumption ranges since user explicitly set them
    return false; // Valid user-provided consumption range
  }
  
  /**
   * Apply filter parameters consistently to the params object
   * @param params The params object to modify
   * @param options Filter options to apply
   * @returns The modified params object
   */
  private applyFilterParams(params: Record<string, any>, options: {
    surfaceRange?: [number, number] | null;
    exactDate?: string | null;
    dateRange?: [string, string] | null;
    consumptionFilter?: [number, number] | null;
    exactConsumption?: number | null;
    typeLocaleFilter?: string[] | null;
  }): Record<string, any> {
    const { surfaceRange, exactDate, dateRange, consumptionFilter, exactConsumption, typeLocaleFilter } = options;
    const enhancedParams = { ...params };
    
    // Ajout des filtres de date si présents
    if (exactDate) {
      enhancedParams['date_exacte'] = exactDate;
    } else if (dateRange && dateRange.length === 2) {
      enhancedParams['date_min'] = dateRange[0];
      enhancedParams['date_max'] = dateRange[1];
    }

    // 🔥 Surface filter parameters - TRUE SELECT * logic
    if (surfaceRange && Array.isArray(surfaceRange) && surfaceRange.length === 2) {
      // Only add parameters if they contain valid, non-default values
      if (!this.shouldIgnoreSurfaceRange(surfaceRange)) {
        enhancedParams['surface_min'] = surfaceRange[0];
        enhancedParams['surface_max'] = surfaceRange[1];
      }
    }

    // 🔥 Consumption filter parameters - TRUE SELECT * logic
    if (exactConsumption !== null && exactConsumption !== undefined) {
      enhancedParams['consommation_exact'] = exactConsumption;
    } else if (consumptionFilter && Array.isArray(consumptionFilter) && consumptionFilter.length === 2) {
      // Only add parameters if they contain valid, non-default values
      if (!this.shouldIgnoreConsumptionRange(consumptionFilter)) {
        enhancedParams['consommation_min'] = consumptionFilter[0];
        enhancedParams['consommation_max'] = consumptionFilter[1];
      }
    }

    // 🏠 Type Locale filter - Fix parameter name to match backend API
    if (typeLocaleFilter && typeLocaleFilter.length > 0) {
      enhancedParams['type_local'] = typeLocaleFilter.join(',');
      console.log('🏠 DPE Service: Type locale filter added:', typeLocaleFilter.join(','));
    } else {
      console.log('🏠 DPE Service: No type locale filter provided');
    }

    return enhancedParams;
  }
  
  /**
   * Main request method with reduced parameter count through options pattern
   * @param topLeft Top left coordinates [lat, lng]
   * @param bottomRight Bottom right coordinates [lat, lng]
   * @param options Filter options including energy, surface, consumption and date
   * @param typeLocaleFilter Filter options for type locale
   * @returns Observable of DPE properties within bounds and matching filters
   */
  getDpeProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    filterOptions: DpeFilterOptions = {},
    typeLocaleFilter: string[] | null = null
  ): Observable<DpeProperty[]> {
  const {
    energyFilter = null,
    filterMode = 'class',
    surfaceRange = null,
    exactDate = null,
    dateRange = null,
    consumptionFilter = null,
    exactConsumption = null
  } = filterOptions;

  const topConverted = this.convertLatLonToProjected(topLeft);
  const bottomConverted = this.convertLatLonToProjected(bottomRight);

  const lat_min = Math.min(topConverted[0], bottomConverted[0]);
  const lat_max = Math.max(topConverted[0], bottomConverted[0]);
  const lon_min = Math.min(topConverted[1], bottomConverted[1]);
  const lon_max = Math.max(topConverted[1], bottomConverted[1]);

  const topLeftParam = `${lat_max},${lon_min}`;
  const bottomRightParam = `${lat_min},${lon_max}`;

  const baseParams: Record<string, any> = {
    topLeft: topLeftParam,
    bottomRight: bottomRightParam
  };

  if (filterMode === 'class' && Array.isArray(energyFilter) && energyFilter.length > 0) {
    baseParams['classe'] = energyFilter.join(',');
  } else if (filterMode === 'exact' && typeof energyFilter === 'number') {
    baseParams['valeur_dpe_exact'] = energyFilter;
  } else if (filterMode === 'interval' && Array.isArray(energyFilter) && energyFilter.length === 2) {
    baseParams['valeur_dpe_min'] = energyFilter[0];
    baseParams['valeur_dpe_max'] = energyFilter[1];
  }

  const enhancedParams = this.applyFilterParams(baseParams, {
    surfaceRange,
    exactDate,
    dateRange,
    consumptionFilter,
    exactConsumption,
    typeLocaleFilter
  });

  const apiUrl = `${environment.apiUrl}/dpe`;

  // ✅ DEBUG LOG — FULL API REQUEST INCLUDING TYPE LOCALE FILTER
  console.log('📡 DPE API Request:');
  console.log('URL:', apiUrl);
  console.log('Parameters:', enhancedParams);
  console.log('Type Locale Filter:', typeLocaleFilter);

  // Optional: Build a preview full GET URL
  const urlWithParams = new URL(apiUrl);
  Object.keys(enhancedParams).forEach(key => {
    if (enhancedParams[key] !== undefined && enhancedParams[key] !== null) {
      urlWithParams.searchParams.append(key, enhancedParams[key]);
    }
  });
  console.log('Full GET URL:', urlWithParams.toString());

  return this.http.get<any[]>(apiUrl, { params: enhancedParams }).pipe(
    map(response => this.mapResponseToProperties(response)),
    catchError(error => {
      console.error('❌ Error fetching DPE properties:', error);
      return of([]);
    })
  );
}

  /**
   * Get DPE properties filtered by classe energie only
   */
  getDpePropertiesByClasse(
    topLeft: [number, number],
    bottomRight: [number, number],
    classeFilter: string[] | null = null,
    typeLocaleFilter: string[] | null = null
  ): Observable<DpeProperty[]> {
    const filterOptions: DpeFilterOptions = {
      energyFilter: classeFilter,
      filterMode: 'class'
    };
    return this.getDpeProperties(topLeft, bottomRight, filterOptions, typeLocaleFilter);
  }

  /**
   * Get DPE properties filtered by consumption only
   */
  getDpePropertiesByConsumption(
    topLeft: [number, number],
    bottomRight: [number, number],
    consumptionFilter: [number, number] | null = null,
    exactConsumption: number | null = null,
    typeLocaleFilter: string[] | null = null
  ): Observable<DpeProperty[]> {
    const filterOptions: DpeFilterOptions = {
      consumptionFilter,
      exactConsumption
    };
    return this.getDpeProperties(topLeft, bottomRight, filterOptions, typeLocaleFilter);
  }

  /**
   * Get DPE properties filtered by valeur DPE only
   */
  getDpePropertiesByValeur(
    topLeft: [number, number],
    bottomRight: [number, number],
    valeurFilter: [number, number] | null = null,
    exactValeur: number | null = null,
    typeLocaleFilter: string[] | null = null
  ): Observable<DpeProperty[]> {
    const filterOptions: DpeFilterOptions = {
      energyFilter: valeurFilter || exactValeur,
      filterMode: exactValeur ? 'exact' : 'interval'
    };
    return this.getDpeProperties(topLeft, bottomRight, filterOptions, typeLocaleFilter);
  }

  /**
   * Maps the backend response to DpeProperty objects
   * @param response The API response array
   * @returns Array of DpeProperty objects
   */
  private mapResponseToProperties(response: any[]): DpeProperty[] {
    return response.map(item => {
      let lat: number;
      let lon: number;

      if (item.ban_x && item.ban_y) {
        // DPE coordinates are confirmed to be in Lambert93 projection with Y,X order
        // Based on testing, this method consistently produces valid coordinates
        const converted = this.convertProjectedToLatLon([item.ban_y, item.ban_x]);
        lat = converted[0];
        lon = converted[1];

        // Validate coordinates are within reasonable bounds for France
        if (lat < 41 || lat > 51 || lon < -5 || lon > 10) {
          console.warn(`⚠️ DPE coordinates outside France bounds: ban_x=${item.ban_x}, ban_y=${item.ban_y} → lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}`);
          // Keep coordinates anyway - might be overseas territories or edge cases
        }
      } else {
        // Fallback to 0,0 if no coordinates
        lat = 0;
        lon = 0;
        console.warn(`⚠️ DPE Missing coordinates for item:`, item.id);
      }

      return {
        id: item.id?.toString() ?? '',
        latitude: lat,
        longitude: lon,
        address: item.ban_street ?? item.adresse_brut ?? '',
        energyClass: item.classe_bilan_dpe ?? 'G', // Use the correct energy class field that backend filters on
        gesClass: item.classe_bilan_ges ?? 'G', // Add the missing GES class property
        year: item.annee_construction ?? new Date().getFullYear(),
        city: item.ban_city ?? item.nom_commune_brut ?? '',
        postalCode: item.ban_postcode ?? item.code_postal_brut ?? '',
        ep_conso_5_usages: item.ep_conso_5_usages ?? undefined,
        periode_construction: item.periode_construction ?? null, // Add period for different markers
        type_batiment: item.type_batiment ?? 'Non spécifié' // Add type_batiment field
      } as DpeProperty;
    });
  }
}
