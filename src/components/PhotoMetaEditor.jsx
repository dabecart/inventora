import { useEffect, useRef, useState } from "react";
import { simpleId } from "../Utils";
import {  
    Camera,
    Image as ImageIcon,
    X as XIcon,
} from "lucide-react";

// --- Image helpers ---
export function resizeAndCompress(input, callback, maxSizeKB = 1024) {
  const processImage = (src) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // allow CORS if loading from external URLs
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Target dimensions: keep aspect ratio, max ~1200px wide.
      const maxDim = 1200;
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Compress quality adaptively.
      let quality = 0.9;
      let dataUrl;
      do {
        dataUrl = canvas.toDataURL("image/jpeg", quality);
        const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
        if (sizeKB <= maxSizeKB) break;
        quality -= 0.1;
      } while (quality > 0.3);

      callback(dataUrl);
    };
    img.src = src;
  };

  // Files
  if (input instanceof File && input.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = e => processImage(e.target.result);
    reader.readAsDataURL(input);
  } 
  // URL string
  else if (typeof input === "string") {
    processImage(input);
  } else {
    throw new Error("Unsupported input type: must be a File or URL string");
  }
}

export default function PhotoMetaEditor({ value = [], onChange, className = '', maxSizeKB = 1024, disableGallery = false }) {
  const [items, setItems] = useState(Array.isArray(value) ? value.slice() : []);
  // For full-screen preview
  const [preview, setPreview] = useState(null); 
  // For dropping images.
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [dragSupported, setDragSupported] = useState(false);
  const dropRef = useRef();
  const dragCounter = useRef(0);

  useEffect(() => {
    // Determine drag & drop support: reject touch devices.
    try {
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      const hasDrag = !!('draggable' in document.createElement('span')) && typeof window.DataTransfer !== 'undefined';
      setDragSupported(!isTouch && hasDrag);
    } catch (e) {
      setDragSupported(false);
    }
  }, []);

  useEffect(() => onChange && onChange(items), [items]);

  function handleInputs(inputs) {
    for (const input of inputs) {
      resizeAndCompress(input, result => {
        setItems(it => [...it, { id: `p-${simpleId()}`, src: result }]);
      }, maxSizeKB);
    }
  }

  function removeItem(id) {
    setItems(it => it.filter(i => i.id !== id));
  }

  // --- Drag & Drop ---
  useEffect(() => {
    if (!dragSupported) return;
    const container = dropRef.current;
    if (!container) return;

    const dropZone = container.querySelector('.photo-drop-zone') || container;

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    function onDragEnter(e) {
      preventDefaults(e);
      dragCounter.current++;
      setIsHighlighted(true);
    }
    function onDragLeave(e) {
      preventDefaults(e);
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setIsHighlighted(false);
    }
    function onDrop(e) {
      preventDefaults(e);
      setIsHighlighted(false);
      dragCounter.current = 0;
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) handleInputs(dt.files);
    }
    function onDragOver(e) {
      preventDefaults(e);
    }

    ['dragenter'].forEach(ev => dropZone.addEventListener(ev, onDragEnter));
    ['dragleave'].forEach(ev => dropZone.addEventListener(ev, onDragLeave));
    ['dragover'].forEach(ev => dropZone.addEventListener(ev, onDragOver));
    ['drop'].forEach(ev => dropZone.addEventListener(ev, onDrop));

    return () => {
      ['dragenter'].forEach(ev => dropZone.removeEventListener(ev, onDragEnter));
      ['dragleave'].forEach(ev => dropZone.removeEventListener(ev, onDragLeave));
      ['dragover'].forEach(ev => dropZone.removeEventListener(ev, onDragOver));
      ['drop'].forEach(ev => dropZone.removeEventListener(ev, onDrop));
    };
  }, []);

  return (
    <div ref={dropRef} className={`w-full h-full space-y-2 relative ${className}`}>
      <div
        className={`border-2 rounded-md p-4 flex items-center justify-center text-center transition-colors ${isHighlighted ? "border-solid border-blue-500" : "border-dashed border-gray-600"}`}
      >
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded cursor-pointer">
            <Camera size={18} />
            <input
              accept="image/*"
              capture="environment"
              type="file"
              multiple
              onChange={e => {
                if (e.target.files) handleInputs(e.target.files);
                e.target.value = null;
              }}
              className="hidden"
            />
          </label>
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded cursor-pointer">
            <ImageIcon size={18} />
            <input
              accept="image/*"
              type="file"
              multiple
              onChange={e => {
                if (e.target.files) handleInputs(e.target.files);
                e.target.value = null;
              }}
              className="hidden"
            />
          </label>

          {dragSupported && (
            <span className="text-xs text-gray-400">Drag & drop images here</span>
          )}
        </div>
      </div>

      {/* Thumbnails */}
      {
        !disableGallery && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map(it => (
            <div
              key={it.id}
              className="relative border rounded overflow-hidden cursor-pointer"
              onClick={() => setPreview(it.src)}
            >
              <img src={it.src} alt="meta" className="object-cover w-full h-24" />
              <button
                onClick={e => {
                  e.stopPropagation();
                  removeItem(it.id);
                }}
                className="absolute top-1 right-1 bg-black bg-opacity-50 p-2 rounded text-white"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
        )
      }

      {/* Fullscreen Preview */}
      {!disableGallery && preview && (
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
  );
}