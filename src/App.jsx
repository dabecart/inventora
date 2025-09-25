import { useState } from "react";
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
} from "lucide-react";

import Inventora from './Inventora'
import IconButton from "./components/IconButton";

import HelpersMenu from "./components/HelpersMenu";
import EditItemModal from "./components/EditItemModal";
import EditStorageModal from "./components/EditStorageModal";

export default function InventoraClient() {
  const [status, setStatus] = useState("Not signed in");

  const [mergeLog, setMergeLog] = useState([]);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Create/edit items/storage units.
  const [editingItem, setEditingItem] = useState(null);
  const [creatingStorage, setCreatingStorage] = useState(null);
  const [editingStorage, setEditingStorage] = useState(null);

  const [showCreateMenu, setShowCreateMenu] = useState(false);

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
            <IconButton title="Create item" onClick={() => setShowCreateMenu(true)} className="bg-blue-600 text-white"><Plus /></IconButton>
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

      {showCreateMenu && (
        <HelpersMenu
          onSave={(updated) => {
            handleCreateItem(updated.name, updated.qty, updated.storageUnitId, updated.meta);
            setShowCreateMenu(false);
          }}
          onClose={() => { setShowCreateMenu(false); }}
          storageUnits={storageUnits.units}
          metaKeys={itemMetaKeys}
          validationFunction={validateItemFromNewForm}
          handleCreateItem={handleCreateItem}
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
