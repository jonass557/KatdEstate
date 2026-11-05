import { v2 as cloudinary } from 'cloudinary';
import type { AppConfig } from '../config/index.js';

let isConfigured = false;

export function initCloudinary(config: AppConfig): void {
  if (config.cloudinary?.cloudName && config.cloudinary?.apiKey && config.cloudinary?.apiSecret) {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true,
    });
    isConfigured = true;
  }
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
}

/**
 * Téléverse un fichier (chemin local ou base64) vers Cloudinary.
 */
export async function uploadToCloudinary(
  fileSource: string,
  options: {
    folder?: string;
    publicId?: string;
    resourceType?: 'image' | 'raw' | 'auto';
  } = {}
): Promise<CloudinaryUploadResult> {
  if (!isConfigured) {
    // Si Cloudinary n'est pas encore configuré (ex: variables non fournies), renvoie l'URL source
    return {
      url: fileSource,
      secureUrl: fileSource,
      publicId: options.publicId ?? `local_${Date.now()}`,
      format: 'unknown',
      bytes: 0,
    };
  }

  const result = await cloudinary.uploader.upload(fileSource, {
    folder: options.folder ?? 'katdestate',
    public_id: options.publicId,
    resource_type: options.resourceType ?? 'auto',
  });

  return {
    url: result.url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    bytes: result.bytes,
  };
}

/**
 * Supprime un asset Cloudinary par son public_id.
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!isConfigured) return true;
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch {
    return false;
  }
}
