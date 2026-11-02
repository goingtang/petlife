import React from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { C } from '../../ui/theme';

export interface MapPlace { id: string; name: string; lat: number; lon: number }

/** Map of the user's position and nearby results (native only; see MapPreview.web.tsx). */
export default function MapPreview({ center, places }: { center: { lat: number; lon: number }; places: MapPlace[] }) {
  const pts = [center, ...places];
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const latDelta = Math.max(0.01, (Math.max(...lats) - Math.min(...lats)) * 1.3);
  const lonDelta = Math.max(0.01, (Math.max(...lons) - Math.min(...lons)) * 1.3);
  return (
    <View style={{ height: 320, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: C.line }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ latitude: center.lat, longitude: center.lon, latitudeDelta: latDelta, longitudeDelta: lonDelta }}
        showsUserLocation
      >
        <Marker coordinate={{ latitude: center.lat, longitude: center.lon }} title="你的位置" pinColor={C.ink} />
        {places.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lon }} title={p.name} pinColor={C.accent} />
        ))}
      </MapView>
    </View>
  );
}
