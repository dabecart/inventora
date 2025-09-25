import { useState } from "react";
import BarcodeScanner from "../../utils/BarcodeScanner";

export default function FoodHelper({ storageUnits = [], onBack, openEditModal }) {
  const [barcode, setBarcode] = useState(null);
  const [product, setProduct] = useState(null);
  const [storageId, setStorageId] = useState('');
  const [scanningStorage, setScanningStorage] = useState(false);
  const [stickerScanResult, setStickerScanResult] = useState(null);

  async function onDetectedBarcode(code) {
    setBarcode(code);
    const p = await lookupFoodByBarcode(code);
    setProduct(p);
  }

  async function lookupFoodByBarcode(code) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`);
      const data = await res.json();
      if (data && data.status === 1) {
        return {
          name: data.product.product_name || data.product.generic_name || data.product.brands || code,
          image: data.product.image_front_small_url || data.product.image_url || null,
          raw: data
        };
      }
    } catch (e) {
      console.warn('OpenFoodFacts lookup failed', e);
    }
    return { name: code, image: null, raw: null };
  }

  function handleUseProduct() {
    const prefill = {
      name: product ? (product.name || barcode) : barcode || '',
      qty: 1,
      storageUnitId: storageId || null,
      meta: {}
    };
    openEditModal(prefill);
  }

  // Storage QR scan flow — create an ad-hoc scanner that accepts qr_code only
  function openStorageScanner() {
    setScanningStorage(true);
    setStickerScanResult(null);

    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '9999';
    modal.style.background = 'rgba(0,0,0,0.6)';
    modal.innerHTML = '<div id="scanner-root" style="max-width:420px;margin:6vh auto;background:white;padding:12px;border-radius:8px"></div>';
    document.body.appendChild(modal);

    // Render a temporary scanner into #scanner-root (assuming ReactDOM is available)
    import("react-dom").then(ReactDOM => {
      const root = modal.querySelector('#scanner-root');
      function onFound(code) {
        ReactDOM.unmountComponentAtNode(root);
        document.body.removeChild(modal);
        setScanningStorage(false);
        setStorageId(code);
      }
      ReactDOM.render(<BarcodeScanner onDetected={onFound} formats={['qr_code']} hintText="Scan storage sticker QR" />, root);
    });
  }

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg w-full max-w-3xl p-6 m-2 relative">
      {!barcode ? (
        <div className="grid grid-rows-1 sm:grid-cols-2 gap-4">
          <div>
            <BarcodeScanner onDetected={onDetectedBarcode} formats={['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']} />
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-3">Scan a barcode and we'll attempt to fetch the product name + image from OpenFoodFacts.</div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Storage</label>
              <div className="flex gap-2">
                <select value={storageId} onChange={e => setStorageId(e.target.value)} className="flex-1 px-3 py-2 rounded border border-gray-300">
                  <option value="">(no storage)</option>
                  {storageUnits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={openStorageScanner} className="px-3 py-2 rounded bg-gray-800 text-white">Scan sticker</button>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">After detection you can edit or save the item.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 border rounded flex items-center gap-4">
            {product && product.image ? (
              <img src={product.image} alt="product" className="w-32 h-32 object-cover rounded" />
            ) : (
              <div className="w-32 h-32 bg-gray-100 flex items-center justify-center rounded text-xs text-gray-500">No image</div>
            )}
            <div>
              <div className="text-lg font-semibold">{product ? product.name : barcode}</div>
              <div className="text-xs text-gray-500 mt-2">Barcode: {barcode}</div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => { setBarcode(null); setProduct(null); }} className="px-3 py-2 rounded bg-gray-200">Scan again</button>
                <button onClick={handleUseProduct} className="px-3 py-2 rounded bg-blue-600 text-white">Next: Edit/Create</button>
              </div>
            </div>
          </div>

          <div className="p-4 border rounded">
            <label className="block text-sm text-gray-400 mb-1">Storage</label>
            <div className="flex gap-2">
              <select value={storageId} onChange={e => setStorageId(e.target.value)} className="flex-1 px-3 py-2 rounded border border-gray-300">
                <option value="">(no storage)</option>
                {storageUnits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={openStorageScanner} className="px-3 py-2 rounded bg-gray-800 text-white">Scan sticker</button>
            </div>
            <div className="mt-4 text-sm text-gray-500">If the product wasn't found online we will prefill the barcode as the name. You can edit any field on the next screen.</div>
          </div>
        </div>
      )}
    </div>
  );
}
