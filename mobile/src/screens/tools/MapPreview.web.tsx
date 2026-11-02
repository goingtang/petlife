import React from 'react';
import { Card, Sub } from '../../ui/kit';

export interface MapPlace { id: string; name: string; lat: number; lon: number }

/** The web preview has no native map; react-native-maps is never imported here. */
export default function MapPreview(_: { center: { lat: number; lon: number }; places: MapPlace[] }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <Sub>網頁預覽不支援地圖，請在手機上查看。</Sub>
    </Card>
  );
}
