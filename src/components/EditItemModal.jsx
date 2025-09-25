import { useState } from "react";
import { XIcon } from "lucide-react";

import ManualHelper from "./helpers/ManualHelper";

export default function EditItemModal({ title = 'Edit Item', item = {}, storageUnits = [], metaKeys = [], onSave, onDiscard, validationFunction }) {
  const [name, setName] = useState(item.name || '');
  const [qty, setQty] = useState(item.qty ?? 0);
  const [storageId, setStorageId] = useState(item.storageUnitId || '');
  const [meta, setMeta] = useState({ ...(item.meta || {}) });

  const errors = validationFunction(name, Number(qty), storageId, meta) || {};
  const hasErrors = Object.keys(errors).length > 0;

  function handleSave() {
    const formErr = validationFunction(name, Number(qty), storageId, meta) || {};
    if(Object.keys(formErr).length === 0){
      onSave({ 
        name: name.trim(), 
        qty: Number(qty), 
        storageUnitId: storageId || null, 
        meta 
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg w-full max-w-2xl p-6 m-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onDiscard} className="p-2 rounded-md"><XIcon /></button>
        </div>

        <ManualHelper
          storageUnits={storageUnits} 
          metaKeys={metaKeys} 
          name={name} 
          setName={setName} 
          qty={qty} 
          setQty={setQty} 
          storageId={storageId} 
          setStorageId={setStorageId} 
          meta={meta} 
          setMeta={setMeta} 
          errors={errors}
        ></ManualHelper>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onDiscard} className="px-4 py-2 rounded bg-gray-200 text-gray-700">Discard</button>
          <button onClick={handleSave} disabled={hasErrors} className={`px-4 py-2 rounded ${hasErrors ? 'bg-gray-400 text-gray-700' : 'bg-blue-600 text-white'}`}>Save</button>
        </div>
      </div>
    </div>
  );
}
