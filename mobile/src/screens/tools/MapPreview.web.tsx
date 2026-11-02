import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Card, Sub } from '../../ui/kit';

export interface MapPlace { id: string; name: string; lat: number; lon: number }

/** The web preview has no native map; react-native-maps is never imported here. */
export default function MapPreview({ style }: { center: { lat: number; lon: number }; places: MapPlace[]; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={[{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }, style]}>
      <Sub>網頁預覽不支援地圖，請在手機上查看。</Sub>
    </Card>
  );
}
