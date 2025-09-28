import {simpleId, nowIso} from '../utils/Utils'

// ---------------- Action model & applying ----------------
// Define allowed action types and their payload shape
// Each action has: id, type, payload, createdAt, actorId
// Types: 
//  - create_item
//  - delete_item
//  - rename_item
//  - create_storage
//  - delete_storage
//  - rename_storage
//  - set_quantity
//  - add_count
//  - move_item
//  - set_item_meta
//  - remove_item_meta
//  - set_storage_meta
//  - remove_storage_meta

export function applyActionsToState(actionList, initialInv = { items: [] }, initialStor = { units: [] }) {
  // Start from initial state.
  const inv = { items: new Map((initialInv.items || []).map(it => [it.id, { ...it }])) };
  const stores = { units: new Map((initialStor.units || []).map(u => [u.id, { ...u }])) };

  // Sort by createdAt then by id for deterministic order.
  const sorted = [...actionList].sort((a,b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  for (const act of sorted) {
    const p = act.payload || {};
    switch (act.type) {
      case 'create_item': {
        if (!p.id) break;
        inv.items.set(p.id, { id: p.id, name: p.name || 'Item', qty: Number(p.initialQty || 0), meta: p.meta || {}, storageUnitId: p.storageUnitId || null });
        break;
      }
      case 'delete_item': {
        if (!p.id) break;
        inv.items.delete(p.id);
        break;
      }
      case 'create_storage': {
        if (!p.id) break;
        stores.units.set(p.id, { id: p.id, name: p.name || 'Storage', meta: p.meta || {} });
        break;
      }
      case 'delete_storage': {
        if (!p.id) break;
        stores.units.delete(p.id);
        for (const it of inv.items.values()) {
          if (it.storageUnitId === p.id) it.storageUnitId = null;
        }
        break;
      }
      case 'add_count': {
        if (!p.id) break;
        const it = inv.items.get(p.id);
        if (!it) break;
        it.qty = Math.max(0, Number(it.qty || 0) + Number(p.amount || 0)); // Clamp to >= 0
        break;
      }
      case 'move_item': {
        if (!p.id) break;
        const it = inv.items.get(p.id);
        if (!it) break;
        it.storageUnitId = p.toStorageId || null;
        break;
      }
      case 'rename_item': {
        const it = inv.items.get(p.id);
        if (it && p.name) it.name = p.name;
        break;
      }
      case 'set_quantity': {
        const it = inv.items.get(p.id);
        if (it) it.qty = Math.max(0, Number(p.qty) || 0);
        break;
      }
      case 'rename_storage': {
        const st = stores.units.get(p.id);
        if (st && p.name) st.name = p.name;
        break;
      }

      case 'set_item_meta': {
          const it = inv.items.get(p.id);
          if (it) it.meta = { ...it.meta, [p.key]: p.value }; 
          break;
      } 

      case 'remove_item_meta': {
          const it = inv.items.get(p.id);
          if (it) { 
          const m = { ...it.meta }; 
          delete m[p.key]; 
          it.meta = m; 
        } 
        break;
      } 

      case 'set_storage_meta': {
          const st = stores.units.get(p.id);
          if (st) st.meta = { ...st.meta, [p.key]: p.value }; 
          break;
      } 

      case 'remove_storage_meta': {
          const st = stores.units.get(p.id);
          if (st) { 
          const m = { ...st.meta }; 
          delete m[p.key]; 
          st.meta = m; 
        } 
        break;
      } 

      default:
        break;
    }
  }

  const finalInv =  { version: 0, time: nowIso(), items: Array.from(inv.items.values()) };
  const finalStor = { version: 0, time: nowIso(), units: Array.from(stores.units.values()) };
  return { finalInv, finalStor };
}

export default function InventoraActions(userId = '(anonymous)', inventora, runInventoraAction, enqueueAction) {
  const itemMetaKeys    = ['Description', 'Tags','Part Number','Serial Number','Link','Manufacturer','Datasheet Link','Photos'];
  const storageMetaKeys = ['Location','Capacity','Description','Photos'];
  const MAX_PHOTOS_COUNT = 5;

  function validateItemsMeta(metaKey, metaValue) {
    switch(metaKey) {
      case 'Link':
      case 'Datasheet Link': {
        if (!metaValue) {
          return "Link cannot be empty.";
        }
        try { 
          new URL(metaValue); 
          return null; 
        } catch { 
          return 'Must be a valid URL.'; 
        }
      }

      case 'Photos': {
        if (!Array.isArray(metaValue)) return 'Photos must be uploaded images.';
        if (metaValue.length == 0) return `Upload up to ${MAX_PHOTOS_COUNT} photos.`;
        if (metaValue.length > MAX_PHOTOS_COUNT) return `Too many photos (max ${MAX_PHOTOS_COUNT}).`;
        return null;
      }

      case 'Tags': {
        // TODO: Validate the commas
        if(!metaValue) return 'Cannot be empty.'
        return null;
      }

      case 'Description':
      case 'Manufacturer':
      case 'Part Number':
      case 'Serial Number': {
        if(!metaValue) return 'Cannot be empty.'
        return null;
      }
    }
    return 'Meta not supported.';
  }

  function validateStoragesMeta(metaKey, metaValue) {
    switch(metaKey) {
      case 'Photos': {
        if (!Array.isArray(metaValue)) return 'Photos must be uploaded images.';
        if (metaValue.length == 0) return `Upload up to ${MAX_PHOTOS_COUNT} photos.`;
        if (metaValue.length > MAX_PHOTOS_COUNT) return `Too many photos (maximum ${MAX_PHOTOS_COUNT}).`;
        return null;
      }

      case 'Location':
      case 'Capacity':
      case 'Description': {
        if(!metaValue) return 'Cannot be empty.'
        return null;
      }
    }
    return 'Meta not supported.';
  }

  function validateAction(action, inventory, storageUnits) {
    const p = action.payload || {};
    let errors = null;
    function addError(key, value) {
      if(errors === null) errors = {};
      errors[key] = value;
    }
    function addMetaError(key, value) {
      if(errors === null) errors = {};
      if(!('meta' in errors)) errors.meta = {};
      errors.meta[key] = value;
    }

    switch (action.type) {
      case 'create_item': {
        if ((inventory.items || []).some(it => it.id === p.id)) {
          addError("id", "ID already exists.");
        }
        if (!p.name.trim()) {
          addError("name", "Name cannot be empty.");
        }
        if (p.initialQty < 0) {
          addError("qty", "Quantity cannot be negative.");
        }
        if (p.storageUnitId && (storageUnits.units || []).every(u => u.id !== p.storageUnitId)) {
          addError("storageUnitId", "The storage unit does not exist.");
        }
        for(const [metaKey, metaValue] of Object.entries(p.meta)) {
          const metaError = validateItemsMeta(metaKey, metaValue);
          if(metaError) addMetaError(metaKey, metaError);
        }
        break;
      }

      case 'delete_item': {
        if ((inventory.items || []).every(it => it.id !== p.id)) {
          addError("id", "ID does not exist.");
        }
        break;
      }

      case 'create_storage': {
        if((storageUnits.units || []).some(u => u.id === p.id)) {
          addError("id", "ID already exists.");
        }
        if (!p.name.trim()) {
          addError("name", "Name cannot be empty.");
        }
        for(const [metaKey, metaValue] of Object.entries(p.meta)) {
          const metaError = validateStoragesMeta(metaKey, metaValue);
          if(metaError) addMetaError(metaKey, metaError);
        }
        break;
      }

      case 'delete_storage': {
        if ((storageUnits.units || []).every(u => u.id !== p.id)) {
          addError("id", "ID does not exist.");
        }
        break;
      }

      case 'add_count': {
        if ((inventory.items || []).every(it => it.id !== p.id)) {
          addError("id", "ID does not exist.");
        }
        if (p.amount == 0) {
          addError("amount", "Amount cannot be zero.");
        }
        break;
      }

      case 'move_item': {
        if ((inventory.items || []).every(it => it.id !== p.id)) {
          addError("id", "ID does not exist.");
        }
        if ((storageUnits.units || []).every(u => u.id !== p.toStorageId)) {
          addError("toStorageId", "ID does not exist.");
        }
        if ((inventory.items || []).some(it => it.id === p.id && it.storageUnitId === p.toStorageId)) {
          addError("toStorageId", "Cannot move to the same storage unit.");
        }
        break;
      }

      case 'rename_item': {
        if ((inventory.items || []).every(it => it.id !== p.id)) {
          addError("id", "ID does not exist.");
        }else if((inventory.items || []).some(it => (it.id === p.id) && (it.name === p.name.trim()))) {
          addError("name", "Cannot rename to the same name.");
        }
        if(!p.name.trim()) {
          addError("name", "Name cannot be empty.");
        }
        break;
      }

      case 'set_quantity': {
        if ((inventory.items || []).every(it => it.id !== p.id)) {
          addError("id", "ID does not exist.");
        }else if((inventory.items || []).some(it => (it.id === p.id) && (it.qty === p.qty))) {
          addError("qty", "Cannot set quantity to the same number.");
        }
        if(p.qty < 0) {
          addError("qty", "Quantity cannot be negative.");
        }
        break;
      }

      case 'rename_storage': {
        if ((storageUnits.units || []).every(it => it.id !== p.id)) {
          addError("id", "ID does not exist.");
        }else if((storageUnits.units || []).some(it => (it.id === p.id) && (it.name === p.name.trim()))) {
          addError("name", "Cannot rename to the same name.");
        }
        if(!p.name.trim()) {
          addError("name", "Name cannot be empty.");
        }
        break;
      }

      case 'set_item_meta': {
        const item = (inventory.items || []).find(it => it.id === p.id)
        if(!item) {
          addError("id", "ID does not exist.");
        }

        const metaError = validateItemsMeta(p.key, p.value);
        if(metaError) {
          addMetaError(p.key, metaError);
        }else if(!!item) {
          if(p.key in item.meta) {
            if(JSON.stringify(item.meta[p.key]) === JSON.stringify(p.value)) addMetaError(p.key, "Values haven't changed.");
          }
        }
        break;
      }

      case 'remove_item_meta': {
        if ((inventory.items || []).every(it => it.id !== p.id)) {
          addError("id", "ID does not exist.");
        }else {
          const meta = (inventory.items || []).find(it => it.id === p.id).meta;
          if(!(p.key in meta)) {
            addError("key", "This meta is not in the item.");
          }
        }
        break;
      }

      case 'set_storage_meta': {
        const unit = (storageUnits.units || []).find(it => it.id === p.id)
        if(!unit) {
          addError("id", "ID does not exist.");
        }

        const metaError = validateStoragesMeta(p.key, p.value);
        if(metaError) {
          addMetaError(p.key, metaError);
        }else if(!!unit) {
          if(p.key in unit.meta) {
            if(JSON.stringify(unit.meta[p.key]) === JSON.stringify(p.value)) addMetaError(p.key, "Values haven't changed.");
          }
        }
        break;
      }

      case 'remove_storage_meta': {
        if ((storageUnits.units || []).every(it => it.id !== p.id)) {
          addError("id", "ID does not exist.");
        }else {
          const meta = (storageUnits.units || []).find(it => it.id === p.id).meta;
          if(!(p.key in meta)) {
            addError("key", "This meta is not in the storage unit.");
          }
        }
        break;
      }

      default: break;
    }

    return errors;
  }

  function createAction(type, payload) {
    return { id: `a-${simpleId()}`, type, payload, createdAt: nowIso(), actorId: userId };
  }

  function handleCreateItem(name, initialQty, storageUnitId, meta, validateOnly = false) {
    const id = `i-${simpleId()}`;
    const payload = { id, name, initialQty: Number(initialQty || 0), storageUnitId, meta: meta || {} };
    const action = createAction("create_item", payload);
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleDeleteItem(id, validateOnly = false) {
    const action = createAction("delete_item", { id });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleRenameItem(id, newName, validateOnly = false) {
    const action = createAction("rename_item", { id, name: newName });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleCreateStorage(name, meta, validateOnly = false) {
    const id = `s-${simpleId()}`;
    const payload = { id, name, meta };
    const action = createAction("create_storage", payload);
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleDeleteStorage(id, validateOnly = false) {
    const action = createAction("delete_storage", { id });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleRenameStorage(id, newName, validateOnly = false) {
    const action = createAction("rename_storage", { id, name: newName });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleSetQuantity(id, qty, validateOnly = false) {
    const amount = Number(qty || 0);
    const action = createAction("set_quantity", { id, qty: amount });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleAddCount(id, amount, validateOnly = false) {
    const payload = { id, amount: Number(amount) };
    const action = createAction("add_count", payload);
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleMoveItem(id, toStorageId, validateOnly = false) {
    const payload = { id, toStorageId };
    const action = createAction("move_item", payload);
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleSetItemMeta(id, key, value, validateOnly = false) {
    const action = createAction("set_item_meta", { id, key, value });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleRemoveItemMeta(id, key, validateOnly = false) {
    const action = createAction("remove_item_meta", { id, key });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleSetStorageMeta(id, key, value, validateOnly = false) {
    const action = createAction("set_storage_meta", { id, key, value });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  function handleRemoveStorageMeta(id, key, validateOnly = false) {
    const action = createAction("remove_storage_meta", { id, key });
    const errors = validateAction(action, inventora.inventory, inventora.storageUnits);

    if (!errors && !validateOnly) {
      enqueueAction(action);
      runInventoraAction({ type: "APPLY_ACTION", payload: action });
    }
    return errors;
  }

  return {
    itemMetaKeys,
    storageMetaKeys,
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
  };
}
