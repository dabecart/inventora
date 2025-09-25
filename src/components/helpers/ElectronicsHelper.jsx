// components/ElectronicsHelper.jsx
import { useState } from "react";
import BarcodeScanner from "../../utils/BarcodeScanner";
import { ChevronLeft } from "lucide-react";

/*
  You should replace lookupElectronicsByBarcode with your preferred API (UPCItemDB, BarcodeLookup, etc.)
  Many of these services require an API key. If none is configured we fallback to barcode string as name.
*/
export default function ElectronicsHelper({ storageUnits = [], onBack, openEditModal, UPC_ITEM_DB_API_KEY = null }) {
  const [barcode, setBarcode] = useState(null);
  const [product, setProduct] = useState(null);
  const [storageId, setStorageId] = useState('');

  async function onDetectedBarcode(code) {
    setBarcode(code);
    const p = await lookupElectronicsByBarcode(code);
    setProduct(p);
  }

  async function lookupElectronicsByBarcode(code) {
    // Example using UPCItemDB trial endpoint (rate limited) — replace with your key/endpoint.
    if (UPC_ITEM_DB_API_KEY) {
      try {
        const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (data && data.code === 'OK' && data.items && data.items.length) {
          const it = data.items[0];
          return { name: it.title || code, image: it.images && it.images[0] ? it.images[0] : null, raw: it };
        }
      } catch (e) { console.warn(e); }
    }
    // Fallback:
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

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg w-full max-w-3xl p-6 m-2 relative">
      {!barcode ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <BarcodeScanner onDetected={onDetectedBarcode} formats={['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']} hintText="Scan product barcode" />
          </div>

          <div className="p-4 border rounded">
            <label className="block text-sm text-gray-400 mb-1">Storage</label>
            <div className="flex gap-2">
              <select value={storageId} onChange={e => setStorageId(e.target.value)} className="flex-1 px-3 py-2 rounded border border-gray-300">
                <option value="">(no storage)</option>
                {storageUnits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="mt-4 text-sm text-gray-500">If you want better lookup results replace the placeholder lookup with a proper products API and add an API key.</div>
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
            <select value={storageId} onChange={e => setStorageId(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-300">
              <option value="">(no storage)</option>
              {storageUnits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="mt-4 text-sm text-gray-500">Use a dedicated product lookup API for better electronics results (UPCItemDB, BarcodeLookup, etc.)</div>
          </div>
        </div>
      )}
    </div>
  );
}
