import { formatarCep } from './cep';
import { normalizarTexto } from './municipio';
import type { Municipio } from './types';

export interface EnderecoPorCoordenadas {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
}

const cacheGeo = new Map<string, { lat: number; lng: number } | null>();

const UF_ESTADO: Record<string, string> = {
  AC: 'acre',
  AL: 'alagoas',
  AP: 'amapa',
  AM: 'amazonas',
  BA: 'bahia',
  CE: 'ceara',
  DF: 'distrito federal',
  ES: 'espirito santo',
  GO: 'goias',
  MA: 'maranhao',
  MT: 'mato grosso',
  MS: 'mato grosso do sul',
  MG: 'minas gerais',
  PA: 'para',
  PB: 'paraiba',
  PR: 'parana',
  PE: 'pernambuco',
  PI: 'piaui',
  RJ: 'rio de janeiro',
  RN: 'rio grande do norte',
  RS: 'rio grande do sul',
  RO: 'rondonia',
  RR: 'roraima',
  SC: 'santa catarina',
  SP: 'sao paulo',
  SE: 'sergipe',
  TO: 'tocantins',
};

export function distanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h =
    s1 * s1 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatarKm(km: number) {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km`;
}

export async function geocodificarCidade(
  cidade: string,
  uf?: string | null
): Promise<{ lat: number; lng: number } | null> {
  const chave = `${normalizarTexto(cidade)}|${(uf ?? '').trim().toUpperCase()}`;
  if (cacheGeo.has(chave)) return cacheGeo.get(chave) ?? null;
  if (!cidade.trim()) {
    cacheGeo.set(chave, null);
    return null;
  }

  const url =
    'https://geocoding-api.open-meteo.com/v1/search?name=' +
    encodeURIComponent(cidade.trim()) +
    '&count=8&language=pt&format=json';

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) {
      cacheGeo.set(chave, null);
      return null;
    }
    const dados = (await resposta.json()) as {
      results?: {
        name: string;
        latitude: number;
        longitude: number;
        country_code?: string;
        admin1?: string;
      }[];
    };

    const ufNorm = uf?.trim().toUpperCase() ?? '';
    const estado = ufNorm ? UF_ESTADO[ufNorm] : '';
    const cidadeNorm = normalizarTexto(cidade);

    const doBrasil = (dados.results ?? []).filter((r) => (r.country_code ?? 'BR') === 'BR');
    const escolhido =
      doBrasil.find(
        (r) =>
          normalizarTexto(r.name) === cidadeNorm &&
          (!estado || normalizarTexto(r.admin1 ?? '') === estado)
      ) ??
      doBrasil.find((r) => normalizarTexto(r.name) === cidadeNorm) ??
      doBrasil[0];

    const ponto = escolhido ? { lat: escolhido.latitude, lng: escolhido.longitude } : null;
    cacheGeo.set(chave, ponto);
    return ponto;
  } catch {
    cacheGeo.set(chave, null);
    return null;
  }
}

export async function encontrarContratanteMaisProximo(
  origem: { lat: number; lng: number } | { cidade: string; uf?: string | null },
  municipios: Municipio[]
): Promise<{ municipio: Municipio; km: number } | null> {
  if (municipios.length === 0) return null;

  const pontoOrigem =
    'lat' in origem ? origem : await geocodificarCidade(origem.cidade, origem.uf);
  if (!pontoOrigem) return null;

  const avaliadas: { municipio: Municipio; km: number }[] = [];
  for (const municipio of municipios) {
    const ponto = await geocodificarCidade(municipio.cidade, municipio.uf);
    if (!ponto) continue;
    avaliadas.push({ municipio, km: distanciaKm(pontoOrigem, ponto) });
  }

  avaliadas.sort((a, b) => a.km - b.km);
  return avaliadas[0] ?? null;
}

export const encontrarPrefeituraMaisProxima = encontrarContratanteMaisProximo;

export async function geocodificarEndereco(opcoes: {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  cidade: string;
  uf?: string | null;
}): Promise<{ lat: number; lng: number } | null> {
  const rua = [opcoes.numero?.trim(), opcoes.logradouro?.trim()].filter(Boolean).join(' ');
  if (rua) {
    const nominatim = await buscarNominatimEndereco({
      street: rua,
      cidade: opcoes.cidade,
      uf: opcoes.uf,
      cep: opcoes.cep,
    });
    if (nominatim) return nominatim;
  }

  const cepDigitos = (opcoes.cep ?? '').replace(/\D/g, '');
  if (cepDigitos.length === 8) {
    const brasil = await buscarBrasilApiCep(cepDigitos);
    if (brasil) return brasil;
  }

  return buscarNominatimEndereco({
    street: opcoes.logradouro?.trim() || undefined,
    cidade: opcoes.cidade,
    uf: opcoes.uf,
    cep: opcoes.cep,
  });
}

async function buscarBrasilApiCep(cep: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as {
      location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
    };
    const lat = Number(dados.location?.coordinates?.latitude);
    const lng = Number(dados.location?.coordinates?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function buscarNominatimEndereco(opcoes: {
  street?: string;
  cidade: string;
  uf?: string | null;
  cep?: string | null;
}): Promise<{ lat: number; lng: number } | null> {
  try {
    const cep = (opcoes.cep ?? '').replace(/\D/g, '');
    const params = [
      'format=json',
      'limit=1',
      `country=${encodeURIComponent('Brazil')}`,
      `city=${encodeURIComponent(opcoes.cidade)}`,
    ];
    if (opcoes.uf) params.push(`state=${encodeURIComponent(opcoes.uf)}`);
    if (opcoes.street) params.push(`street=${encodeURIComponent(opcoes.street)}`);
    if (cep.length === 8) params.push(`postalcode=${cep}`);

    const resposta = await fetch(`https://nominatim.openstreetmap.org/search?${params.join('&')}`, {
      headers: { 'Accept-Language': 'pt-BR' },
    });
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as { lat: string; lon: string }[];
    if (!dados[0]) return null;
    return { lat: Number(dados[0].lat), lng: Number(dados[0].lon) };
  } catch {
    return null;
  }
}

