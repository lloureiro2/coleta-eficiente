export function somenteDigitosTelefone(valor: string) {
  return valor.replace(/\D/g, '').slice(0, 11);
}

export function formatarTelefone(valor: string) {
  const digitos = somenteDigitosTelefone(valor);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function telefoneValido(valor: string) {
  const digitos = somenteDigitosTelefone(valor);
  if (digitos.length !== 10 && digitos.length !== 11) return false;
  const ddd = Number(digitos.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
}

export function mensagemTelefoneInvalido(valor: string) {
  if (telefoneValido(valor)) return null;
  return 'Informe o telefone com DDD, no formato (00) 00000-0000.';
}
