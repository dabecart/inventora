import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import PhotoMetaEditor from "./PhotoMetaEditor";
import IconButton from "./IconButton";
import FieldError from "./FieldError";

export default function MetaEditor({ meta: initialMeta = {}, allowedKeys = [], onChange, validationErrors = {} }) {
  const [meta, setMeta] = useState({ ...initialMeta });
  const available = allowedKeys.filter(k => !(k in meta));

  useEffect(() => onChange && onChange(meta), [meta]);

  function setKeyValue(key, value) {
    setMeta(m => ({ ...m, [key]: value }));
  }
  function removeKey(key) {
    setMeta(m => {
      const n = { ...m };
      delete n[key];
      return n;
    });
  }
  function addKey(key) {
    if (!key) return;
    setMeta(m => ({ ...m, [key]: '' }));
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-64">
      {Object.entries(meta).map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <label className="block text-sm text-gray-400 mb-1">{k}</label>
          <div>
            {k === 'Photos' ? (
              <div className="grid grid-cols-6 gap-3 items-stretch">
                <PhotoMetaEditor
                  value={v}
                  onChange={val => setKeyValue(k, val)}
                  className="col-span-5"
                />
                <IconButton title={`Delete meta "${k}"`}  onClick={() => removeKey(k)} className='bg-red-600 text-white'><Trash2 /></IconButton>
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-3">
                <input 
                  value={v} 
                  onChange={e => setKeyValue(k, e.target.value)} 
                  className={`col-span-5 w-full px-3 py-2 rounded border text-sm ${validationErrors[k] ? 'border-red-500' : 'border-gray-300'} bg-gray-800`} 
                />
                <IconButton title={`Delete meta "${k}"`}  onClick={() => removeKey(k)} className='bg-red-600 text-white'><Trash2 /></IconButton>
              </div>
            )}

            <FieldError text={validationErrors[k]} />

          </div>
        </div>
      ))}

      <div>
        <select
          defaultValue=""
          className="px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded"
          onChange={e => addKey(e.target.value)}
        >
          <option value="">Add meta...</option>
          {available.map(k => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
