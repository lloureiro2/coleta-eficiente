import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';

import { Cores, Raio } from '@/constants/theme';
import type { PontoMapa, PropsMapaPontos } from './mapa-pontos.types';

function chaveVisaoAtual(pontos: PontoMapa[], raioMetros?: number) {
  const primeiro = pontos[0];
  return `${pontos.length}|${raioMetros ?? 0}|${primeiro ? primeiro.latitude.toFixed(2) : ''}|${primeiro ? primeiro.longitude.toFixed(2) : ''}`;
}

/** Mapa nativo (iOS/Android) com pinos. A versão web usa Leaflet (mapa-pontos.web.tsx). */
export default function MapaPontos({
  pontos,
  altura = 260,
  aoTocar,
  linha,
  aoEscolherCoordenada,
  raioMetros,
}: PropsMapaPontos) {
  const mapaRef = useRef<MapView>(null);
  const visaoRef = useRef('');

  const validos = useMemo(
    () => pontos.filter((p) => p.latitude != null && p.longitude != null),
    [pontos]
  );

  useEffect(() => {
    const coordenadas = [
      ...validos.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      ...(linha ?? []),
    ];
    if (coordenadas.length === 0) return;
    if (aoEscolherCoordenada && visaoRef.current === chaveVisaoAtual(validos, raioMetros)) return;
    visaoRef.current = chaveVisaoAtual(validos, raioMetros);
    if (aoEscolherCoordenada && validos[0]) {
      const delta = raioMetros ? 0.004 : 0.0025;
      mapaRef.current?.animateToRegion(
        {
          latitude: validos[0].latitude,
          longitude: validos[0].longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        0
      );
      return;
    }
    if (raioMetros && validos[0]) {
      const delta = Math.max(0.004, (raioMetros / 111000) * 2);
      mapaRef.current?.animateToRegion(
        {
          latitude: validos[0].latitude,
          longitude: validos[0].longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        0
      );
      return;
    }
    mapaRef.current?.fitToCoordinates(coordenadas, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: false,
    });
  }, [validos, linha, raioMetros, aoEscolherCoordenada]);

  const inicial = validos[0];

  return (
    <View style={{ height: altura, borderRadius: Raio.g, overflow: 'hidden' }}>
      <MapView
        ref={mapaRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: inicial?.latitude ?? -15.78,
          longitude: inicial?.longitude ?? -47.93,
          latitudeDelta: inicial ? (raioMetros ? Math.max(0.008, (raioMetros / 111000) * 3) : 0.01) : 30,
          longitudeDelta: inicial ? (raioMetros ? Math.max(0.008, (raioMetros / 111000) * 3) : 0.01) : 30,
        }}
        onPress={
          aoEscolherCoordenada
            ? (evento) => {
                const { latitude, longitude } = evento.nativeEvent.coordinate;
                aoEscolherCoordenada(latitude, longitude);
              }
            : undefined
        }>
        {raioMetros && inicial ? (
          <Circle
            center={{ latitude: inicial.latitude, longitude: inicial.longitude }}
            radius={raioMetros}
            strokeColor={Cores.primaria}
            fillColor="rgba(22, 163, 74, 0.15)"
            strokeWidth={1}
          />
        ) : null}
        {linha && linha.length > 1 && (
          <Polyline coordinates={linha} strokeColor={Cores.primaria} strokeWidth={4} />
        )}
        {validos.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.rotulo ? `${p.rotulo}. ${p.titulo ?? ''}`.trim() : p.titulo}
            pinColor={p.cor ?? Cores.primaria}
            draggable={!!aoEscolherCoordenada}
            onCalloutPress={aoTocar ? () => aoTocar(p.id) : undefined}
            onDragEnd={
              aoEscolherCoordenada
                ? (evento) => {
                    const { latitude, longitude } = evento.nativeEvent.coordinate;
                    aoEscolherCoordenada(latitude, longitude);
                  }
                : undefined
            }
          />
        ))}
      </MapView>
    </View>
  );
}
