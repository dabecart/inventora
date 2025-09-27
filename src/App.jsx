import { useState } from "react";
// Icons.
import {  
    Pencil,
    Trash2,
    Search,
    Plus,
    Minus,
    QrCode
} from "lucide-react";

import Inventora from './Inventora'
import IconButton from "./components/IconButton";

import MenuHeader from "./components/MenuHeader";
import HelpersMenu from "./components/HelpersMenu";
import EditItemModal from "./components/EditItemModal";
import EditStorageModal from "./components/EditStorageModal";
import CreateStickerModal from "./components/CreateStickerModal";

export default function InventoraClient() {
  const [status, setStatus] = useState("Not signed in");

  const [mergeLog, setMergeLog] = useState([]);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Create/edit items/storage units.
  const [editingItem, setEditingItem] = useState(null);
  const [creatingStorage, setCreatingStorage] = useState(null);
  const [editingStorage, setEditingStorage] = useState(null);
  const [creatingSticker, setCreatingSticker] = useState(null);

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
    inventora,
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
          (JSON.stringify(editingItem.meta[k]) !== JSON.stringify(meta[k])) ? 
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
          (JSON.stringify(editingStorage.meta[k]) !== JSON.stringify(meta[k])) ? 
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
  const filteredItems = (inventora.inventory.items || []).filter(it => {
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
    <div className="p-2 max-w-5xl w-full mx-auto">

      <MenuHeader signedIn={signedIn} userId={userId} status={status} manualPush={manualPush} localPendingActions={localPendingActions} handleAuthButton={handleAuthButton}/>

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

      <div className="mt-6 p-2 sm:p-4 border rounded">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold p-2 sm:p-0">Items</h2>
          <div className="flex gap-2">
            <IconButton title="Find items" onClick={toggleFilterItems} className="bg-gray-700 text-white"><Search /></IconButton>
            <IconButton title="Create item" onClick={() => setShowCreateMenu(true)} className="bg-blue-600 text-white"><Plus /></IconButton>
          </div>
        </div>

        {showFindItems && (
          <div className="mb-3 sm:p-3 rounded">
            <div className="flex gap-2">
              <input value={itemQuery} onChange={e => setItemQuery(e.target.value)} placeholder="Search by name..." className="flex-1 px-1 py-2 rounded bg-gray-700 text-white" />
              <select value={filterStorage} onChange={e => setFilterStorage(e.target.value)} className="px-3 py-2 rounded bg-gray-700 text-white">
                <option value="">All storages</option>
                {(inventora.storageUnits.units || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="max-h-[33vh] overflow-y-auto">
          <table className="text-left w-full table-auto text-sm border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1">Qty</th>
                <th className="px-2 py-1">Storage</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {(filteredItems || []).map(it => {
                const storage = (inventora.storageUnits.units || []).find(u => u.id === it.storageUnitId);
                return (
                  <tr key={it.id} className="border-t align-middle">
                    <td title={it.id} className="px-2 py-2">{it.name}</td>
                    <td className="px-2 py-2">{it.qty}</td>
                    <td title={it.storageUnitId} className="px-2 py-2">
                      {storage ? storage.name : "(no storage)"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1 justify-end items-center">
                        <button
                          onClick={() => handleAddCount(it.id, 1)}
                          className="p-1 rounded bg-green-600 text-white text-xs"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => handleAddCount(it.id, -1)}
                          className="p-1 rounded bg-orange-500 text-white text-xs disabled:opacity-50"
                          disabled={it.qty === 0}
                        >
                          <Minus size={16} />
                        </button>
                        <button
                          onClick={() => setEditingItem(it)}
                          className="p-1 rounded bg-gray-600 text-white text-xs"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(it.id)}
                          className="p-1 rounded bg-red-600 text-white text-xs"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 p-2 sm:p-4 border rounded">
        <div className="flex justify-between items-center mb-3 p-2 sm:p-0">
          <h2 className="text-lg font-semibold">Storage Units</h2>
          <div className="flex gap-2">
            <IconButton title="Create storage unit" onClick={() => setCreatingStorage(true)} className="bg-blue-600 text-white"><Plus /></IconButton>
          </div>
        </div>

        <div className="max-h-[33vh] overflow-y-auto">
          <ul>
            {inventora.storageUnits.units && inventora.storageUnits.units.length ?
              inventora.storageUnits.units.map((u, index) => (
                <li key={u.id} className={`flex justify-between items-center p-2 ${index !== 0 && ("border-t")}`}>
                  <div title={u.id}>{u.name}<span className="text-xs text-gray-500 ml-1">({u.id})</span></div>
                  <div className="flex gap-1">
                    <button onClick={() => setCreatingSticker(u)} className="p-1 rounded bg-pink-600 text-white text-xs"><QrCode size={16} /></button>
                    <button onClick={() => setEditingStorage(u)} className="p-1 rounded bg-gray-600 text-white text-xs"><Pencil size={16} /></button>
                    <button onClick={() => handleDeleteStorage(u.id)} className="p-1 rounded bg-red-600 text-white text-xs"><Trash2 size={16} /></button>
                  </div>
                </li>
              )) : <li className="text-sm text-gray-500">No storage units</li>}
          </ul>
        </div>
      </div>

      {showCreateMenu && (
        <HelpersMenu
          onSave={(updated) => {
            handleCreateItem(updated.name, updated.qty, updated.storageUnitId, updated.meta);
            setShowCreateMenu(false);
          }}
          onClose={() => { setShowCreateMenu(false); }}
          storageUnits={inventora.storageUnits.units}
          metaKeys={itemMetaKeys}
          validationFunction={validateItemFromNewForm}
          handleCreateItem={handleCreateItem}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          storageUnits={inventora.storageUnits.units}
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

      {creatingSticker && (
        <CreateStickerModal
          unit={creatingSticker}
          onClose={() => {
            setCreatingSticker(null);
          }}
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
