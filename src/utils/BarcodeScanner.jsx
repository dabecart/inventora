// components/BarcodeScanner.jsx
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import PhotoMetaEditor from "../components/PhotoMetaEditor";

export default function BarcodeScanner({ onDetected, formats = ["ean_13", "qr_code"] }) {
  const videoRef = useRef();
  const [fallbackMode, setFallbackMode] = useState(false);
  const [images, setImages] = useState([]);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!active) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats });
          const tick = async () => {
            if (!active) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length) {
                onDetected(barcodes[0].rawValue);
                stop();
              }
            } catch {}
            requestAnimationFrame(tick);
          };
          tick();
        } else {
          const reader = new BrowserMultiFormatReader();
          reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
            if (result) {
              onDetected(result.getText());
              stop();
            }
          });
        }
      } catch (e) {
        console.warn("Camera scanning failed:", e);
        setFallbackMode(true); // switch to PhotoMetaEditor fallback
      }
    }

    startCamera();
    return () => {
      active = false;
      stop();
    };

    function stop() {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    }
  }, []);

  // Whenever the image changes, try decoding it.
  useEffect(() => {
    if (!images.length) return;
    const reader = new BrowserMultiFormatReader();
    (async () => {
      for (const img of images) {
        try {
          const result = await reader.decodeFromImageUrl(img.src);
          if (result) {
            onDetected(result.getText());
            break;
          }
        } catch (e) {
          console.warn("No barcode in image", e);
        }
      }
    })();
  }, [images]);

  if (fallbackMode) {
    return (
      <div>
        <div className="text-sm text-gray-500 mb-2">{"Snap or upload a photo of the barcode."}</div>
        <PhotoMetaEditor value={images} onChange={setImages} />
      </div>
    );
  }

  return (
    <div>
      <video ref={videoRef} className="w-full h-64 bg-black object-cover rounded" muted playsInline />
      <div className="mt-2 text-xs text-gray-500">Point the camera at the product barcode.</div>
    </div>
  );
}
