import QRCode from "qrcode";

/**
 * generateSticker - creates a PNG dataURL
 * options:
 *  - id, name
 *  - type: "qr" | "qr+text"
 *  - width, height (canvas size)
 *  - qrSize (optional) - overrides automatic sizing
 */
export async function generateSticker({
  id,
  name = '',
  type = "qr+text",
  width = 800,
  height = 400,
  qrSize = null,
  padding = 24,
}) {
  // create canvas with the provided dimensions
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // determine qrSize if not provided
  if (!qrSize) {
    if (type === "qr") {
      // for QR-only we make the QR fill the smaller dimension (so the QR itself is square)
      qrSize = Math.max(1, Math.min(canvas.width, canvas.height) - padding * 2);
    } else {
      // for qr+text use a size that fits the height comfortably
      qrSize = Math.min(360, Math.max(64, Math.floor(canvas.height * 0.8)));
    }
  }

  // generate QR data URL
  const qrDataUrl = await QRCode.toDataURL(String(id), { width: qrSize, margin: 1 });
  const qrImg = await loadImage(qrDataUrl);

  // compute QR position:
  // - for "qr" center horizontally and vertically (square QR)
  // - for "qr+text" place at left with padding
  let qrX;
  if (type === "qr") {
    qrX = Math.round((canvas.width - qrSize) / 2);
  } else {
    qrX = padding;
  }
  const qrY = Math.round((canvas.height - qrSize) / 2);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // If it's the "qr+text" sticker, draw name (big/bold) and ID (smaller, gray) on the right
  if (type === "qr+text") {
    const textX = qrX + qrSize + padding;
    const textWidth = Math.max(40, canvas.width - textX - padding);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#000";

    // name - bold & bigger
    ctx.font = '700 34px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    const nameLines = wrapText(ctx, name || "(no name)", textWidth);
    const lineHeight = 40;
    const totalNameHeight = nameLines.length * lineHeight;

    // id line height
    const idLineHeight = 22;
    const totalTextBlockHeight = totalNameHeight + 12 + idLineHeight;

    let startY = Math.round((canvas.height - totalTextBlockHeight) / 2);

    nameLines.forEach((line, idx) => {
      ctx.fillText(line, textX, startY + idx * lineHeight);
    });

    // ID below name (smaller, not bold)
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillStyle = "#555";
    ctx.fillText(`ID: ${id}`, textX, startY + totalNameHeight + 12);
  }

  // return PNG data URL
  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = (text || "").toString().split(" ");
  const lines = [];
  let current = "";
  words.forEach((word) => {
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

/* Share or print fallback */
export async function shareSticker(dataUrl, filename = "sticker.png") {
  try {
    const blob = dataURLToBlob(dataUrl);
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return { shared: true };
    }
  } catch (e) {
    // fallthrough to print fallback
    console.warn("Web Share failed, falling back to print:", e);
  }

  // fallback: open new tab then print
  const w = window.open("");
  if (!w) {
    // popup blocked, trigger download instead
    downloadSticker(dataUrl, filename);
    return { printed: false };
  }
  w.document.write(`
    <html>
      <head><title>${filename}</title></head>
      <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh;">
        <img src="${dataUrl}" style="max-width:100%; max-height:100%;" />
        <script>
          window.onload = function(){ setTimeout(()=>{ window.print(); }, 250); };
        </script>
      </body>
    </html>
  `);
  w.document.close();
  return { printed: true };
}

export function downloadSticker(dataUrl, filename = "sticker.png") {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function dataURLToBlob(dataurl) {
  const parts = dataurl.split(",");
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const len = binary.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8arr[i] = binary.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}
