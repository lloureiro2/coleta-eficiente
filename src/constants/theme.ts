import { Platform } from 'react-native';

export const Cores = {
  primaria: '#16A34A',
  primariaEscura: '#15803D',
  primariaClara: '#DCFCE7',
  fundo: '#F4F7F4',
  cartao: '#FFFFFF',
  borda: '#E3E9E3',
  texto: '#182420',
  textoSecundario: '#5C6B60',
  perigo: '#DC2626',
  perigoClaro: '#FEE2E2',
  alerta: '#D97706',
  alertaClaro: '#FEF3C7',
  info: '#2563EB',
  infoClaro: '#DBEAFE',
  neutro: '#6B7280',
  neutroClaro: '#F3F4F6',
} as const;

export const Fontes = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  web: { sans: 'var(--font-display)', mono: 'var(--font-mono)' },
  default: { sans: 'normal', mono: 'monospace' },
});

export const Espaco = {
  xs: 4,
  s: 8,
  m: 16,
  g: 24,
  xg: 32,
} as const;

export const Raio = {
  s: 8,
  m: 12,
  g: 16,
} as const;

export const LarguraMaxima = 720;
