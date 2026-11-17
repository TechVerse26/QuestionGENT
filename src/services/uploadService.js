const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
export const uploadsEnabled = Boolean(cloud && preset);
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Unsigned Cloudinary upload; only the returned URL is stored in Firestore.
export async function uploadImage(file, { maxMB = 5 } = {}) {
  if (!uploadsEnabled) throw new Error('Image upload is not configured. Paste an image URL instead.');
  if (!ALLOWED.includes(file.type)) throw new Error('Only PNG, JPEG, WebP or GIF images are allowed.');
  if (file.size > maxMB * 1024 * 1024) throw new Error(`Image must be smaller than ${maxMB} MB.`);
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', preset);
  fd.append('folder', 'exam-master');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Image upload failed.');
  const json = await res.json();
  return json.secure_url;
}
