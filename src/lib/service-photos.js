// Fotos dos serviços: bucket privado + tabela `servicos_fotos`.
// Caminho no storage: {conta_id}/{servico_id}/{arquivo}. As políticas do
// bucket usam a primeira pasta para isolar as fotos por conta.

export const SERVICE_PHOTOS_BUCKET = "servicos-fotos";
export const MAX_SERVICE_PHOTOS = 30;
export const MAX_PHOTO_SOURCE_SIZE = 25 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";

const MAX_DIMENSION = 2400;
const JPEG_QUALITY = 0.85;
const SIGNED_URL_TTL = 60 * 60;

function uploadSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isHeic(file) {
  return /image\/hei[cf]/i.test(file?.type || "") || /\.hei[cf]$/i.test(file?.name || "");
}

/**
 * Reduz fotos grandes de celular para no máximo 2400px em JPEG.
 * HEIC só é aceito se o navegador conseguir converter (Safari).
 */
export async function prepareServicePhoto(file) {
  if (!file) throw new Error("Arquivo inválido.");

  if (!/^image\//i.test(file.type || "") && !isHeic(file)) {
    throw new Error(`${file.name}: envie apenas imagens.`);
  }

  if (file.size > MAX_PHOTO_SOURCE_SIZE) {
    throw new Error(`${file.name}: a imagem passa de 25 MB.`);
  }

  const small = file.size <= 1.5 * 1024 * 1024 && !isHeic(file);

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (isHeic(file)) {
      throw new Error(`${file.name}: este navegador não converte HEIC. Envie a foto em JPG.`);
    }
    if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: a imagem passa de 10 MB.`);
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

  if (small && scale === 1) {
    bitmap.close?.();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) return file;

  const baseName = String(file.name || "foto").replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Lista as fotos de um serviço com URLs assinadas (1 hora).
 */
export async function listServicePhotos(supabase, { contaId, serviceId }) {
  if (!contaId || !serviceId) return [];

  const { data, error } = await supabase
    .from("servicos_fotos")
    .select("id,servico_id,storage_path,nome_arquivo,tamanho_bytes,created_at")
    .eq("conta_id", contaId)
    .eq("servico_id", serviceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data?.length) return [];

  const { data: signed, error: signError } = await supabase.storage
    .from(SERVICE_PHOTOS_BUCKET)
    .createSignedUrls(
      data.map((photo) => photo.storage_path),
      SIGNED_URL_TTL
    );

  if (signError) throw signError;

  const urlByPath = new Map((signed || []).map((item) => [item.path, item.signedUrl]));

  return data.map((photo) => ({
    ...photo,
    url: urlByPath.get(photo.storage_path) || null,
  }));
}

/**
 * Envia fotos para um serviço já salvo. Retorna quantas subiram e os erros.
 */
export async function uploadServicePhotos(supabase, { contaId, serviceId, usuarioId, files }) {
  const result = { uploaded: 0, errors: [] };

  for (const original of files) {
    let path = null;

    try {
      const file = await prepareServicePhoto(original);
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      path = `${contaId}/${serviceId}/${uploadSuffix()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(SERVICE_PHOTOS_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("servicos_fotos").insert({
        conta_id: contaId,
        servico_id: serviceId,
        storage_path: path,
        nome_arquivo: original.name || null,
        tamanho_bytes: file.size,
        created_by: usuarioId || null,
      });

      if (insertError) {
        await supabase.storage.from(SERVICE_PHOTOS_BUCKET).remove([path]);
        throw insertError;
      }

      result.uploaded += 1;
    } catch (error) {
      console.warn("Foto do serviço não enviada", error);
      result.errors.push(error?.message || `${original?.name || "Foto"}: falha no envio.`);
    }
  }

  return result;
}

/**
 * Remove fotos (registro + arquivo). Aceita objetos com `id` e `storage_path`.
 */
export async function deleteServicePhotos(supabase, { contaId, photos }) {
  if (!photos?.length) return;

  const { error } = await supabase
    .from("servicos_fotos")
    .delete()
    .eq("conta_id", contaId)
    .in(
      "id",
      photos.map((photo) => photo.id)
    );

  if (error) throw error;

  const { error: storageError } = await supabase.storage
    .from(SERVICE_PHOTOS_BUCKET)
    .remove(photos.map((photo) => photo.storage_path));

  if (storageError) console.warn("Arquivos de foto não removidos", storageError);
}

/**
 * Remove os arquivos de um serviço do storage. Os registros saem em cascata
 * quando o serviço é excluído.
 */
export async function removeAllServicePhotoFiles(supabase, { contaId, serviceId }) {
  if (!contaId || !serviceId) return;

  try {
    const folder = `${contaId}/${serviceId}`;
    const { data, error } = await supabase.storage.from(SERVICE_PHOTOS_BUCKET).list(folder, { limit: 1000 });
    if (error) throw error;
    if (!data?.length) return;

    await supabase.storage
      .from(SERVICE_PHOTOS_BUCKET)
      .remove(data.map((item) => `${folder}/${item.name}`));
  } catch (error) {
    console.warn("Fotos do serviço não removidas do storage", error);
  }
}

/* ---------------------------------------------------------
   Rascunho do formulário
   added: [{ key, file, previewUrl }]  ·  removed: [{ id, storage_path }]
   --------------------------------------------------------- */

export function createPhotoDraft() {
  return { added: [], removed: [] };
}

export function releasePhotoDraft(draft) {
  draft?.added?.forEach((item) => URL.revokeObjectURL(item.previewUrl));
}

export function hasPhotoChanges(draft) {
  return Boolean(draft?.added?.length || draft?.removed?.length);
}

export async function applyPhotoDraft(supabase, { contaId, serviceId, usuarioId, draft }) {
  const errors = [];
  let uploaded = 0;

  if (draft?.removed?.length) {
    try {
      await deleteServicePhotos(supabase, { contaId, photos: draft.removed });
    } catch (error) {
      errors.push(error?.message || "Não foi possível remover algumas fotos.");
    }
  }

  if (draft?.added?.length) {
    const result = await uploadServicePhotos(supabase, {
      contaId,
      serviceId,
      usuarioId,
      files: draft.added.map((item) => item.file),
    });
    uploaded = result.uploaded;
    errors.push(...result.errors);
  }

  return { uploaded, errors };
}
