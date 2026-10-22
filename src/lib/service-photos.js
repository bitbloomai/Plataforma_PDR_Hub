// Fotos dos serviços: bucket privado + tabela `servicos_fotos`.
// Caminho no storage: {conta_id}/{servico_id}/{arquivo}. As políticas do
// bucket usam a primeira pasta para isolar as fotos por conta.

export const SERVICE_PHOTOS_BUCKET = "servicos-fotos";
export const MAX_SERVICE_PHOTOS = 30;
export const MAX_PHOTO_SOURCE_SIZE = 80 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";

const SIGNED_URL_TTL = 60 * 60;

/* =========================================================
   COMPRESSOR
   Pensado para fotos de iPhone (HEIC, 12–48 MP, 3–15 MB):
   - decodifica pelo <img> do navegador (Safari abre HEIC nativo);
     se não abrir, converte HEIC com `heic-to`, carregado só quando preciso;
   - redimensiona direto para o tamanho final, sem criar canvas gigante
     (o Safari do iPhone trava acima de ~16 MP de canvas);
   - grava em WebP (ou JPEG onde não houver WebP) buscando ~600 KB,
     baixando qualidade e depois resolução até caber;
   - remove os metadados EXIF (inclusive localização GPS).
   ========================================================= */

const MAX_DIMENSION = 2048;
const MIN_DIMENSION = 1280;
const TARGET_BYTES = 600 * 1024;
const SKIP_BYTES = 300 * 1024;
const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58];

// Arquivos que já passaram pelo compressor não são processados de novo.
const preparedFiles = new WeakSet();
let webpSupport = null;

function uploadSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isHeic(file) {
  return /image\/hei[cf]/i.test(file?.type || "") || /\.hei[cf]$/i.test(file?.name || "");
}

function baseName(file) {
  return String(file?.name || "foto").replace(/\.[^.]+$/, "") || "foto";
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function supportsWebp() {
  if (webpSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

function nextFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;

  try {
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Imagem vazia.");
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function decodePhoto(file) {
  try {
    return await loadImage(file);
  } catch (nativeError) {
    if (!isHeic(file)) throw nativeError;
  }

  // Chrome/Edge/Firefox não abrem HEIC: converte no navegador.
  const { heicTo } = await import("heic-to");
  const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  return loadImage(jpeg);
}

function encode(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function releaseCanvas(canvas) {
  // Libera a memória do canvas imediatamente no Safari do iPhone.
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Comprime uma foto para envio. Sempre retorna WebP ou JPEG.
 */
export async function prepareServicePhoto(file) {
  if (!file) throw new Error("Arquivo inválido.");
  if (preparedFiles.has(file)) return file;

  if (!/^image\//i.test(file.type || "") && !isHeic(file)) {
    throw new Error(`${file.name}: envie apenas imagens.`);
  }

  if (file.size > MAX_PHOTO_SOURCE_SIZE) {
    throw new Error(`${file.name}: a imagem passa de ${formatBytes(MAX_PHOTO_SOURCE_SIZE)}.`);
  }

  let decoded;
  try {
    decoded = await decodePhoto(file);
  } catch (error) {
    console.warn("Foto não decodificada", error);
    throw new Error(`${file.name}: não foi possível abrir esta imagem.`);
  }

  const { image, release } = decoded;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const longest = Math.max(width, height);

  // Foto já leve e pequena: só garante que não é HEIC/PNG pesado.
  if (
    file.size <= SKIP_BYTES &&
    longest <= MAX_DIMENSION &&
    /image\/(jpeg|webp)/i.test(file.type)
  ) {
    release();
    preparedFiles.add(file);
    return file;
  }

  const type = supportsWebp() ? "image/webp" : "image/jpeg";
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  let best = null;
  let dimension = Math.min(MAX_DIMENSION, longest);

  try {
    while (!best || best.size > TARGET_BYTES) {
      const scale = dimension / longest;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of QUALITY_STEPS) {
        const blob = await encode(canvas, type, quality);
        if (blob && (!best || blob.size < best.size)) best = blob;
        if (blob && blob.size <= TARGET_BYTES) break;
        await nextFrame();
      }

      if (best && best.size <= TARGET_BYTES) break;
      if (dimension <= MIN_DIMENSION) break;
      dimension = Math.max(MIN_DIMENSION, Math.round(dimension * 0.8));
    }
  } finally {
    releaseCanvas(canvas);
    release();
  }

  if (!best) throw new Error(`${file.name}: não foi possível comprimir esta imagem.`);

  const outputType = best.type || type;
  const extension = outputType === "image/webp" ? "webp" : "jpg";
  const output = new File([best], `${baseName(file)}.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });

  preparedFiles.add(output);
  return output;
}

/**
 * Comprime várias fotos em sequência (uma por vez para não estourar a
 * memória do celular). `onProgress(feitas, total)` acompanha o andamento.
 */
export async function compressServicePhotos(files, onProgress) {
  const result = { files: [], errors: [], originalBytes: 0, finalBytes: 0 };

  for (let index = 0; index < files.length; index += 1) {
    const original = files[index];
    onProgress?.(index, files.length);

    try {
      const prepared = await prepareServicePhoto(original);
      result.files.push(prepared);
      result.originalBytes += original.size;
      result.finalBytes += prepared.size;
    } catch (error) {
      result.errors.push(error?.message || `${original?.name || "Foto"}: falha ao otimizar.`);
    }

    await nextFrame();
  }

  onProgress?.(files.length, files.length);
  return result;
}

export function compressionSummary({ files, originalBytes, finalBytes }) {
  if (!files.length) return "";
  const saved = originalBytes > 0 ? Math.round((1 - finalBytes / originalBytes) * 100) : 0;
  const label = files.length === 1 ? "1 foto otimizada" : `${files.length} fotos otimizadas`;
  return saved > 0
    ? `${label}: ${formatBytes(originalBytes)} → ${formatBytes(finalBytes)} (−${saved}%).`
    : `${label}.`;
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
