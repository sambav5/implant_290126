const PLATFORM_FORMATS = {
  instagram_portrait: { label: 'Instagram Portrait', width: 1080, height: 1350, aspectRatio: '4 / 5' },
  instagram_square: { label: 'Instagram Square', width: 1080, height: 1080, aspectRatio: '1 / 1' },
  facebook: { label: 'Facebook', width: 1080, height: 1350, aspectRatio: '4 / 5' },
  linkedin: { label: 'LinkedIn', width: 1200, height: 627, aspectRatio: '1.91 / 1' },
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Unable to load selected image'));
  img.src = src;
});

const drawCover = (ctx, img, x, y, width, height) => {
  const scale = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
};

export async function generatePostImage({
  preOpUrl,
  postOpUrl,
  format,
  clinicName,
  clinicianName,
}) {
  const config = PLATFORM_FORMATS[format] || PLATFORM_FORMATS.instagram_portrait;
  const canvas = document.createElement('canvas');
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext('2d');

  const [preOpImg, postOpImg] = await Promise.all([loadImage(preOpUrl), loadImage(postOpUrl)]);

  const padding = Math.round(config.width * 0.05);
  const headerHeight = Math.round(config.height * 0.14);
  const footerHeight = Math.round(config.height * 0.14);
  const gap = Math.round(config.width * 0.025);
  const imageAreaY = headerHeight + padding;
  const imageAreaHeight = config.height - headerHeight - footerHeight - (padding * 2);
  const imageWidth = Math.floor((config.width - (padding * 2) - gap) / 2);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, config.width, config.height);

  ctx.fillStyle = '#0f172a';
  ctx.font = `600 ${Math.round(config.width * 0.04)}px Inter, Arial`;
  ctx.fillText(clinicName || 'Dental Clinic', padding, Math.round(headerHeight * 0.55));

  ctx.fillStyle = '#475569';
  ctx.font = `500 ${Math.round(config.width * 0.026)}px Inter, Arial`;
  ctx.fillText('BEFORE', padding, imageAreaY - 14);
  ctx.fillText('AFTER', padding + imageWidth + gap, imageAreaY - 14);

  drawCover(ctx, preOpImg, padding, imageAreaY, imageWidth, imageAreaHeight);
  drawCover(ctx, postOpImg, padding + imageWidth + gap, imageAreaY, imageWidth, imageAreaHeight);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.strokeRect(padding, imageAreaY, imageWidth, imageAreaHeight);
  ctx.strokeRect(padding + imageWidth + gap, imageAreaY, imageWidth, imageAreaHeight);

  const footerY = config.height - footerHeight + Math.round(footerHeight * 0.35);
  ctx.fillStyle = '#0f172a';
  ctx.font = `600 ${Math.round(config.width * 0.034)}px Inter, Arial`;
  ctx.fillText('Smile Transformation', padding, footerY);

  ctx.fillStyle = '#334155';
  ctx.font = `500 ${Math.round(config.width * 0.024)}px Inter, Arial`;
  ctx.fillText(`Treatment by Dr. ${clinicianName || 'Clinician'}`, padding, footerY + Math.round(config.height * 0.04));

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Failed to generate social post image'));
        return;
      }
      resolve(result);
    }, 'image/png', 1);
  });

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: config.width,
    height: config.height,
    aspectRatio: config.aspectRatio,
  };
}

export { PLATFORM_FORMATS };
