import { useEffect, useState } from "react";
// Icons.
import {  
    Pencil,
    Trash2,
    LogOut,
    UploadCloud,
    Search,
    Plus,
    Minus,
    Camera,
    Image as ImageIcon,
    X as XIcon,
    Check
} from "lucide-react";

import Inventora from './Inventora'

export default function InventoraClient() {
  const [status, setStatus] = useState("Not signed in");

  const [mergeLog, setMergeLog] = useState([]);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [editingStorage, setEditingStorage] = useState(null);

  const {
    signedIn,
    userId,
    inventory,
    storageUnits,
    localPendingActions,
    handleAuthButton,
    pushLocalPending,
    mergeRemoteActions,
    handleCreateItem, 
    handleDeleteItem, 
    handleRenameItem, 
    handleCreateStorage, 
    handleDeleteStorage, 
    handleRenameStorage, 
    handleSetQuantity, 
    handleAddCount, 
    handleMoveItem, 
    handleSetItemMeta, 
    handleRemoveItemMeta, 
    handleSetStorageMeta, 
    handleRemoveStorageMeta
  } = Inventora(setStatus, setMergeLog, setUpdateAvailable);

  // ---------------- UI actions: sign-in, push pending, manual merge ----------------
  async function manualPush() {
    setStatus('Pushing local pending...');
    try { 
      await pushLocalPending(); 
      setStatus('Push done'); 
    } catch (e) { 
      setStatus('Push failed: ' + e.message); 
    }
  }

  async function manualMerge() {
    setStatus('Merge actions pending...');
    try { 
      await mergeRemoteActions(0); 
      setStatus('Merge done'); 
    } catch (e) { 
      setStatus('Merge failed: ' + e.message); 
    }
  }

  // ---------------- Render UI ----------------
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inventora</h1>
      <div className="mb-4 flex">
        <button onClick={handleAuthButton} className="px-3 py-1 rounded bg-blue-600 text-white mr-2">
          {signedIn ? 'Log out' : 'Sign in'}
        </button>
        <button onClick={manualPush} className="px-3 py-1 rounded bg-green-600 text-white mr-2">Push</button>
        <div className="ml-4 text-sm text-white flex flex-col grow items-end">
          <p>User: {userId || '(anonymous)'}</p>      
          <span>Status: {status}</span>
        </div>
      </div>

      {updateAvailable && (
        <div className="mt-4 p-4 bg-yellow-200 border border-yellow-600 rounded">
          <div className="font-bold text-yellow-800 mb-2">New actions detected!</div>
          <div className="mb-2 text-yellow-800">There are new actions in the database since your last update. Reload inventory and storage?</div>
          <button
            className="px-3 py-1 rounded bg-yellow-600 text-white mr-2"
            onClick={async () => {
              // Ask user if they want to keep local pending actions.
              if (localPendingActions.current.length > 0) {
                if (!window.confirm("You have unsaved local actions. Do you want to discard them and reload?")) return;
                localPendingActions.current = [];
              }
              await loadMasters();
              setUpdateAvailable(false);
              setMergeLog(l => ["Reloaded inventory and storage from Drive", ...l]);
            }}
          >
            Reload Inventory & Storage
          </button>
        </div>
      )}

      <div className="mt-6 p-4 border rounded">
        <h2 className="font-semibold">Items</h2>
        <table className="w-full mt-3 table-auto text-sm">
          <thead>
            <tr className="text-left">
              <th>Name</th>
              <th>Qty</th>
              <th>Storage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(inventory.items || []).map(it => {
              const storage = (storageUnits.units || []).find(u => u.id === it.storageUnitId);
              return (
                <tr key={it.id} className="border-t">
                  <td title={it.id}>{it.name}</td>
                  <td>{it.qty}</td>
                  <td title={it.storageUnitId}>{storage ? storage.name : "(no storage)"}</td>
                  <td className="flex gap-1 my-1">
                    <button onClick={() => handleAddCount(it.id, 1)} className="p-1 rounded bg-green-600 text-white text-xs"><Plus size={14} /></button>
                    <button onClick={() => handleAddCount(it.id, -1)} className="p-1 rounded bg-orange-500 text-white text-xs" disabled={it.qty === 0}><Minus size={14} /></button>
                    <button onClick={() => setEditingItem(it)} className="p-1 rounded bg-gray-600 text-white text-xs"><Pencil size={14} /></button>
                    <button onClick={() => handleDeleteItem(it.id)} className="p-1 rounded bg-red-600 text-white text-xs"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 border rounded">
        <h2 className="font-semibold">Storage Units</h2>
        <ul className="mt-3">
          {storageUnits.units && storageUnits.units.length ?
            storageUnits.units.map(u => (
              <li key={u.id} className="flex justify-between items-center py-1 border-b">
                <div title={u.id}>{u.name}<span className="text-xs text-gray-500 ml-1">({u.id})</span></div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingStorage(u)} className="p-1 rounded bg-gray-600 text-white text-xs"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteStorage(u.id)} className="p-1 rounded bg-red-600 text-white text-xs"><Trash2 size={14} /></button>
                </div>
              </li>
            )) : <li className="text-sm text-gray-500">No storage units</li>}
        </ul>
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          storageUnits={storageUnits.units}
          onSave={(updated) => {
            // TODO.
            setEditingItem(null);
          }}
          onDiscard={() => setEditingItem(null)}
        />
      )}

      {editingStorage && (
        <EditStorageModal
          unit={editingStorage}
          onSave={(updated) => {
            // TODO
            setEditingStorage(null);
          }}
          onDiscard={() => setEditingStorage(null)}
        />
      )}

      <div className="mt-6 border rounded">
        <details>
          <summary className="cursor-pointer px-4 py-2 bg-gray-600 font-semibold">Debug</summary>
          <div className="p-4 space-y-4">
            <button onClick={manualMerge} className="px-3 py-1 rounded bg-orange-600 text-white">Manual Merge</button>

            <div>
              <h3 className="font-semibold">Local pending actions</h3>
              <pre className="text-xs max-h-40 overflow-auto bg-gray-500 p-2">{JSON.stringify(localPendingActions.current, null, 2)}</pre>
            </div>

            <div>
              <h3 className="font-semibold">Merge Log</h3>
              <div className="text-xs max-h-40 overflow-auto bg-gray-500 p-2">
                {mergeLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

function FieldError({ text }) {
  if (!text) return null;
  return <div className="text-xs text-red-400 mt-1">{text}</div>;
}

function EditItemModal({ title = 'Edit Item', item = {}, storageUnits = [], onSave, onDiscard }) {
  const [name, setName] = useState(item.name || '');
  const [qty, setQty] = useState(item.qty ?? 0);
  const [storageId, setStorageId] = useState(item.storageUnitId || '');
  const [meta, setMeta] = useState({ ...(item.meta || {}) });

  const [errors, setErrors] = useState({});

  useEffect(() => setErrors(validateItemForm({ name, qty })), [name, qty]);

  function handleSave() {
    const formErr = validateItemForm({ name, qty });
    if (Object.keys(formErr).length) { setErrors(formErr); return; }
    onSave({ name: name.trim(), qty: Number(qty), storageUnitId: storageId || null, meta });
  }

  const metaKeys = ['tags','part number','serial number','link','manufacturer','datasheet link','photos'];

  const hasErrors = Object.keys(errors).length > 0 || Object.entries(meta).some(([k,v]) => validateMetaField(k,v));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onDiscard} className="p-2 rounded-md"><XIcon /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={`w-full px-3 py-2 rounded border ${errors.name ? 'border-red-500' : 'border-gray-300'} bg-gray-50 dark:bg-gray-800`} />
            <FieldError text={errors.name} />

            <label className="block text-sm text-gray-400 mt-4 mb-1">Quantity</label>
            <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} className={`w-full px-3 py-2 rounded border ${errors.qty ? 'border-red-500' : 'border-gray-300'} bg-gray-50 dark:bg-gray-800`} />
            <FieldError text={errors.qty} />

            <label className="block text-sm text-gray-400 mt-4 mb-1">Storage</label>
            <select value={storageId || ''} onChange={e => setStorageId(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-50 dark:bg-gray-800">
              <option value="">(no storage)</option>
              {storageUnits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Meta</label>
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <MetaEditor meta={meta} allowedKeys={metaKeys} onChange={m => setMeta(m)} validateField={validateMetaField} />
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

function EditStorageModal({ title = 'Edit Storage', unit = {}, onSave, onDiscard }) {
  const [name, setName] = useState(unit.name || '');
  const [meta, setMeta] = useState({ ...(unit.meta || {}) });
  const [errors, setErrors] = useState({});

  useEffect(() => setErrors(validateStorageForm({ name })), [name]);

  function handleSave() {
    const formErr = validateStorageForm({ name });
    if (Object.keys(formErr).length) { setErrors(formErr); return; }
    onSave({ name: name.trim(), meta });
  }

  const storageMetaKeys = ['location','capacity','description','photos'];
  const hasErrors = Object.keys(errors).length > 0 || Object.entries(meta).some(([k,v]) => validateMetaField(k,v));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg w-full max-w-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onDiscard} className="p-2 rounded-md"><XIcon /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={`w-full px-3 py-2 rounded border ${errors.name ? 'border-red-500' : 'border-gray-300'} bg-gray-50 dark:bg-gray-800`} />
            <FieldError text={errors.name} />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Meta</label>
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <MetaEditor meta={meta} allowedKeys={storageMetaKeys} onChange={m => setMeta(m)} validateField={validateMetaField} />
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

function MetaEditor({ meta: initialMeta = {}, allowedKeys = [], onChange, validateField }) {
  const [meta, setMeta] = useState({ ...initialMeta });
  const available = allowedKeys.filter(k => !(k in meta));

  useEffect(() => onChange && onChange(meta), [meta]);

  function setKeyValue(key, value) {
    setMeta(m => ({ ...m, [key]: value }));
  }
  function removeKey(key) {
    setMeta(m => { const n = { ...m }; delete n[key]; return n; });
  }
  function addKey(key) {
    if (!key) return;
    setMeta(m => ({ ...m, [key]: '' }));
  }

  return (
    <div>
      <div className="space-y-2">
        {Object.entries(meta).map(([k, v]) => (
          <div key={k} className="flex gap-2 items-start">
            <div className="w-36 text-sm text-gray-300">{k}</div>
            {k === 'photos' ? (
              <PhotoMetaEditor value={v} onChange={(val) => setKeyValue(k, val)} validate={validateField} />
            ) : (
              <div className="flex-1">
                <input
                  value={v}
                  onChange={e => setKeyValue(k, e.target.value)}
                  className="w-full px-2 py-1 rounded bg-gray-800 text-white border border-gray-700"
                />
                <FieldError text={validateField ? validateField(k, v) : null} />
              </div>
            )}
            <button onClick={() => removeKey(k)} className="px-2 py-1 text-sm text-red-400">Remove</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <select defaultValue="" className="px-2 py-1 bg-gray-800 text-white border border-gray-700 rounded" onChange={e => addKey(e.target.value)}>
          <option value="">Add meta...</option>
          {available.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
    </div>
  );
}

function PhotoMetaEditor({ value = [], onChange, validate }) {
  // value is array of { id, src } where src can be dataURL or remote url
  const [items, setItems] = useState(Array.isArray(value) ? value.slice() : []);

  useEffect(() => onChange && onChange(items), [items]);

  function addFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      setItems(it => [...it, { id: `p-${simpleId()}`, src: reader.result }]);
    };
    reader.readAsDataURL(file);
  }

  function removeItem(id) {
    setItems(it => it.filter(i => i.id !== id));
  }

  return (
    <div className="space-y-2 w-full">
      <div className="flex gap-2">
        <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded cursor-pointer">
          <Camera size={16} />
          <input accept="image/*" capture="environment" type="file" onChange={e => { if (e.target.files && e.target.files[0]) addFromFile(e.target.files[0]); e.target.value = null; }} className="hidden" />
        </label>
        <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded cursor-pointer">
          <ImageIcon size={16} />
          <input accept="image/*" type="file" onChange={e => { if (e.target.files && e.target.files[0]) addFromFile(e.target.files[0]); e.target.value = null; }} className="hidden" />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map(it => (
          <div key={it.id} className="relative border rounded overflow-hidden">
            <img src={it.src} alt="meta" className="object-cover w-full h-24" />
            <button onClick={() => removeItem(it.id)} className="absolute top-1 right-1 bg-black bg-opacity-50 p-1 rounded text-white"><XIcon size={12} /></button>
          </div>
        ))}
      </div>
      <FieldError text={validate ? validate('photos', items) : null} />
    </div>
  );
}