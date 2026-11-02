import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { C } from '../../ui/theme';
import { validCoord } from '../../lib/life';

export interface MapPlace { id: string; name: string; lat: number; lon: number }

/**
 * Map of the user's position and nearby results (native only; see MapPreview.web.tsx).
 * Zooms to fit every marker whenever the results change. Pass `style={{ flex: 1 }}` to fill the screen.
 */
export default function MapPreview({ center, places, style }: { center: { lat: number; lon: number }; places: MapPlace[]; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<MapView>(null);
  const pts = useMemo(() => places.filter((p) => validCoord(p.lat, p.lon)), [places]);
  const fit = useCallback(() => {
    const coords = [center, ...pts].map((p) => ({ latitude: p.lat, longitude: p.lon }));
    if (coords.length < 2) {
      ref.current?.animateToRegion({ latitude: center.lat, longitude: center.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 0);
      return;
    }
    ref.current?.fitToCoordinates(coords, { edgePadding: { top: 60, right: 40, bottom: 40, left: 40 }, animated: false });
  }, [center, pts]);
  useEffect(() => { fit(); }, [fit]);
  return (
    <View style={[{ height: 320, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: C.line }, style]}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={{ latitude: center.lat, longitude: center.lon, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        onMapReady={fit}
      >
        <Marker coordinate={{ latitude: center.lat, longitude: center.lon }} title="你的位置" anchor={{ x: 0.5, y: 0.5 }} zIndex={10}>
          <View accessibilityLabel="你的位置" style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#2F6FED', borderWidth: 3, borderColor: '#fff' }} />
        </Marker>
        {pts.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lon }} title={p.name} pinColor={C.accent} />
        ))}
      </MapView>
      {!pts.length ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 10, right: 10, padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)' }}>
          <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center' }}>這個範圍內沒有可顯示的地點</Text>
        </View>
      ) : null}
    </View>
  );
}
