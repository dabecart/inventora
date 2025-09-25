import { useEffect, useState, useRef } from "react";
// Icons.
import {  
    Pencil,
    Trash2,
    LogIn,
    LogOut,
    UploadCloud,
    Search,
    Plus,
    Minus,
    Camera,
    Image as ImageIcon,
    X as XIcon
} from "lucide-react";

import Inventora from './Inventora'
import { simpleId } from "./Utils";

export default function InventoraClient() {
  const [status, setStatus] = useState("Not signed in");

  const [mergeLog, setMergeLog] = useState([]);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Create/edit items/storage units.
  const [creatingItem, setCreatingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [creatingStorage, setCreatingStorage] = useState(null);
  const [editingStorage, setEditingStorage] = useState(null);

  // Search panel
  const [showFindItems, setShowFindItems] = useState(false);
  const [itemQuery, setItemQuery] = useState('');
  const [filterStorage, setFilterStorage] = useState('');

  const {
    itemMetaKeys,
    storageMetaKeys,
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

  // ---------------- Validation functions -------------------
  function validateItemFromNewForm(name, initialQty, storageUnitId, meta) {
    return handleCreateItem(name, initialQty, storageUnitId, meta, true) || null;
  }

  function validateItemFromEditForm(name, qty, storageUnitId, meta) {
    const nameErrors      = (editingItem.name !== name) ? 
                            handleRenameItem(editingItem.id, name, true) || null : 
                            null;
    const qtyErrors       = (editingItem.qty !== qty) ? 
                            handleSetQuantity(editingItem.id, qty, true) || null : 
                            null;
    const moveItemErrors  = (editingItem.storageUnitId !== storageUnitId) ? 
                            handleMoveItem(editingItem.id, storageUnitId, true) || null : 
                            null;
    let errorResults = [nameErrors, qtyErrors, moveItemErrors];

    // Meta updates
    Object.entries(meta || {}).forEach(([k, v]) => {
      if(k in editingItem.meta && !(k in meta)) {
        errorResults.push(handleRemoveItemMeta(editingItem.id, k, true) || null);
      }else if(k in meta && !(k in editingItem.meta)) {
        errorResults.push(handleSetItemMeta(editingItem.id, k, v, true) || null);
      }else {
        errorResults.push(
          (editingItem.meta[k] !== meta[k]) ? 
          handleSetItemMeta(editingItem.id, k, v, true) || null :
          null
        );
      }     
    });

    const errors = {};
    errorResults.forEach(err => {
      if(err === null) return;

      Object.entries(err).forEach(([k, v]) => {
        if(k === "meta") {
          if(!('meta' in errors)) errors.meta = {};

          Object.entries(v).forEach(([metaK, metaV]) => {
            errors.meta[metaK] = metaV;
          });
        }else {
          errors[k] = v;
        }
      });
    });
    return errors;
  }

  function validateStorageFromNewForm(name, meta) {
    return handleCreateStorage(name, meta, true) || null;
  }

  function validateStorageFromEditForm(name, meta) {
    const nameErrors      = (editingStorage.name !== name) ? 
                            handleRenameStorage(editingStorage.id, name, true) || null : 
                            null;
    let errorResults = [nameErrors];

    // Meta updates
    Object.entries(meta || {}).forEach(([k, v]) => {
      if(k in editingStorage.meta && !(k in meta)) {
        errorResults.push(handleRemoveStorageMeta(editingStorage.id, k, true) || null);
      }else if(k in meta && !(k in editingStorage.meta)) {
        errorResults.push(handleSetStorageMeta(editingStorage.id, k, v, true) || null);
      }else {
        errorResults.push(
          (editingStorage.meta[k] !== meta[k]) ? 
          handleSetStorageMeta(editingStorage.id, k, v, true) || null :
          null
        );
      }     
    });

    const errors = {};
    errorResults.forEach(err => {
      if(err === null) return;

      Object.entries(err).forEach(([k, v]) => {
        if(k === "meta") {
          if(!('meta' in errors)) errors.meta = {};

          Object.entries(v).forEach(([metaK, metaV]) => {
            errors.meta[metaK] = metaV;
          });
        }else {
          errors[k] = v;
        }
      });
    });
    return errors;
  }

  // ---------------- Search ----------------
  const filteredItems = (inventory.items || []).filter(it => {
    if (itemQuery && !it.name.toLowerCase().includes(itemQuery.toLowerCase())) return false;
    if (filterStorage && it.storageUnitId !== filterStorage) return false;
    return true;
  });

  function toggleFilterItems() {
    if(showFindItems) {
      setItemQuery('');
    }
    setShowFindItems(s => !s);
  }

  // ---------------- Render UI ----------------
  return (
    <div className="p-6 max-w-5xl w-full mx-auto">
      <header className="flex items-center justify-between my-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold" title="Manage your inventory cleanly">Inventora</h1>
        </div>

        <div className="flex items-center gap-2">
          {(localPendingActions.current || []).length === 0 ?
            <IconButton title="Nothing to push" className='bg-gray-600 text-white' disabled={true}><UploadCloud /></IconButton>
            :
            <IconButton title="Push pending" onClick={manualPush} className='bg-green-600 text-white'><UploadCloud /></IconButton>
          }

          {signedIn ? 
            <IconButton title="Log out" onClick={handleAuthButton} className="bg-red-600 text-white"><LogOut /></IconButton>
            :
            <IconButton title="Log in" onClick={handleAuthButton} className="bg-blue-600 text-white"><LogIn /></IconButton>
          }
        </div>
      </header>

      <div className="ml-4 text-sm text-white flex flex-col grow items-end">
        <p>User: {userId || '(anonymous)'}</p>      
        <span>Status: {status}</span>
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
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Items</h2>
          <div className="flex gap-2">
            <IconButton title="Find items" onClick={toggleFilterItems} className="bg-gray-700 text-white"><Search /></IconButton>
            <IconButton title="Create item" onClick={() => setCreatingItem(true)} className="bg-blue-600 text-white"><Plus /></IconButton>
          </div>
        </div>

        {showFindItems && (
          <div className="mb-3 p-3 bg-gray-800 rounded">
            <div className="flex gap-2">
              <input value={itemQuery} onChange={e => setItemQuery(e.target.value)} placeholder="Search by name..." className="flex-1 px-3 py-2 rounded bg-gray-700 text-white" />
              <select value={filterStorage} onChange={e => setFilterStorage(e.target.value)} className="px-3 py-2 rounded bg-gray-700 text-white">
                <option value="">All storages</option>
                {(storageUnits.units || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}

        <table className="text-left w-full mt-3 table-auto text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Qty</th>
              <th>Storage</th>
            </tr>
          </thead>
          <tbody>
            {(filteredItems || []).map(it => {
              const storage = (storageUnits.units || []).find(u => u.id === it.storageUnitId);
              return (
                <tr key={it.id} className="border-t">
                  <td title={it.id}>{it.name}</td>
                  <td>{it.qty}</td>
                  <td title={it.storageUnitId}>{storage ? storage.name : "(no storage)"}</td>
                  <td className="flex gap-1 my-1 justify-end">
                    <button onClick={() => handleAddCount(it.id, 1)} className="p-1 rounded bg-green-600 text-white text-xs"><Plus size={16} /></button>
                    <button onClick={() => handleAddCount(it.id, -1)} className="p-1 rounded bg-orange-500 text-white text-xs" disabled={it.qty === 0}><Minus size={16} /></button>
                    <button onClick={() => setEditingItem(it)} className="p-1 rounded bg-gray-600 text-white text-xs"><Pencil size={16} /></button>
                    <button onClick={() => handleDeleteItem(it.id)} className="p-1 rounded bg-red-600 text-white text-xs"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 border rounded">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Storage Units</h2>
          <div className="flex gap-2">
            <IconButton title="Create storage unit" onClick={() => setCreatingStorage(true)} className="bg-blue-600 text-white"><Plus /></IconButton>
          </div>
        </div>
        <ul className="mt-3">
          {storageUnits.units && storageUnits.units.length ?
            storageUnits.units.map(u => (
              <li key={u.id} className="flex justify-between items-center py-1 border-b">
                <div title={u.id}>{u.name}<span className="text-xs text-gray-500 ml-1">({u.id})</span></div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingStorage(u)} className="p-1 rounded bg-gray-600 text-white text-xs"><Pencil size={16} /></button>
                  <button onClick={() => handleDeleteStorage(u.id)} className="p-1 rounded bg-red-600 text-white text-xs"><Trash2 size={16} /></button>
                </div>
              </li>
            )) : <li className="text-sm text-gray-500">No storage units</li>}
        </ul>
      </div>

      {creatingItem && (
        <EditItemModal
          title="Create item"
          storageUnits={storageUnits.units}
          metaKeys={itemMetaKeys}
          onSave={(updated) => {
            // Apply everything in bulk.
            handleCreateItem(updated.name, updated.qty, updated.storageUnitId, updated.meta);
            setCreatingItem(null);
          }}
          onDiscard={() => setCreatingItem(null)}
          validationFunction={validateItemFromNewForm}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          storageUnits={storageUnits.units}
          metaKeys={itemMetaKeys}
          onSave={(updated) => {
            // Apply everything in bulk.
            handleRenameItem(editingItem.id, updated.name);
            handleSetQuantity(editingItem.id, updated.qty);
            handleMoveItem(editingItem.id, updated.storageUnitId);
            Object.entries(updated.meta).forEach(([k, v]) => {
              handleSetItemMeta(editingItem.id, k, v);
            });
            Object.keys(editingItem.meta || {}).forEach(k => {
              if (!(k in updated.meta)) {
                handleRemoveItemMeta(editingItem.id, k);
              }
            });
            setEditingItem(null);
          }}
          onDiscard={() => setEditingItem(null)}
          validationFunction={validateItemFromEditForm}
        />
      )}

      {creatingStorage && (
        <EditStorageModal
          title="Create Storage Unit"
          metaKeys={storageMetaKeys}
          onSave={(updated) => {
            // Apply everything in bulk.
            handleCreateStorage(updated.name, updated.meta);
            setCreatingStorage(null);
          }}
          onDiscard={() => setCreatingStorage(null)}
          validationFunction={validateStorageFromNewForm}
        />
      )}

      {editingStorage && (
        <EditStorageModal
          unit={editingStorage}
          metaKeys={storageMetaKeys}
          onSave={(updated) => {
            handleRenameStorage(editingStorage.id, updated.name);
            Object.entries(updated.meta).forEach(([k, v]) => {
              handleSetStorageMeta(editingStorage.id, k, v);
            });
            Object.keys(editingStorage.meta || {}).forEach(k => {
              if (!(k in updated.meta)) {
                handleRemoveStorageMeta(editingStorage.id, k);
              }
            });
            setEditingStorage(null);
          }}
          onDiscard={() => setEditingStorage(null)}
          validationFunction={validateStorageFromEditForm}
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

function FieldError({ text, className = '' }) {
  if (!text) return null;
  return <div className={`text-xs text-red-400 mt-1 ${className}`}>{text}</div>;
}

function IconButton({ title, onClick, children, className = '', isDisabled = false }) {
  return (
    <button onClick={onClick} disabled={isDisabled} title={title} className={`flex items-center justify-center p-1 rounded-md hover:opacity-90 h-full ${className}`}>
      {children}
    </button>
  );
}

function EditItemModal({ title = 'Edit Item', item = {}, storageUnits = [], metaKeys = [], onSave, onDiscard, validationFunction }) {
  const [name, setName] = useState(item.name || '');
  const [qty, setQty] = useState(item.qty ?? 0);
  const [storageId, setStorageId] = useState(item.storageUnitId || '');
  const [meta, setMeta] = useState({ ...(item.meta || {}) });

  const errors = validationFunction(name, Number(qty), storageId, meta) || {};

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

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg w-full max-w-2xl p-6 m-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onDiscard} className="p-2 rounded-md"><XIcon /></button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full">
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

          <div className="w-full">
            <label className="block text-sm text-gray-400 mb-1">Meta</label>
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
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

function EditStorageModal({ title = 'Edit Storage', unit = {}, metaKeys = [], onSave, onDiscard, validationFunction}) {
  const [name, setName] = useState(unit.name || '');
  const [meta, setMeta] = useState({ ...(unit.meta || {}) });

  const errors = validationFunction(name.trim(), meta) || {};

  function handleSave() {
    const formErr = validationFunction(name.trim(), meta) || {};
    if(Object.keys(formErr).length === 0){
      onSave({ name: name.trim(), meta });
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg w-full max-w-xl p-6 m-2">
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
            <label className="block text-sm text-gray-400 mb-1">Meta</label>
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
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

function MetaEditor({ meta: initialMeta = {}, allowedKeys = [], onChange, validationErrors = {} }) {
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
                  className={`col-span-5 w-full px-3 py-2 rounded border text-sm ${validationErrors[k] ? 'border-red-500' : 'border-gray-300'} bg-gray-50 dark:bg-gray-800`} 
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

function PhotoMetaEditor({ value = [], onChange, className = '', maxSizeKB = 1024 }) {
  const [items, setItems] = useState(Array.isArray(value) ? value.slice() : []);
  // For full-screen preview
  const [preview, setPreview] = useState(null); 
  // For dropping images.
  const [isHighlighted, setIsHighlighted] = useState(false);
  const dropRef = useRef();
  const dragCounter = useRef(0);

  useEffect(() => onChange && onChange(items), [items]);

  // --- Image helpers ---
  function resizeAndCompress(file, callback) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Target dimensions: keep aspect ratio, max ~1200px wide.
        const maxDim = 1200;
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Compress quality adaptively.
        let quality = 0.9;
        let dataUrl;
        do {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
          if (sizeKB / 1024 <= maxSizeKB) break;
          quality -= 0.1;
        } while (quality > 0.3);

        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function addFromFile(file) {
    resizeAndCompress(file, result => {
      setItems(it => [...it, { id: `p-${simpleId()}`, src: result }]);
    });
  }

  function handleFiles(files) {
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        addFromFile(file);
      }
    }
  }

  function removeItem(id) {
    setItems(it => it.filter(i => i.id !== id));
  }

  // --- Drag & Drop ---
  useEffect(() => {
    const container = dropRef.current;
    if (!container) return;

    const dropZone = container.querySelector('.photo-drop-zone') || container;

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    function onDragEnter(e) {
      preventDefaults(e);
      dragCounter.current++;
      setIsHighlighted(true);
    }
    function onDragLeave(e) {
      preventDefaults(e);
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setIsHighlighted(false);
    }
    function onDrop(e) {
      preventDefaults(e);
      setIsHighlighted(false);
      dragCounter.current = 0;
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) handleFiles(dt.files);
    }
    function onDragOver(e) {
      preventDefaults(e);
    }

    ['dragenter'].forEach(ev => dropZone.addEventListener(ev, onDragEnter));
    ['dragleave'].forEach(ev => dropZone.addEventListener(ev, onDragLeave));
    ['dragover'].forEach(ev => dropZone.addEventListener(ev, onDragOver));
    ['drop'].forEach(ev => dropZone.addEventListener(ev, onDrop));

    return () => {
      ['dragenter'].forEach(ev => dropZone.removeEventListener(ev, onDragEnter));
      ['dragleave'].forEach(ev => dropZone.removeEventListener(ev, onDragLeave));
      ['dragover'].forEach(ev => dropZone.removeEventListener(ev, onDragOver));
      ['drop'].forEach(ev => dropZone.removeEventListener(ev, onDrop));
    };
  }, []);

  return (
    <div ref={dropRef} className={`w-full h-full space-y-2 relative ${className}`}>
      <div
        className={`border-2 rounded-md p-4 flex items-center justify-center text-center transition-colors ${isHighlighted ? "border-solid border-blue-500" : "border-dashed border-gray-600"}`}
      >
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded cursor-pointer">
            <Camera size={18} />
            <input
              accept="image/*"
              capture="environment"
              type="file"
              multiple
              onChange={e => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = null;
              }}
              className="hidden"
            />
          </label>
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded cursor-pointer">
            <ImageIcon size={18} />
            <input
              accept="image/*"
              type="file"
              multiple
              onChange={e => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = null;
              }}
              className="hidden"
            />
          </label>
          <span className="text-xs text-gray-400">Drag & drop images here</span>
        </div>
      </div>

      {/* Thumbnails */}
      {
        items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map(it => (
            <div
              key={it.id}
              className="relative border rounded overflow-hidden cursor-pointer"
              onClick={() => setPreview(it.src)}
            >
              <img src={it.src} alt="meta" className="object-cover w-full h-24" />
              <button
                onClick={e => {
                  e.stopPropagation();
                  removeItem(it.id);
                }}
                className="absolute top-1 right-1 bg-black bg-opacity-50 p-2 rounded text-white"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
        )
      }

      {/* Fullscreen Preview */}
      {preview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            alt="preview"
            className="max-w-full max-h-full cursor-pointer"
          />
          <button
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 bg-black bg-opacity-70 p-2 rounded text-white"
          >
            <XIcon size={20} />
          </button>
        </div>
      )}
    </div>
  );
}