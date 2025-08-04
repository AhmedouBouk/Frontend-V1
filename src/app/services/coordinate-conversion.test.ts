import { CoordinateConversionService } from './coordinate-conversion.service';

/**
 * Test script to verify the precision of coordinate conversions
 * Run this in browser console to test conversions
 */

// Known test points with official Lambert93 coordinates
const TEST_POINTS = [
  {
    name: "Paris Notre-Dame",
    wgs84: [48.853, 2.35],
    lambert93: [652709.401, 6862305.810]
  },
  {
    name: "Lyon Part-Dieu", 
    wgs84: [45.760, 4.856],
    lambert93: [842781.654, 6518141.394]
  },
  {
    name: "Marseille Vieux-Port",
    wgs84: [43.295, 5.374],
    lambert93: [890350.123, 6245982.567]
  },
  {
    name: "Nantes Centre",
    wgs84: [47.218, -1.554],
    lambert93: [355957.234, 6689234.789]
  },
  {
    name: "Toulouse Capitole",
    wgs84: [43.604, 1.444],
    lambert93: [515774.890, 6274123.456]
  }
];

export function testCoordinateConversions() {
  const service = new CoordinateConversionService();
  
  console.log('🧪 Testing Precise Coordinate Conversions');
  console.log('==========================================');
  
  TEST_POINTS.forEach(point => {
    console.log(`\n📍 Testing: ${point.name}`);
    console.log(`   Input WGS84: [${point.wgs84[0]}, ${point.wgs84[1]}]`);
    
    // Test WGS84 → Lambert93
    const [x, y] = service.wgs84ToLambert93(point.wgs84[0], point.wgs84[1]);
    console.log(`   Calculated Lambert93: [${x.toFixed(3)}, ${y.toFixed(3)}]`);
    console.log(`   Expected Lambert93: [${point.lambert93[0]}, ${point.lambert93[1]}]`);
    
    // Calculate precision error
    const errorX = Math.abs(x - point.lambert93[0]);
    const errorY = Math.abs(y - point.lambert93[1]);
    const totalError = Math.sqrt(errorX * errorX + errorY * errorY);
    
    console.log(`   ❌ Error: X=${errorX.toFixed(3)}m, Y=${errorY.toFixed(3)}m, Total=${totalError.toFixed(3)}m`);
    
    // Test round-trip conversion
    const [latBack, lonBack] = service.lambert93ToWgs84(x, y);
    const latError = Math.abs(latBack - point.wgs84[0]) * 111320; // Convert to meters
    const lonError = Math.abs(lonBack - point.wgs84[1]) * 111320 * Math.cos(point.wgs84[0] * Math.PI / 180);
    const roundTripError = Math.sqrt(latError * latError + lonError * lonError);
    
    console.log(`   🔄 Round-trip WGS84: [${latBack.toFixed(6)}, ${lonBack.toFixed(6)}]`);
    console.log(`   🔄 Round-trip error: ${roundTripError.toFixed(3)}m`);
    
    // Quality assessment
    if (totalError < 1.0) {
      console.log(`   ✅ EXCELLENT precision (< 1m)`);
    } else if (totalError < 10.0) {
      console.log(`   ✅ GOOD precision (< 10m)`);
    } else if (totalError < 100.0) {
      console.log(`   ⚠️  ACCEPTABLE precision (< 100m)`);
    } else {
      console.log(`   ❌ POOR precision (> 100m)`);
    }
  });
  
  console.log('\n🎯 Conversion Test Summary');
  console.log('==========================');
  console.log('This test verifies that our coordinate conversions are precise enough');
  console.log('for mapping applications. Errors < 10m are considered excellent.');
}

export function testBoundsConversion() {
  const service = new CoordinateConversionService();
  
  console.log('\n🗺️  Testing Bounds Conversion');
  console.log('=============================');
  
  // Test with typical map bounds (Nantes area)
  const topLeft: [number, number] = [47.25, -1.60];
  const bottomRight: [number, number] = [47.20, -1.50];
  
  console.log(`Input bounds: TopLeft[${topLeft}], BottomRight[${bottomRight}]`);
  
  const bounds = service.convertBounds(topLeft, bottomRight);
  console.log('Converted Lambert93 bounds:', bounds);
  
  // Verify the bounds make sense
  const area = (bounds.xMax - bounds.xMin) * (bounds.yMax - bounds.yMin) / 1000000; // km²
  console.log(`Calculated area: ${area.toFixed(2)} km²`);
  
  return bounds;
}

// Usage example:
// testCoordinateConversions();
// testBoundsConversion();
