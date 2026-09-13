export interface PontoMapa {
  id: string;
  latitude: number;
  longitude: number;
  titulo?: string;
  cor?: string | null;
  /** Rótulo curto exibido no pino (ex.: número da parada na rota). */
  rotulo?: string;
}

export interface CoordenadaLinha {
  latitude: number;
  longitude: number;
}

export interface PropsMapaPontos {
  pontos: PontoMapa[];
  altura?: number;
  aoTocar?: (id: string) => void;
  linha?: CoordenadaLinha[];
  /** Toque no mapa para escolher/ajustar um ponto (ex.: precisar o endereço do CEP). */
  aoEscolherCoordenada?: (latitude: number, longitude: number) => void;
  /** Círculo de área aproximada, em metros (CEP sem número). */
  raioMetros?: number;
}
