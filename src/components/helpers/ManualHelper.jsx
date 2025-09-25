import MetaEditor from "../MetaEditor";
import FieldError from "../FieldError";

export default function ManualHelper({ storageUnits, metaKeys, name, setName, qty, setQty, storageId, setStorageId, meta, setMeta, errors }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="w-full">
        <label className="block text-sm text-gray-400 mb-1">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} className={`w-full px-3 py-2 rounded border ${errors.name ? 'border-red-500' : 'border-gray-300'} bg-gray-800`} />
        <FieldError text={errors.name} />

        <label className="block text-sm text-gray-400 mt-4 mb-1">Quantity</label>
        <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} className={`w-full px-3 py-2 rounded border ${errors.qty ? 'border-red-500' : 'border-gray-300'} bg-gray-800`} />
        <FieldError text={errors.qty} />

        <label className="block text-sm text-gray-400 mt-4 mb-1">Storage</label>
        <select value={storageId || ''} onChange={e => setStorageId(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-800">
          <option value="">(no storage)</option>
          {storageUnits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="w-full">
        <label className="block text-sm text-gray-400 mb-1">Meta</label>
        <div className="p-2 bg-gray-800 rounded">
          <MetaEditor meta={meta} allowedKeys={metaKeys} onChange={m => setMeta(m)} validationErrors={errors.meta || {}} />
        </div>
      </div>
    </div>
  );
}