import { apiFetch } from '@/lib/api/api-fetch';
import { IMAGE } from '@/lib/policy';

/**
 * Presigned upload (WBS 00 UploadController, E):
 * `POST /api/v1/user/uploads` → PUT the file to `uploadUrl` → `POST /uploads/{fileId}/complete`.
 * Request/response shapes are hand-written until the controller is in OpenAPI; swap to orval then.
 */

export type UploadedImage = { fileId: string; url: string };

const MB = 1024 * 1024;

/** Error copy for a file the policy rejects, or null when it may be uploaded (04 ch. 2 "Images"). */
export function validateImage(file: File): string | null {
  if (!(IMAGE.mimeTypes as readonly string[]).includes(file.type)) {
    return 'JPG, PNG, WebP, GIF 사진만 올릴 수 있어요.';
  }
  if (file.size > IMAGE.maxBytes) {
    return `사진은 한 장에 ${IMAGE.maxBytes / MB}MB까지 올릴 수 있어요.`;
  }
  return null;
}

function putWithProgress(url: string, file: File, onProgress: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('upload network error'));
    xhr.send(file);
  });
}

export async function uploadImage(
  file: File,
  onProgress: (ratio: number) => void,
): Promise<UploadedImage> {
  const { fileId, uploadUrl } = await apiFetch<{ fileId: string; uploadUrl: string }>(
    '/api/v1/user/uploads',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'IMAGE', contentType: file.type, size: file.size }),
    },
  );
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    // Mock mode (blueprint §1-2): no storage to PUT to; fake the progress so the UI shows it
    for (const step of [0.3, 0.7, 1]) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      onProgress(step);
    }
  } else {
    await putWithProgress(uploadUrl, file, onProgress);
  }
  return apiFetch<UploadedImage>(`/api/v1/user/uploads/${fileId}/complete`, { method: 'POST' });
}
