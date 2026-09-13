import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

import { Cores } from '@/constants/theme';
import type { PropsMapaPontos } from './mapa-pontos.types';

/** Mapa web com Leaflet + OpenStreetMap (sem custo de API). */
export default function MapaPontos({
  pontos,
  altura = 260,
  aoTocar,
  linha,
  aoEscolherCoordenada,
  raioMetros,
}: PropsMapaPontos) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const camadaRef = useRef<L.LayerGroup | null>(null);
  const visaoRef = useRef('');
  const aoTocarRef = useRef(aoTocar);
  const aoEscolherRef = useRef(aoEscolherCoordenada);
  aoTocarRef.current = aoTocar;
  aoEscolherRef.current = aoEscolherCoordenada;

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const existente = el as HTMLDivElement & { _leaflet_id?: number };
    if (existente._leaflet_id) {
      existente._leaflet_id = undefined;
      el.innerHTML = '';
    }

    const mapa = L.map(el, { zoomControl: true }).setView([-20.3155, -40.3128], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);
    camadaRef.current = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;

    const aoClicar = (evento: L.LeafletMouseEvent) => {
      aoEscolherRef.current?.(evento.latlng.lat, evento.latlng.lng);
    };
    mapa.on('click', aoClicar);

    const tamanho = window.setTimeout(() => {
      mapa.invalidateSize();
    }, 80);

    return () => {
      window.clearTimeout(tamanho);
      mapa.off('click', aoClicar);
      mapa.remove();
      mapaRef.current = null;
      camadaRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    const camada = camadaRef.current;
    if (!mapa || !camada) return;

    camada.clearLayers();
    const validos = pontos.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

    if (raioMetros && validos[0]) {
      L.circle([validos[0].latitude, validos[0].longitude], {
        radius: raioMetros,
        color: Cores.primaria,
        weight: 1,
        fillColor: Cores.primaria,
        fillOpacity: 0.15,
      }).addTo(camada);
    }

    if (linha && linha.length > 1) {
      L.polyline(
        linha.map((p) => [p.latitude, p.longitude] as [number, number]),
        { color: Cores.primaria, weight: 4, opacity: 0.8 }
      ).addTo(camada);
    }

    validos.forEach((p) => {
      const cor = p.cor ?? Cores.primaria;
      const arrastavel = !!aoEscolherRef.current && !p.rotulo;
      let marcador: L.Layer;
      if (p.rotulo) {
        marcador = L.marker([p.latitude, p.longitude], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:${cor};color:#fff;border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.4)">${p.rotulo}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        });
      } else if (arrastavel) {
        marcador = L.marker([p.latitude, p.longitude], {
          draggable: true,
          autoPan: true,
          icon: L.divIcon({
            className: '',
            html: `<div style="width:28px;height:28px;margin-left:-2px;cursor:grab">
              <div style="background:${cor};border:3px solid #fff;border-radius:50%;width:22px;height:22px;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>
              <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid ${cor};margin:-2px auto 0"></div>
            </div>`,
            iconSize: [28, 36],
            iconAnchor: [14, 34],
          }),
        });
        marcador.on('dragend', (evento) => {
          const posicao = (evento.target as L.Marker).getLatLng();
          aoEscolherRef.current?.(posicao.lat, posicao.lng);
        });
      } else {
        marcador = L.circleMarker([p.latitude, p.longitude], {
          radius: 10,
          weight: 2,
          color: '#ffffff',
          fillColor: cor,
          fillOpacity: 1,
        });
      }
      if (p.titulo) (marcador as L.Marker).bindTooltip(p.titulo);
      marcador.on('click', () => aoTocarRef.current?.(p.id));
      marcador.addTo(camada);
    });

    const coordenadas: [number, number][] = [
      ...validos.map((p) => [p.latitude, p.longitude] as [number, number]),
      ...(linha ?? []).map((p) => [p.latitude, p.longitude] as [number, number]),
    ];
    const primeiro = validos[0];
    const chaveVisao = aoEscolherRef.current
      ? `${validos.length}|${raioMetros ?? 0}|${primeiro ? primeiro.latitude.toFixed(2) : ''}|${primeiro ? primeiro.longitude.toFixed(2) : ''}`
      : `${validos.map((p) => `${p.id}:${p.latitude}:${p.longitude}`).join(';')}|${raioMetros ?? 0}`;
    const ajustarVisao = chaveVisao !== visaoRef.current;
    if (ajustarVisao) visaoRef.current = chaveVisao;

    if (coordenadas.length > 0 && ajustarVisao) {
      const zoom = aoEscolherRef.current ? (raioMetros ? 16 : 17) : undefined;
      const aplicar = () => {
        try {
          mapa.invalidateSize();
          if (aoEscolherRef.current && validos[0]) {
            mapa.setView([validos[0].latitude, validos[0].longitude], zoom ?? 16, { animate: false });
          } else if (raioMetros && validos[0]) {
            const circulo = L.circle([validos[0].latitude, validos[0].longitude], { radius: raioMetros });
            mapa.fitBounds(circulo.getBounds(), { padding: [24, 24], maxZoom: 16 });
          } else {
            mapa.fitBounds(L.latLngBounds(coordenadas), { padding: [40, 40], maxZoom: 17 });
          }
        } catch {
          // container ainda sem tamanho
        }
      };
      aplicar();
      window.setTimeout(aplicar, 120);
    }
  }, [pontos, linha, raioMetros]);

  return (
    <div
      ref={divRef}
      style={{ height: altura, width: '100%', borderRadius: 16, overflow: 'hidden', zIndex: 0 }}
    />
  );
}
