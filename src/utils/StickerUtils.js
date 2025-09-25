import QRCode from "qrcode";

export async function generateStorageStickerDataUrl({ id, name, width = 800, height = 400, qrSize = 300 }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // generate QR code as dataURL
  const qrDataUrl = await QRCode.toDataURL(id, { width: qrSize, margin: 1 });
  const qrImg = await loadImage(qrDataUrl);

  const padding = 24;
  const qrX = padding;
  const qrY = Math.round((height - qrSize) / 2);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // storage name on the right
  const textX = qrX + qrSize + padding;
  const textWidth = width - textX - padding;
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  ctx.font = '700 28px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';

  const lines = wrapText(ctx, name, textWidth);
  const totalTextHeight = lines.length * 36;
  let startY = Math.round((height - totalTextHeight) / 2);

  lines.forEach((line, idx) => {
    ctx.fillText(line, textX, startY + idx * 36);
  });

  ctx.font = "400 12px system-ui, sans-serif";
  ctx.fillStyle = "#444";
  ctx.fillText(`ID: ${id}`, textX, height - padding - 14);

  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // allow drawing to canvas
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = (text || '').toString().split(' ');
  const lines = [];
  let current = '';
  words.forEach(word => {
    const test = current ? `${current} ${word}` : word;
    const width = ctx.measureText(test).width;
    if (width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

export async function shareOrPrintDataUrl(dataUrl, filename = 'sticker.png') {
  // Try Web Share API with files first.
  try {
    const blob = dataURLToBlob(dataUrl);
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return { shared: true };
    }
  } catch (e) {
    // fallthrough to print/download fallback
  }

  // fallback: open in new tab and trigger print
  const w = window.open('');
  if (!w) {
    // popup blocked; trigger download
    downloadDataUrl(dataUrl, filename);
    return { printed: false };
  }
  w.document.write(`
    <html>
      <head><title>${filename}</title></head>
      <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh;">
        <img src="${dataUrl}" style="max-width:100%; max-height:100%" />
        <script>
          window.onload = function(){ setTimeout(()=>{ window.print(); }, 250); };
        </script>
      </body>
    </html>
  `);
  w.document.close();
  return { printed: true };
}

function dataURLToBlob(dataurl) {
  const parts = dataurl.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const len = binary.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8arr[i] = binary.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
