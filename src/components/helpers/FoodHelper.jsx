import { useState, useEffect } from "react";
import BarcodeScanner from "../../utils/BarcodeScanner";
import MenuViews from "../../utils/MenuViews";
import { ShoppingCart } from "lucide-react";
import PhotoMetaEditor, {resizeAndCompress} from "../PhotoMetaEditor";
import { simpleId } from "../../Utils";
import Spinner from "../Spinner";
import FieldError from "../FieldError";

export default function FoodHelper({ storageUnits = [], onChangeView, setMenuName }) {
  const HELPER_ID = "food";
  const HELPER_NAME = "Food Helper"
  const HELPER_ICON = <ShoppingCart size={36} />;
  
  // "barcode" | "storage" | "quantity" | "resume"
  const {view, goToView, goToPreviousView} = MenuViews("barcode");
  const [isActive, setActive] = useState(false);
  
  const [isLoading, setLoading] = useState(false);

  const [product, setProduct] = useState(null);
  const [productError, setProductError] = useState(null);
  const [storageId, setStorageId] = useState(null);
  const [storageIdError, setStorageIdError] = useState(null);
  const [images, setImages] = useState([]);

  const menuNames = {
    "barcode" : "Scan the product barcode",
    "storage" : "Scan or select the storage unit",
    "quantity": "How many products are you adding?",
    "resume"  : "Check the fields",
  }

  useEffect(() => {
    if(!isActive) return;
    
    setMenuName(menuNames[view]);

  }, [isActive, view]);

  async function onDetectedBarcode(code) {
    setLoading(true);
    const p = await lookupFoodByBarcode(code);
    if(p.image) {
      resizeAndCompress(p.image, (dataUrl) => {
        setImages(it => [...it, { id: `p-${simpleId()}`, src: dataUrl }]);
        // Wait until the images have been processed.
        setProduct(p);
        setLoading(false);
      });
    }else {
      // No photo, let the user add them themselves.
      setProduct(p);
      setLoading(false);
    }
  }

  function onDetectedStorage(code) {
    const unit = storageUnits.find(s => s.id === code);
    if(!unit) {
      setStorageId(null);
      setStorageIdError(`Code "${code}" is not a valid storage unit.`);
    }else {
      setStorageId(code);
      setStorageIdError(null);
    }
  }

  // https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v2/#get-/api/v2/product/-barcode-
  async function lookupFoodByBarcode(code) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data && data.status === 1) {
        setProductError(null);
        return {
          name: data.product.product_name_en || data.product.product_name || data.product.generic_name || data.product.brands || code,
          barcode: code, 
          image: data.product.image_url || null,
          manufacturer: data.product.brands,
          raw: data
        };
      }
    } catch (e) {
      setProductError(`The product lookup failed. Please, try again.`);
    }

    setProductError(`The code "${code}" is not valid or did not yield any results.`);
    return { name: code, barcode: code, image: null, manufacturer: null, raw: null };
  }

  function handleUseBarcodeInfo() {
    const prefill = {
      name: product ? (product.name || barcode) : barcode || '',
      qty: 1,
      storageUnitId: storageId || null,
      meta: {}
    };
    // Update the product information!
    goToView("storage");
  }

  function setProductField(key, value) {
    const updatedVal = {[key] : value};
    setProduct(p => ({...p, updatedVal}));
  }

  function getJSX() {
    return (
      <div className="bg-gray-900 text-gray-900 text-white rounded-lg w-full max-w-3xl relative">
        {view === "barcode" && !product && (
          <div>
            <BarcodeScanner onDetected={onDetectedBarcode} formats={['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']} />

            <div className="flex gap-2 mt-6">
              {isLoading && (
                <Spinner/>
              )}

              <button onClick={() => goToView("storage")} className="ml-auto px-4 py-2 rounded bg-gray-200 text-gray-700">Skip</button>
            </div>
          </div>
        )}

        {view === "barcode" && product && (
          <div>
            <div className="p-4 border rounded grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Product images</label>
                  <PhotoMetaEditor value={images} onChange={setImages} />
                </div>
                <div className="col-span-2 flex flex-col">
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input 
                    value={product.name || ''} 
                    onChange={e => setProductField('name', e.target.value)} 
                    className={`w-full px-3 py-2 rounded border border-gray-300 bg-gray-800`} />

                  <label className="block text-sm text-gray-400 mb-1 mt-2">Manufacturer</label>
                  <input 
                    value={product.manufacturer || ''} 
                    onChange={e => setProductField('manufacturer', e.target.value)} 
                    className={`w-full px-3 py-2 rounded border border-gray-300 bg-gray-800`} />


                  <div className="text-xs text-gray-500 mt-2">Barcode: {product.barcode}</div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                {productError !== null && (
                  <FieldError text={productError}/>
                )}

                <button onClick={() => { setProduct(null); setImages([]); }} className="ml-auto px-3 py-2 rounded bg-gray-200 text-gray-700">Scan again</button>
                <button onClick={handleUseBarcodeInfo} className="px-3 py-2 rounded bg-blue-600 text-white">Next</button>
              </div>
          </div>
        )}

        {view === "storage" && (
          <div className="flex flex-col flex-gap-1">
            {storageId === null && (
              <BarcodeScanner onDetected={onDetectedStorage} formats={['qr_code']} hintText="Scan storage sticker QR" />
            )}

            {storageIdError !== null && (
              <FieldError text={storageIdError}/>
            )} 

            <label className="block text-sm text-gray-400 mb-1 mt-8">Storage</label>
            <select value={storageId || ''} onChange={e => setStorageId(e.target.value)} className="flex-1 px-3 py-2 rounded border border-gray-300">
              <option value="">(no storage)</option>
              {storageUnits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            
            <div className="flex justify-end gap-2 mt-4">
              {storageId !== null && (
                <button onClick={() => { setStorageId(null); setStorageIdError(null); }} className="ml-auto px-3 py-2 rounded bg-gray-200 text-gray-700">Scan again</button>
              )}
              <button onClick={() => goToView("quantity")} className="px-3 py-2 rounded bg-blue-600 text-white">Continue</button>
            </div>
          </div>
        )}

        {view === "quantity" && (
          <div className="flex flex-col flex-gap-1">
            
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => goToView("resume")} className="px-3 py-2 rounded bg-blue-600 text-white">Continue</button>
            </div>
          </div>
        )}

        {view === "resume" && (
          <div className="flex flex-col flex-gap-1">
            
            <div className="flex justify-end gap-2 mt-6">
              <button className="px-4 py-2 rounded bg-gray-200 text-gray-700">Add item</button>
            </div>
          </div>
        )}

      </div>
    );
  }

  return [HELPER_ID, HELPER_NAME, HELPER_ICON, getJSX, setActive, goToPreviousView];
}
