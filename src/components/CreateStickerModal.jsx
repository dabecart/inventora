import { useState, useEffect } from "react";
import { generateSticker, shareSticker, downloadSticker } from "../utils/StickerUtils";
import { XIcon, Share2, Download } from "lucide-react";
import Spinner from "./Spinner";

export default function CreateStickerModal({ unit = {}, onClose }) {
  const [stickers, setStickers] = useState({ qr: null, full: null });
  const [loading, setLoading] = useState(true);
  // For full-screen preview
  const [preview, setPreview] = useState(null); 

  useEffect(() => {
    let mounted = true;
    async function generateAll() {
      setLoading(true);
      try {
        // full rectangular sticker (width x height)
        const full = await generateSticker({
          id: unit.id || "unknown-id",
          name: unit.name || "(no name)",
          type: "qr+text",
          width: 800,
          height: 400,
        });

        // QR-only sticker (square). We pass a square canvas: e.g. 400x400
        const qrOnly = await generateSticker({
          id: unit.id || "unknown-id",
          name: unit.name || "(no name)",
          type: "qr",
          width: 400,
          height: 400,
        });

        if (!mounted) return;
        setStickers({ qr: qrOnly, full });
      } catch (e) {
        console.error("Sticker generation failed", e);
        alert("Could not generate stickers: " + (e.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    generateAll();
    return () => { mounted = false; };
  }, [unit]);

  // unified image preview height — forces both previews to the same displayed height
  const previewImgClass = "mb-4 rounded h-56 md:h-64 w-auto object-contain cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-gray-900 text-white rounded-lg w-full max-w-3xl p-6 m-2">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-semibold">{unit.name || "(no name)"}</h3>
            <p className="text-sm text-gray-400">{unit.id || "unknown-id"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-800">
            <XIcon />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner size={36} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center">
              <div className="text-sm text-gray-300 mb-2">QR only</div>
              <img src={stickers.qr} alt="QR Only" className={previewImgClass} onClick={() => setPreview(stickers.qr)} />
              <div className="flex gap-3">
                <button
                  onClick={() => shareSticker(stickers.qr, `${(unit.name || "storage")}_qr.png`)}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
                >
                  <Share2 size={16} /> Share
                </button>
                <button
                  onClick={() => downloadSticker(stickers.qr, `${(unit.name || "storage")}_qr.png`)}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-green-600 hover:bg-green-500"
                >
                  <Download size={16} /> Save
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center">
              <div className="text-sm text-gray-300 mb-2">QR + Name</div>
              <img src={stickers.full} alt="QR + Name" className={previewImgClass} onClick={() => setPreview(stickers.full)} />
              <div className="flex gap-3">
                <button
                  onClick={() => shareSticker(stickers.full, `${(unit.name || "storage")}_sticker.png`)}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
                >
                  <Share2 size={16} /> Share 
                </button>
                <button
                  onClick={() => downloadSticker(stickers.full, `${(unit.name || "storage")}_sticker.png`)}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-green-600 hover:bg-green-500"
                >
                  <Download size={16} /> Save
                </button>
              </div>
            </div>

            {/* Fullscreen Preview */}
            {preview && (
              <div
                className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
                onClick={() => setPreview(null)}
              >
                <img
                  src={preview}
                  alt="preview"
                  className="max-w-full max-h-full cursor-pointer"
                />
                <button
                  onClick={() => setPreview(null)}
                  className="absolute top-4 right-4 bg-black bg-opacity-70 p-2 rounded text-white"
                >
                  <XIcon size={20} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
