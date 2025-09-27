import { useState } from "react";
import MetaEditor from "./MetaEditor";
import FieldError from "./FieldError";
import { XIcon, QrCode } from "lucide-react";

export default function EditStorageModal({ title = 'Edit Storage', unit = {}, metaKeys = [], onSave, onDiscard, validationFunction}) {
  const [name, setName] = useState(unit.name || '');
  const [meta, setMeta] = useState({ ...(unit.meta || {}) });

  const errors = validationFunction(name.trim(), meta) || {};
  const hasErrors = Object.keys(errors).length > 0;

  function handleSave() {
    const formErr = validationFunction(name.trim(), meta) || {};
    if(Object.keys(formErr).length === 0){
      onSave({ name: name.trim(), meta });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-900 text-gray-900 text-white rounded-lg w-full max-w-xl p-6 m-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onDiscard} className="p-2 rounded-md"><XIcon /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={`w-full px-3 py-2 rounded border ${errors.name ? 'border-red-500' : 'border-gray-300'} bg-gray-800`} />
            <FieldError text={errors.name} />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Meta</label>
            <div className="p-2 bg-gray-800 rounded">
              <MetaEditor meta={meta} allowedKeys={metaKeys} onChange={m => setMeta(m)} validationErrors={errors.meta || {}} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onDiscard} className="px-4 py-2 rounded bg-gray-200 text-gray-700">Discard</button>
          <button onClick={handleSave} disabled={hasErrors} className={`px-4 py-2 rounded ${hasErrors ? 'bg-gray-400 text-gray-700' : 'bg-blue-600 text-white'}`}>Save</button>
        </div>
      </div>
    </div>
  );
}
