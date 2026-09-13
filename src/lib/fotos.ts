import { decode } from 'base64-arraybuffer';

import { supabase } from './supabase';

/**
 * Envia uma foto (base64) para o bucket "fotos" do Supabase Storage
 * e devolve a URL pública. Lança erro se o envio falhar.
 */
export async function enviarFoto(base64: string, mimeType = 'image/jpeg'): Promise<string> {
  const extensao = mimeType.split('/')[1] ?? 'jpg';
  const caminho = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;

  const { error } = await supabase.storage
    .from('fotos')
    .upload(caminho, decode(base64), { contentType: mimeType });

  if (error) {
    throw new Error(error.message);
  }
  return supabase.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}