function ufDoEstado(valor?: string | null) {
  const n = normalizarTexto(valor ?? '').replace(/^br-/, '');
  if (/^[a-z]{2}$/.test(n)) return n.toUpperCase();
  const encontrado = Object.entries(UF_ESTADO).find(([, nome]) => nome === n);
  return encontrado?.[0] ?? '';
}

/**
 * Converte lat/lng no mesmo conjunto de campos do ViaCEP (rua, número, bairro, cidade, UF, CEP).
 */
export async function buscarEnderecoPorCoordenadas(
  lat: number,
  lng: number
): Promise<EnderecoPorCoordenadas> {
  const nominatim = await buscarNominatim(lat, lng);
  if (nominatim?.cidade) return nominatim;

  const nuvem = await buscarBigDataCloud(lat, lng);
  if (nuvem?.cidade) return nuvem;

  throw new Error('Não foi possível preencher o endereço pela localização. Use o CEP.');
}

async function buscarNominatim(lat: number, lng: number): Promise<EnderecoPorCoordenadas | null> {
  try {
    const resposta = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as {
      address?: {
        road?: string;
        pedestrian?: string;
        house_number?: string;
        suburb?: string;
        neighbourhood?: string;
        quarter?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        state_code?: string;
        postcode?: string;
      };
    };
    const a = dados.address;
    if (!a) return null;
    const cidade = a.city || a.town || a.village || a.municipality || '';
    if (!cidade) return null;
    return {
      cep: a.postcode ? formatarCep(a.postcode) : '',
      logradouro: a.road || a.pedestrian || '',
      numero: a.house_number || '',
      bairro: a.suburb || a.neighbourhood || a.quarter || '',
      cidade,
      uf: ufDoEstado(a.state_code || a.state),
    };
  } catch {
    return null;
  }
}

async function buscarBigDataCloud(lat: number, lng: number): Promise<EnderecoPorCoordenadas | null> {
  try {
    const resposta = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`
    );
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as {
      city?: string;
      locality?: string;
      postcode?: string;
      principalSubdivision?: string;
      principalSubdivisionCode?: string;
    };
    const cidade = dados.city || dados.locality || '';
    if (!cidade) return null;
    return {
      cep: dados.postcode ? formatarCep(dados.postcode) : '',
      logradouro: '',
      numero: '',
      bairro: dados.locality && dados.locality !== cidade ? dados.locality : '',
      cidade,
      uf: ufDoEstado(dados.principalSubdivisionCode || dados.principalSubdivision),
    };
  } catch {
    return null;
  }
}
