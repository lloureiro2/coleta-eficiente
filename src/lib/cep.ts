export interface EnderecoCep {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export function somenteDigitosCep(valor: string) {
  return valor.replace(/\D/g, '').slice(0, 8);
}

export function formatarCep(valor: string) {
  const digitos = somenteDigitosCep(valor);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoCep> {
  const digitos = somenteDigitosCep(cep);
  if (digitos.length !== 8) {
    throw new Error('Informe um CEP com 8 dígitos.');
  }

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (resposta.ok) {
      const dados = (await resposta.json()) as {
        erro?: boolean;
        cep?: string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (!dados.erro && dados.localidade && dados.uf) {
        return {
          cep: formatarCep(dados.cep ?? digitos),
          logradouro: dados.logradouro ?? '',
          bairro: dados.bairro ?? '',
          cidade: dados.localidade,
          uf: dados.uf,
        };
      }
    }
  } catch {
    // Tenta a BrasilAPI abaixo.
  }

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cep/v1/${digitos}`);
    if (resposta.ok) {
      const dados = (await resposta.json()) as {
        cep?: string;
        street?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
      };
      if (dados.city && dados.state) {
        return {
          cep: formatarCep(dados.cep ?? digitos),
          logradouro: dados.street ?? '',
          bairro: dados.neighborhood ?? '',
          cidade: dados.city,
          uf: dados.state,
        };
      }
    }
  } catch {
    // Mensagem única abaixo.
  }

  throw new Error('Não foi possível consultar o CEP. Confira o número e tente de novo.');
}
