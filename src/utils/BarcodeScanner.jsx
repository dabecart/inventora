// components/BarcodeScanner.jsx
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import PhotoMetaEditor from "../components/PhotoMetaEditor";
import FieldError from "../components/FieldError";

export default function BarcodeScanner({ onDetected, formats = ["ean_13", "qr_code"], className = null }) {
  const videoRef = useRef();
  const [cameraError, setCamaraError] = useState(null);
  const [images, setImages] = useState([]);
  const [notDetected, setNotDetected] = useState(false);

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
            setCamaraError(false);
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
          setCamaraError(false);
        }
      } catch (e) {
        console.warn("Camera scanning failed:", e);
        setCamaraError(true); // switch to PhotoMetaEditor fallback
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
            setNotDetected(false);
            break;
          }
        } catch (e) {
          console.warn("No barcode in image", e);
          setNotDetected(true);
        }
      }
    })();
  }, [images]);

  if(cameraError) {
    return (
      <div className={className}>
        <div className="text-sm text-gray-500 mb-2">{"Snap or upload a photo of the code."}</div>
        <PhotoMetaEditor value={images} onChange={setImages} disableGallery={true} allowMultipleUploads={false}  />
        {notDetected && (
          <FieldError text="Code not detected."/>
        )} 
      </div>
    );
  }

  return (
    <div className={className}>
      <video ref={videoRef} className={`w-full h-64 bg-black object-cover rounded ${cameraError === null && "hidden"}`} muted playsInline/>
      <div className="mt-2 text-xs text-gray-500">Point the camera at the product barcode.</div>
    </div>
  );
}
