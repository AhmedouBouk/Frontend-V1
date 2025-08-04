import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CoordinateConversionService {

  // Official Lambert93 (RGF93) projection parameters
  private readonly LAMBERT93_PARAMS = {
    // Conic conformal projection parameters
    lat0: 46.5,           // Latitude of origin (degrees)
    lon0: 3.0,            // Central meridian (degrees)
    lat1: 49.0,           // First standard parallel (degrees)
    lat2: 44.0,           // Second standard parallel (degrees)
    x0: 700000.0,         // False easting (meters)
    y0: 6600000.0,        // False northing (meters)
    
    // GRS80 ellipsoid parameters
    a: 6378137.0,         // Semi-major axis (meters)
    f: 1.0 / 298.257222101, // Flattening
    e2: 0.00669438002290  // First eccentricity squared
  };

  constructor() {}

  /**
   * Converts WGS84 coordinates (lat/lon) to Lambert93 (x/y) with high precision
   * Uses official IGN transformation parameters
   * @param lat Latitude in decimal degrees (WGS84)
   * @param lon Longitude in decimal degrees (WGS84)
   * @returns [x, y] coordinates in Lambert93 (meters)
   */
  wgs84ToLambert93(lat: number, lon: number): [number, number] {
    const params = this.LAMBERT93_PARAMS;
    
    // Convert degrees to radians
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    const lat0Rad = params.lat0 * Math.PI / 180;
    const lon0Rad = params.lon0 * Math.PI / 180;
    const lat1Rad = params.lat1 * Math.PI / 180;
    const lat2Rad = params.lat2 * Math.PI / 180;

    // Calculate ellipsoid parameters
    const e = Math.sqrt(params.e2);
    const e2 = params.e2;

    // Calculate m values (reduced latitude functions)
    const m1 = this.calculateM(lat1Rad, e2);
    const m2 = this.calculateM(lat2Rad, e2);
    const m0 = this.calculateM(lat0Rad, e2);

    // Calculate t values (isometric latitude functions)
    const t1 = this.calculateT(lat1Rad, e);
    const t2 = this.calculateT(lat2Rad, e);
    const t0 = this.calculateT(lat0Rad, e);
    const t = this.calculateT(latRad, e);

    // Calculate projection constants
    const n = Math.log(m1 / m2) / Math.log(t1 / t2);
    const F = m1 / (n * Math.pow(t1, n));
    const rho0 = params.a * F * Math.pow(t0, n);

    // Calculate projected coordinates
    const rho = params.a * F * Math.pow(t, n);
    const theta = n * (lonRad - lon0Rad);

    // Final Lambert93 coordinates
    const x = params.x0 + rho * Math.sin(theta);
    const y = params.y0 + rho0 - rho * Math.cos(theta);

    console.log(`🎯 Precise WGS84→Lambert93: [${lat}, ${lon}] → [${x.toFixed(2)}, ${y.toFixed(2)}]`);
    
    return [x, y];
  }

  /**
   * Converts Lambert93 coordinates (x/y) to WGS84 (lat/lon) with high precision
   * Uses official IGN inverse transformation parameters
   * @param x X coordinate in Lambert93 (meters)
   * @param y Y coordinate in Lambert93 (meters)
   * @returns [lat, lon] coordinates in WGS84 (decimal degrees)
   */
  lambert93ToWgs84(x: number, y: number): [number, number] {
    const params = this.LAMBERT93_PARAMS;
    
    // Convert to radians for calculation
    const lat0Rad = params.lat0 * Math.PI / 180;
    const lon0Rad = params.lon0 * Math.PI / 180;
    const lat1Rad = params.lat1 * Math.PI / 180;
    const lat2Rad = params.lat2 * Math.PI / 180;

    // Calculate ellipsoid parameters
    const e = Math.sqrt(params.e2);
    const e2 = params.e2;

    // Calculate m and t values for standard parallels
    const m1 = this.calculateM(lat1Rad, e2);
    const m2 = this.calculateM(lat2Rad, e2);
    const t1 = this.calculateT(lat1Rad, e);
    const t2 = this.calculateT(lat2Rad, e);
    const t0 = this.calculateT(lat0Rad, e);

    // Calculate projection constants
    const n = Math.log(m1 / m2) / Math.log(t1 / t2);
    const F = m1 / (n * Math.pow(t1, n));
    const rho0 = params.a * F * Math.pow(t0, n);

    // Calculate inverse projection
    const dx = x - params.x0;
    const dy = params.y0 + rho0 - y;
    const rho = Math.sqrt(dx * dx + dy * dy) * Math.sign(n);
    const theta = Math.atan2(dx, dy);

    // Calculate isometric latitude
    const t = Math.pow(rho / (params.a * F), 1 / n);
    
    // Calculate longitude
    const lon = lon0Rad + theta / n;

    // Calculate latitude using iterative method
    let lat = this.calculateLatFromT(t, e);

    // Convert back to degrees
    const latDeg = lat * 180 / Math.PI;
    const lonDeg = lon * 180 / Math.PI;

    console.log(`🎯 Precise Lambert93→WGS84: [${x.toFixed(2)}, ${y.toFixed(2)}] → [${latDeg}, ${lonDeg}]`);
    
    return [latDeg, lonDeg];
  }

  /**
   * Calculate the m parameter (reduced latitude function)
   */
  private calculateM(lat: number, e2: number): number {
    const sinLat = Math.sin(lat);
    return Math.cos(lat) / Math.sqrt(1 - e2 * sinLat * sinLat);
  }

  /**
   * Calculate the t parameter (isometric latitude function)
   */
  private calculateT(lat: number, e: number): number {
    const sinLat = Math.sin(lat);
    const eSinLat = e * sinLat;
    return Math.tan(Math.PI / 4 - lat / 2) / Math.pow((1 - eSinLat) / (1 + eSinLat), e / 2);
  }

  /**
   * Calculate latitude from isometric latitude parameter using iterative method
   */
  private calculateLatFromT(t: number, e: number): number {
    let lat = Math.PI / 2 - 2 * Math.atan(t);
    
    // Iterative calculation for precision
    for (let i = 0; i < 10; i++) {
      const sinLat = Math.sin(lat);
      const eSinLat = e * sinLat;
      const newLat = Math.PI / 2 - 2 * Math.atan(t * Math.pow((1 - eSinLat) / (1 + eSinLat), e / 2));
      
      if (Math.abs(newLat - lat) < 1e-12) break;
      lat = newLat;
    }
    
    return lat;
  }

  /**
   * Utility method to convert coordinate bounds from WGS84 to Lambert93
   * @param topLeft [lat, lon] of top-left corner
   * @param bottomRight [lat, lon] of bottom-right corner
   * @returns Object with Lambert93 bounds
   */
  convertBounds(topLeft: [number, number], bottomRight: [number, number]) {
    const [topLeftX, topLeftY] = this.wgs84ToLambert93(topLeft[0], topLeft[1]);
    const [bottomRightX, bottomRightY] = this.wgs84ToLambert93(bottomRight[0], bottomRight[1]);
    
    return {
      xMin: Math.min(topLeftX, bottomRightX),
      xMax: Math.max(topLeftX, bottomRightX),
      yMin: Math.min(topLeftY, bottomRightY),
      yMax: Math.max(topLeftY, bottomRightY),
      topLeft: `${topLeftY},${topLeftX}`,
      bottomRight: `${bottomRightY},${bottomRightX}`
    };
  }

  /**
   * Validate if coordinates are within France bounds
   */
  isValidFrenchCoordinates(lat: number, lon: number): boolean {
    // Metropolitan France bounds (approximate)
    const FRANCE_BOUNDS = {
      latMin: 41.0,
      latMax: 52.0,
      lonMin: -5.0,
      lonMax: 10.0
    };

    return lat >= FRANCE_BOUNDS.latMin && lat <= FRANCE_BOUNDS.latMax &&
           lon >= FRANCE_BOUNDS.lonMin && lon <= FRANCE_BOUNDS.lonMax;
  }
}
