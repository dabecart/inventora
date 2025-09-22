import React, { useEffect, useState, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";

// Single-file React + Tailwind client-only app
// Replace CLIENT_ID with your Google OAuth Web App Client ID
// Notes:
// - Uses Google Identity Services (GIS) token client for OAuth token.
// - Stores three master JSON files in a Drive folder named "InventoryApp":
//    - inventory.json   (items with counts and metadata)
//    - storage.json     (storage units list)
//    - actions.json     (authoritative list of actions applied to system)
// - When a client performs actions, they are appended locally and uploaded
//   as a pending action file (pending_actions_<ts>_<clientId>.json) if collision is detected.
// - Any client can run a merge process that performs a 3-way merge of actions
//   (base / ours / theirs) and then re-applies the resulting action list to rebuild
//   inventory.json and storage.json. Pending action files older than MERGE_DELAY_MS
//   are merged automatically by the background loop.

const CLIENT_ID = "840716343022-4p7cpk2v1nj32u7s1km6ckq57imuikhe.apps.googleusercontent.com";
const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly";
const FOLDER_NAME = "InventoraApp";
const INVENTORY_FILENAME = "inventory.json";
const STORAGE_FILENAME = "storage.json";
const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds
const MERGE_REMOTE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Utility helpers
function nowIso() { return new Date().toISOString(); }
function simpleId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,9); }
function filenameTimeToIso(str) {
  // "2025-09-22T08-45-01-964Z" -> "2025-09-22T08:45:01.964Z"
  return str.replace(
    /^(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    (_, date, h, m, s, ms) => `${date}${h}:${m}:${s}.${ms}Z`
  );
}

export default function InventoraClient() {
  const [signedIn, setSignedIn] = useState(() => !!localStorage.getItem('accessToken'));
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [userId, setUserId] = useState(null);

  const [status, setStatus] = useState("Not signed in");
  const [folderId, setFolderId] = useState(null);

  const [inventory, setInventory] = useState({ version: 0, items: [] });
  const [storageUnits, setStorageUnits] = useState({ version: 0, units: [] });

  // local pending actions queue (not yet pushed to Drive as pending file)
  const localPendingActions = useRef([]);
  const tokenClientRef = useRef(null);
  // For race conditions when calling ensureFolder.
  const folderPromiseRef = useRef(null);

  const [mergeLog, setMergeLog] = useState([]);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [editingStorage, setEditingStorage] = useState(null);

  // init GIS token client
  useEffect(() => {
    function tryInit() {
      if (window.google && window.google.accounts) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (!resp.hasOwnProperty('error')) {
              setAccessToken(resp.access_token);
              setSignedIn(true);
              setStatus('Signed in!');
              localStorage.setItem('accessToken', resp.access_token); // Save token
            }
          },
        });
      } else {
        setTimeout(tryInit, 500); // retry in 0.5s
      }
    }
    tryInit();
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + accessToken }
      });
      if (res.ok) {
        const info = await res.json();
        setUserId(info.email || info.sub); // Prefer email, fallback to sub
      }
    })();
  }, [accessToken]);

  // When we sign in, try to ensure folder + load files
  useEffect(() => {
    if (!signedIn || !accessToken) return;
    (async () => {
      setStatus('Ensuring folder...');
      const fid = await ensureFolder();
      setFolderId(fid);
    })().catch(e => {
      console.error(e);
      setStatus('Error: ' + e.message);
    });
  }, [signedIn, accessToken]);

  useEffect(() => {
    if (!signedIn || !accessToken || !folderId) return;
    (async () => {
      setStatus('Loading master files...');
      await loadMasters();
      setStatus('Ready');
    })().catch(e => {
      console.error(e);
      setStatus('Error: ' + e.message);
    });
  }, [signedIn, accessToken, folderId]);

  const pollingIntervalRunning = useRef(false);
  useEffect(() => {
    if (!signedIn || !accessToken || !folderId || !inventory.time || !storageUnits.time) return;

    async function mergeActionsInterval() {
      if (pollingIntervalRunning.current) return; // Prevent overlap
      pollingIntervalRunning.current = true;
      try {
        // ---- LOCAL MERGE ----
        const newestTime = await getLatestActionTimeInRemote();
        const localTime = Math.min(
          new Date(inventory.time || 0).getTime(),
          new Date(storageUnits.time || 0).getTime()
        );
        const newestTimeMs = new Date(newestTime).getTime();

        if (newestTimeMs > localTime) {
          if(localPendingActions.current.length == 0) {
            await mergeLocalActions();
          } else {
            setUpdateAvailable(true);
          }
        } else {
          setUpdateAvailable(false);
        }

        // ---- REMOTE MERGE ----
        await mergeRemoteActions(MERGE_REMOTE_THRESHOLD_MS);
      } catch (e) {
        console.error("Error in mergeActionsInterval:", e);
      } finally {
        pollingIntervalRunning.current = false;
      }
    }

    const poll = setInterval(() => {
      mergeActionsInterval();
    }, POLL_INTERVAL_MS);

    mergeActionsInterval();

    return () => clearInterval(poll);
  }, [signedIn, accessToken, folderId, inventory.time, storageUnits.time]);


  // Ask if the user really wants to exit when there are pending actions to be done.
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (localPendingActions.current.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
        return '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ---------------- DRIVE helpers using REST + fetch ----------------
  async function driveFetch(path, opts = {}) {
    if (!accessToken) throw new Error('No access token');
    const url = 'https://www.googleapis.com/drive/v3' + path;
    const headers = opts.headers || {};
    headers['Authorization'] = 'Bearer ' + accessToken;
    opts.headers = headers;
    const res = await fetch(url, opts);
    if (!res.ok) {
      const text = await res.text();
      console.error(`Drive API error ${res.status}: ${text}`);
      if (res.status === 401 || res.status === 403) {
        signout();
        setStatus('Session expired. Please sign in again.');
      }
      return null;
    }
    return res;
  }

  async function ensureFolder() {
    if (folderId) return folderId;
    if (folderPromiseRef.current) return folderPromiseRef.current;

    folderPromiseRef.current = (async () => {
      // Search for folder
      const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const res = await driveFetch(`/files?q=${q}&fields=files(id,name)`);
      if (res) {
        const js = await res.json();
        if (js.files && js.files.length > 0) {
          setFolderId(js.files[0].id);
          folderPromiseRef.current = null;
          return js.files[0].id;
        }
      }
      // Create folder
      const metadata = { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' };
      const createRes = await driveFetch('/files?fields=id,name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });
      const createJs = await createRes.json();
      setFolderId(createJs.id);
      folderPromiseRef.current = null;
      return createJs.id;
    })();

    return folderPromiseRef.current;
  }

  async function ensureActionsFolder() {
    await ensureFolder();
    // Search for actions folder inside main folder
    const q = encodeURIComponent(`name='actions' and mimeType='application/vnd.google-apps.folder' and '${folderId}' in parents and trashed=false`);
    const res = await driveFetch(`/files?q=${q}&fields=files(id,name)`);
    if(res) {
      const js = await res.json();
      if (js.files && js.files.length > 0) return js.files[0].id;
    }

    // Create actions folder
    const metadata = { name: 'actions', mimeType: 'application/vnd.google-apps.folder', parents: [folderId] };
    const createRes = await driveFetch('/files?fields=id,name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });
    const createJs = await createRes.json();
    return createJs.id;
  }

  async function findFileByNameInFolder(name) {
    await ensureFolder();
    const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
    const res = await driveFetch(`/files?q=${q}&fields=files(id,name)`);
    if (!res) return null;

    const js = await res.json();
    return (js.files && js.files[0]) || null;
  }

  async function downloadFileText(fileId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!res.ok) throw new Error('Download failed: ' + res.status);
    return await res.text();
  }

  async function createFileMultipart(name, parentId, contentObj) {
    const boundary = '-------314159265358979323846';
    const metadata = { name, parents: [parentId] };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) + `\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify(contentObj, null, 2) + `\r\n` +
      `--${boundary}--`;
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: multipart
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('createFile failed: ' + res.status + ' ' + txt);
    }
    return await res.json();
  }

  async function updateFileMedia(fileId, contentObj) {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contentObj, null, 2)
    });
    if (!res.ok) { 
      const txt = await res.text(); 
      throw new Error('update failed: ' + res.status + ' ' + txt); 
    }
    return await res.json();
  }

  async function deleteFile(fileId) { 
    await driveFetch(`/files/${fileId}`, { method: 'DELETE' }); 
  }

  // ---------------- Loading masters ----------------
  async function loadMasters() {
    // inventory
    const invFile = await findFileByNameInFolder(INVENTORY_FILENAME);
    if (!invFile) {
      const initial = { version: 1, items: [], time: nowIso() };
      await createFileMultipart(INVENTORY_FILENAME, folderId, initial);
      setInventory(initial);
    } else {
      const txt = await downloadFileText(invFile.id);
      try { 
        setInventory(JSON.parse(txt)); 
      } catch(e) { 
        setInventory({ version: 1, items: [], time: nowIso() }); 
      }
    }

    // storage
    const storFile = await findFileByNameInFolder(STORAGE_FILENAME);
    if (!storFile) {
      const initial = { version: 1, units: [], time: nowIso() };
      await createFileMultipart(STORAGE_FILENAME, folderId, initial);
      setStorageUnits(initial);
    } else {
      const txt = await downloadFileText(storFile.id);
      try { 
        setStorageUnits(JSON.parse(txt)); 
      } catch(e) { 
        setStorageUnits({ version: 1, units: [], time: nowIso() }); 
      }
    }
  }

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

  function validateAction(action, inventory, storageUnits) {
    function validateActionSwitch() {
      const p = action.payload || {};
      switch (action.type) {
        case 'create_item': {
          // id must be unique
          if ((inventory.items || []).some(it => it.id === p.id)) return false;
          if (p.initialQty < 0) return false;
          if (p.storageUnitId && !(storageUnits.units || []).some(u => u.id === p.storageUnitId)) return false;
          return true;
        }

        case 'delete_item': {
          return (inventory.items || []).some(it => it.id === p.id);
        }

        case 'create_storage': {
          return !(storageUnits.units || []).some(u => u.id === p.id);
        }

        case 'delete_storage': {
          return (storageUnits.units || []).some(u => u.id === p.id);
        }

        case 'add_count': {
          return (inventory.items || []).some(it => it.id === p.id && p.amount != 0);
        }

        case 'move_item': {
          const it = (inventory.items || []).find(it => (it.id === p.id) && (it.storageUnitId !== p.toStorageId));
          if (!it) return false;
          if (p.toStorageId && !(storageUnits.units || []).some(u => u.id === p.toStorageId)) return false;
          return true;
        }

        case 'rename_item': {
          return (inventory.items || []).some(it => (it.id === p.id) && (it.name !== p.name.trim())) && !!p.name.trim();
        }

        case 'set_quantity': {
          return (inventory.items || []).some(it => (it.id === p.id) && (it.qty !== p.qty)) && p.qty >= 0;
        }

        case 'rename_storage': {
          return (storageUnits.units || []).some(u => (u.id === p.id) && (it.name !== p.name.trim())) && !!p.name.trim();
        }

        case 'set_item_meta': {
          return (inventory.items || []).some(it => it.id === p.id) && !!p.key;
        }

        case 'remove_item_meta': {
          return (inventory.items || []).some(it => it.id === p.id) && !!p.key;
        }
        case 'set_storage_meta': {
          return (storageUnits.units || []).some(u => u.id === p.id) && !!p.key;
        }
        case 'remove_storage_meta': {
          return (storageUnits.units || []).some(u => u.id === p.id) && !!p.key;
        }

        default: return false;
      }
    }

    const ret = validateActionSwitch();
    // if(!ret) {
    //   console.error(`Invalid action: ${action}` )
    // }
    return ret;
  }

  function applyActionsToState(actionList, initialInv = { items: [] }, initialStor = { units: [] }) {
    // Start from initial state
    const inv = { items: new Map((initialInv.items || []).map(it => [it.id, { ...it }])) };
    const stores = { units: new Map((initialStor.units || []).map(u => [u.id, { ...u }])) };

    // Sort by createdAt then by id for deterministic order
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

  // ---------------- Creating actions locally ----------------
  function createAction(type, payload) {
    return { id: `a-${simpleId()}`, type, payload, createdAt: nowIso(), actorId: userId };
  }

  function enqueueAction(action) {
    localPendingActions.current.push(action);
    setMergeLog(l => [`Enqueued ${action.type} ${action.id}`, ...l].slice(0,200));
    return action;
  }

  async function pushLocalPending() {
    if (!localPendingActions.current.length) return;
    const actionsFolderId = await ensureActionsFolder();

    // Use ISO time for filename and json field
    const pushTime = nowIso();
    const filename = `actions_${pushTime.replace(/[:.]/g, "-")}.json`;
    const actionsPayload = { time: pushTime, actions: localPendingActions.current.slice() };

    // Upload actions file
    await createFileMultipart(filename, actionsFolderId, actionsPayload);

    localPendingActions.current = [];
    setMergeLog(l => [`Pushed actions to ${filename}`, ...l]);
  }

  // ---------------- Remote actions ----------------
  async function getLatestActionTimeInRemote() {
      const actionsFolderId = await ensureActionsFolder();
      // List all actions files
      const q = encodeURIComponent(`'${actionsFolderId}' in parents and trashed=false and name contains 'actions_'`);
      const res = await driveFetch(`/files?q=${q}&fields=files(id,name)`);
      if (!res) return null;
      const js = await res.json();
      const files = js.files || [];
      if (!files.length) return null;

      let jsonTimes = [];
      for (const f of files) {
        // Extract ISO time from filename: actions_YYYY-MM-DDTHH-MM-SS-SSSZ.json
        const match = f.name.match(/^actions_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/);
        if (match) {
          // Convert filename time to ISO format
          const fileTime = filenameTimeToIso(match[1]);
          jsonTimes.push(fileTime);
        }
      }
      if (!jsonTimes.length) return null;

      jsonTimes.sort(); // ISO sort, oldest first
      return jsonTimes[jsonTimes.length - 1];
  }

  async function getRemoteActionsAfter(timeIso, thresholdMs = 0) {
    const actionsFolderId = await ensureActionsFolder();
    // List action files.
    const q = encodeURIComponent(`'${actionsFolderId}' in parents and trashed=false and name contains 'actions_'`);
    const res = await driveFetch(`/files?q=${q}&fields=files(id,name)`);
    if (!res) return [];
    const js = await res.json();
    const files = js.files || [];
    let actions = [];
    let times = [];
    for (const f of files) {
      // Extract ISO time from filename: actions_YYYY-MM-DDTHH-MM-SS-SSSZ.json
      const match = f.name.match(/^actions_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/);
      if (match) {
        // Convert filename time to ISO format
        const fileTime = filenameTimeToIso(match[1]);
        if (new Date(fileTime) > new Date(timeIso) &&
            (Date.now() - new Date(fileTime).getTime()) > thresholdMs) {
          try {
            times.push(fileTime);
            const txt = await downloadFileText(f.id);
            const json = JSON.parse(txt);
            if (json.actions) actions = actions.concat(json.actions);
          } catch {}
        }
      }
    }
    return [actions, times];
  }

  async function mergeLocalActions() {
    const localTime = Math.max(
      new Date(inventory.time || 0).getTime(),
      new Date(storageUnits.time || 0).getTime()
    );
    const [actions, times] = await getRemoteActionsAfter(new Date(localTime).toISOString());
    if (!actions.length) return;

    const sortedTimes = times.sort();
    const latestActionTime = sortedTimes[sortedTimes.length - 1];
    const mergeTime = latestActionTime ? new Date(latestActionTime).toISOString() : nowIso();
    
    const { finalInv, finalStor } = applyActionsToState(actions, inventory, storageUnits);
    finalInv.time = mergeTime;
    finalStor.time = mergeTime;
    
    setInventory(finalInv);
    setStorageUnits(finalStor);
    setMergeLog(l => [`Merged ${actions.length} remote actions into local state`, ...l]);
  }

  async function mergeRemoteActions(thresholdMs = MERGE_REMOTE_THRESHOLD_MS) {
    // Download current inventory to fetch its update time.
    const invFile = await findFileByNameInFolder(INVENTORY_FILENAME);
    let lastUpdateTime = null;
    let initialInv = { items: [] };
    if (invFile) {
      const txt = await downloadFileText(invFile.id);
      try {
        const invJson = JSON.parse(txt);
        lastUpdateTime = invJson.time || null;
        initialInv = invJson;
      } catch {}
    }
    if (!lastUpdateTime) lastUpdateTime = new Date(0).toISOString();

    // Fetch all actions after lastUpdateTime and thresholdMs milliseconds before now.
    const [actionsToApply, jsonTimes] = await getRemoteActionsAfter(lastUpdateTime, thresholdMs);
    if (!actionsToApply.length) return;

    // There are actions to apply on the remote! Download the storage file.
    const storFile = await findFileByNameInFolder(STORAGE_FILENAME);
    let initialStor = { units: [] };
    if (storFile) {
      const txt = await downloadFileText(storFile.id);
      try {
        initialStor = JSON.parse(txt);
      } catch {}
    }

    // Apply actions to initial state
    const { finalInv, finalStor } = applyActionsToState(actionsToApply, initialInv, initialStor);
    jsonTimes.sort();
    const mergeTime = jsonTimes[jsonTimes.length - 1] || nowIso();
    finalInv.time = mergeTime;
    finalStor.time = mergeTime;

    // Save to Drive
    if (invFile) {
      await updateFileMedia(invFile.id, finalInv);
    } else {
      await createFileMultipart(INVENTORY_FILENAME, folderId, finalInv);
    }
    if (storFile) {
      await updateFileMedia(storFile.id, finalStor);
    } else {
      await createFileMultipart(STORAGE_FILENAME, folderId, finalStor);
    }
    setInventory(finalInv);
    setStorageUnits(finalStor);
    setMergeLog(l => [`Merged ${actionsToApply.length} remote actions into Drive after inactivity`, ...l]);
  }

  // ---------------- UI helpers for creating actions ----------------
  function handleCreateItem(name, initialQty, storageUnitId) {
    const id = `i-${simpleId()}`;
    const payload = { id, name, initialQty: Number(initialQty || 0), storageUnitId };
    const action = createAction('create_item', payload);
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setInventory(finalInv);
  }

  function handleDeleteItem(id) {
    const action = createAction('delete_item', { id });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setInventory(finalInv);
  }

  function handleRenameItem(id, newName) {
    const action = createAction('rename_item', { id, name: newName });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setInventory(finalInv);
  }

  function handleCreateStorage(name) {
    const id = `s-${simpleId()}`;
    const payload = { id, name };
    const action = createAction('create_storage', payload);
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalStor } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setStorageUnits(finalStor);
  }

  function handleDeleteStorage(id) {
    const action = createAction('delete_storage', { id });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv, finalStor } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setStorageUnits(finalStor);
    setInventory(finalInv);
  }

  function handleRenameStorage(id, newName) {
    const action = createAction('rename_storage', { id, name: newName });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalStor } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setStorageUnits(finalStor);
  }

  function handleSetQuantity(id, qty) {
    const amount = Math.max(0, Number(qty) || 0);
    const action = createAction('set_quantity', { id, qty: amount });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setInventory(finalInv);
  }

  function handleAddCount(id, amount) {
    const payload = { id, amount: Number(amount) };
    const action = createAction('add_count', payload);
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setInventory(finalInv);
  }

  function handleMoveItem(id, toStorageId) {
    const payload = { id, toStorageId };
    const action = createAction('move_item', payload);
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setInventory(finalInv);
  }

  function handleSetItemMeta(id, key, value, inventory, storageUnits, enqueueAction, setInventory) {
    const action = createAction('set_item_meta', { id, key, value });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setInventory(finalInv);
  }


  function handleRemoveItemMeta(id, key, inventory, storageUnits, enqueueAction, setInventory) {
    const action = createAction('remove_item_meta', { id, key });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalInv } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setInventory(finalInv);
  }


  function handleSetStorageMeta(id, key, value, inventory, storageUnits, enqueueAction, setStorageUnits) {
    const action = createAction('set_storage_meta', { id, key, value });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalStor } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setStorageUnits(finalStor);
  }


  function handleRemoveStorageMeta(id, key, inventory, storageUnits, enqueueAction, setStorageUnits) {
    const action = createAction('remove_storage_meta', { id, key });
    if (!validateAction(action, inventory, storageUnits)) return;

    const { finalStor } = applyActionsToState([action], inventory, storageUnits);
    enqueueAction(action);
    setStorageUnits(finalStor);
  }

  // ---------------- UI actions: sign-in, push pending, manual merge ----------------
  function signout() {
    setAccessToken(null);
    setSignedIn(false);
    setStatus('Not signed in');
    localStorage.removeItem('accessToken');
  }
  
  function handleAuthButton() {
    if (signedIn) {
      signout();
    } else {
      if (!tokenClientRef.current) throw new Error('Token client not initialized');
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    }
  }

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
              // Ask user if they want to keep local pending actions
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
        <ItemCreator storageUnits={storageUnits.units || []} onCreate={handleCreateItem} />
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
                  <td className="flex gap-1">
                    <button onClick={() => handleAddCount(it.id, 1)} className="px-2 py-1 rounded bg-green-600 text-white text-xs">+1</button>
                    <button onClick={() => handleAddCount(it.id, -1)} className="px-2 py-1 rounded bg-orange-500 text-white text-xs" disabled={it.qty === 0}>-1</button>
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
        <StorageUnitCreator onCreate={handleCreateStorage} existingNames={(storageUnits.units || []).map(u => u.name)} />
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
            handleRenameItem(editingItem.id, updated.name);
            handleSetQuantity(editingItem.id, updated.qty);
            handleMoveItem(editingItem.id, updated.storageUnitId);
            // Meta updates
            Object.entries(updated.meta).forEach(([k, v]) => {
              handleSetItemMeta(editingItem.id, k, v, inventory, storageUnits, enqueueAction, setInventory);
            });
            Object.keys(editingItem.meta || {}).forEach(k => {
              if (!(k in updated.meta)) {
                handleRemoveItemMeta(editingItem.id, k, inventory, storageUnits, enqueueAction, setInventory);
              }
            });
            setEditingItem(null);
          }}
          onDiscard={() => setEditingItem(null)}
        />
      )}

      {editingStorage && (
        <EditStorageModal
          unit={editingStorage}
          onSave={(updated) => {
            handleRenameStorage(editingStorage.id, updated.name);
            Object.entries(updated.meta).forEach(([k, v]) => {
              handleSetStorageMeta(editingStorage.id, k, v, inventory, storageUnits, enqueueAction, setStorageUnits);
            });
            Object.keys(editingStorage.meta || {}).forEach(k => {
              if (!(k in updated.meta)) {
                handleRemoveStorageMeta(editingStorage.id, k, inventory, storageUnits, enqueueAction, setStorageUnits);
              }
            });
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

function StorageUnitCreator({ onCreate, existingNames }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Storage name cannot be empty.');
      return;
    }
    if (existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
      setError('Storage name already exists.');
      return;
    }
    onCreate(trimmed);
    setName('');
    setError('');
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        value={name}
        onChange={e => { setName(e.target.value); setError(''); }}
        placeholder="Storage name"
        className="px-2 py-1 border rounded flex-1"
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
      />
      <button
        onClick={handleCreate}
        disabled={!name.trim() || existingNames.some(n => n === name.trim())}
        className={`px-3 py-1 rounded text-white
          ${!name.trim() || existingNames.some(n => n === name.trim()) ? 'bg-gray-400' : 'bg-blue-600'}`}
      >
        Create
      </button>
      {error && <span className="text-red-600 text-xs ml-2">{error}</span>}
    </div>
  );
}

function ItemCreator({ storageUnits, onCreate }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(0);
  const [storageId, setStorageId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (storageUnits && storageUnits.length) setStorageId(storageUnits[0].id || '');
  }, [storageUnits]);

  function handleCreate() {
    if (!name.trim()) {
      setError('Item name cannot be empty.');
      return;
    }
    // if (!storageId) {
    //   setError('Please select a storage unit.');
    //   return;
    // }
    onCreate(name.trim(), qty, storageId || null);
    setName('');
    setQty(0);
    setError('');
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        value={name}
        onChange={e => { setName(e.target.value); setError(''); }}
        placeholder="Item name"
        className="px-2 py-1 border rounded"
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
      />
      <input
        type="number"
        value={qty}
        onChange={e => setQty(e.target.value)}
        className="w-20 px-2 py-1 border rounded"
      />
      <select
        value={storageId}
        onChange={e => setStorageId(e.target.value)}
        className="px-2 py-1 border rounded"
      >
        <option value="">(no storage)</option>
        {(storageUnits || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <button
        onClick={handleCreate}
        disabled={!name.trim() || qty < 0}
        className={`px-3 py-1 rounded ${(!name.trim() || qty < 0) ? 'bg-gray-400' : 'bg-green-600'} text-white`}
      >
        Create
      </button>
      {error && <span className="text-red-600 text-xs ml-2">{error}</span>}
    </div>
  );
}

function EditItemModal({ item, storageUnits, onSave, onDiscard }) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);
  const [storageId, setStorageId] = useState(item.storageUnitId || "");
  const [meta, setMeta] = useState({ ...item.meta });

  const allTags = ["tags", "part number", "serial number", "link", "manufacturer", "datasheet link"];

  function addMeta(key) {
    if (key && !(key in meta)) setMeta({ ...meta, [key]: "" });
  }
  function removeMeta(key) {
    const newMeta = { ...meta };
    delete newMeta[key];
    setMeta(newMeta);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-600 p-6 rounded-lg w-96">
        <h2 className="text-lg font-semibold mb-4">Edit Item</h2>
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border px-2 py-1 rounded" />
          <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} className="w-full border px-2 py-1 rounded" />
          <select value={storageId} onChange={e => setStorageId(e.target.value)} className="w-full border px-2 py-1 rounded">
            <option value="">(no storage)</option>
            {storageUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <div>
            <h3 className="font-semibold">Meta</h3>
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className="flex gap-2 items-center my-1">
                <span className="w-32">{k}</span>
                <input value={v} onChange={e => setMeta({ ...meta, [k]: e.target.value })} className="flex-1 border px-2 py-1 rounded" />
                <button onClick={() => removeMeta(k)} className="text-red-600">x</button>
              </div>
            ))}
            <select onChange={e => { addMeta(e.target.value); e.target.value=""; }} className="mt-2 border px-2 py-1 rounded">
              <option value="">Add meta...</option>
              {allTags.filter(t => !(t in meta)).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onDiscard} className="px-3 py-1 rounded bg-gray-400 text-white">Discard</button>
          <button onClick={() => onSave({ name, qty: Number(qty), storageUnitId: storageId || null, meta })} className="px-3 py-1 rounded bg-blue-600 text-white">Save</button>
        </div>
      </div>
    </div>
  );
}

function EditStorageModal({ unit, onSave, onDiscard }) {
  const [name, setName] = useState(unit.name);
  const [meta, setMeta] = useState({ ...unit.meta });

  const allTags = ["location", "capacity", "description"];

  function addMeta(key) {
    if (key && !(key in meta)) setMeta({ ...meta, [key]: "" });
  }
  function removeMeta(key) {
    const newMeta = { ...meta };
    delete newMeta[key];
    setMeta(newMeta);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-600 p-6 rounded-lg w-96">
        <h2 className="text-lg font-semibold mb-4">Edit Storage</h2>
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border px-2 py-1 rounded" />

          <div>
            <h3 className="font-semibold">Meta</h3>
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className="flex gap-2 items-center my-1">
                <span className="w-32">{k}</span>
                <input value={v} onChange={e => setMeta({ ...meta, [k]: e.target.value })} className="flex-1 border px-2 py-1 rounded" />
                <button onClick={() => removeMeta(k)} className="text-red-600">x</button>
              </div>
            ))}
            <select onChange={e => { addMeta(e.target.value); e.target.value=""; }} className="mt-2 border px-2 py-1 rounded">
              <option value="">Add meta...</option>
              {allTags.filter(t => !(t in meta)).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onDiscard} className="px-3 py-1 rounded bg-gray-400 text-white">Discard</button>
          <button onClick={() => onSave({ name, meta })} className="px-3 py-1 rounded bg-blue-600 text-white">Save</button>
        </div>
      </div>
    </div>
  );
}