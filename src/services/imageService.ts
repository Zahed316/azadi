import { R2Bucket } from '@cloudflare/workers-types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class ImageService {
  /**
   * Upload an image to R2 for a given product.
   * Returns the public URL of the uploaded image.
   */
  static async uploadImage(
    bucket: R2Bucket,
    productId: number,
    file: ArrayBuffer,
    contentType: string,
    publicBaseUrl: string,
  ): Promise<string> {
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new ImageError('INVALID_TYPE', 'فقط فایل‌های JPG، PNG و WebP پشتیبانی می‌شوند');
    }
    if (file.byteLength > MAX_FILE_SIZE) {
      throw new ImageError('TOO_LARGE', 'حجم فایل نباید بیشتر از ۵ مگابایت باشد');
    }

    // Content-addressed key: hash the file to prevent duplicates
    const hashBuffer = await crypto.subtle.digest('SHA-256', file);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const ext = contentTypeToExt(contentType);
    const key = `products/${productId}/${hashHex}.${ext}`;

    await bucket.put(key, file, {
      httpMetadata: { contentType },
    });

    // Return the R2.dev public URL
    // In production, this bucket needs to have public access enabled
    return getPublicUrl(key, publicBaseUrl);
  }

  /**
   * Delete all images for a product from R2.
   * Handles pagination for products with more than 1,000 objects.
   */
  static async deleteImage(bucket: R2Bucket, productId: number): Promise<void> {
    const prefix = `products/${productId}/`;
    let cursor: string | undefined;
    do {
      const listed = await bucket.list({ prefix, cursor });
      for (const obj of listed.objects) {
        await bucket.delete(obj.key);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }

  /**
   * Get the public URL for a product's image, or null if none exists.
   * Used by router (Task 4) and callback handler (Task 7).
   */
  static async getImageUrl(
    bucket: R2Bucket,
    productId: number,
    publicBaseUrl: string,
  ): Promise<string | null> {
    const prefix = `products/${productId}/`;
    const listed = await bucket.list({ prefix, limit: 1 });
    const first = listed.objects[0];
    if (!first) return null;
    return getPublicUrl(first.key, publicBaseUrl);
  }

  /**
   * Check if a product has an image in R2.
   */
  static async hasImage(bucket: R2Bucket, productId: number): Promise<boolean> {
    const prefix = `products/${productId}/`;
    const listed = await bucket.list({ prefix, limit: 1 });
    return listed.objects.length > 0;
  }
}

function contentTypeToExt(ct: string): string {
  switch (ct) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

function getPublicUrl(key: string, publicBaseUrl: string): string {
  // R2.dev public URL pattern: pub-{hash}.r2.dev/{key}
  // In production, configure the bucket's public access domain in the Cloudflare dashboard.
  return `${publicBaseUrl}/${key}`;
}

export class ImageError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImageError';
  }
}
