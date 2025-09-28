import { useEffect, useReducer, useRef, useState } from "react";
import { nowIso, filenameTimeToIso} from '../utils/Utils'
import DriveManager from '../utils/Drive'
import InventoraActions, { applyActionsToState } from './InventoraActions'

export default function Inventora(setStatus, setMergeLog, setUpdateAvailable) {
  const INVENTORY_FILENAME = "inventory.json";
  const STORAGE_FILENAME = "storage.json";
  const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds
  const MERGE_REMOTE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  const initialState = {
    inventory: { version: 0, items: [] },
    storageUnits: { version: 0, units: [] },
  };

  function reducerFunc(state, action) {
    switch (action.type) {
      case "SET_INVENTORY": {
        return {
          inventory: action.payload ?? state.inventory,
          storageUnits: state.storageUnits
        };
      }

      case "SET_STORAGE": {
        return {
          inventory: state.inventory,
          storageUnits: action.payload ?? state.storageUnits
        };
      }

      case "APPLY_ACTION": {
        const { finalInv, finalStor } = applyActionsToState([action.payload], state.inventory, state.storageUnits);
        return {
          inventory: finalInv ?? state.inventory,
          storageUnits: finalStor ?? state.storageUnits,
        };
      }

      default: return state;
    }
  }
  const [ inventora, runInventoraAction ] = useReducer(reducerFunc, initialState);
  const [ mastersLoaded, setMastersLoaded ] = useState(false);

  // Local pending actions queue (not yet pushed to Drive).
  const localPendingActions = useRef([]);
  function enqueueAction(action) {
    localPendingActions.current.push(action);
    setMergeLog(l => [`Enqueued ${action.type} ${action.id}`, ...l].slice(0,200));
    return action;
  }

  const {
    signedIn,
    accessToken,
    folderId,
    userId,
    driveFetch,
    ensureFolder,
    ensureActionsFolder,
    findFileByNameInFolder,
    downloadFileText,
    createFileMultipart,
    updateFileMedia,
    deleteFile,
    signin,
    signout
  } = DriveManager(setStatus);

  const {
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
  } = InventoraActions(userId, inventora, runInventoraAction, enqueueAction);

  // Log in / log out
  function handleAuthButton() {
    if (signedIn) {
      signout();
      setMastersLoaded(false);
    } else {
      signin();
    }
  }

  // Loads files from Drive at the start.
  useEffect(() => {
    if (!signedIn || !accessToken || !folderId) return;
    (async () => {
      await loadMasters();
      setStatus('Ready');
    })().catch(e => {
      console.error(e);
      setStatus('Error: ' + e.message);
    });
  }, [signedIn, accessToken, folderId]);

  // Polling functions to check for local/remote merges.
  const pollingIntervalRunning = useRef(false);
  useEffect(() => {
    if (!signedIn || !accessToken || !folderId || !inventora.inventory.time || !inventora.storageUnits.time) return;

    async function mergeActionsInterval() {
      if (pollingIntervalRunning.current) return; // Prevent overlap
      pollingIntervalRunning.current = true;
      try {
        // ---- LOCAL MERGE ----
        const newestTime = await getLatestActionTimeInRemote();
        const localTime = Math.min(
          new Date(inventora.inventory.time || 0).getTime(),
          new Date(inventora.storageUnits.time || 0).getTime()
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
  }, [signedIn, accessToken, folderId, inventora.inventory.time, inventora.storageUnits.time]);

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

  // ---------------- Loading master JSONs ----------------
  async function loadMasters() {
    // Inventory.
    setStatus('Loading inventory...');
    const invFile = await findFileByNameInFolder(INVENTORY_FILENAME);
    const defaultInventory = { version: 1, items: [], time: nowIso() };
    if (!invFile) {
      await createFileMultipart(INVENTORY_FILENAME, folderId, defaultInventory);
      runInventoraAction({ type: "SET_INVENTORY", payload: defaultInventory });
    } else {
      const txt = await downloadFileText(invFile.id);
      try { 
        runInventoraAction({ type: "SET_INVENTORY", payload: JSON.parse(txt) });
      } catch(e) { 
        runInventoraAction({ type: "SET_INVENTORY", payload: defaultInventory });
      }
    }

    // Storage.
    setStatus('Loading storage units...');
    const storFile = await findFileByNameInFolder(STORAGE_FILENAME);
    const defaultStorage = { version: 1, units: [], time: nowIso() };
    if (!storFile) {
      await createFileMultipart(STORAGE_FILENAME, folderId, defaultStorage);
      runInventoraAction({ type: "SET_STORAGE", payload: defaultStorage });
    } else {
      const txt = await downloadFileText(storFile.id);
      try { 
        runInventoraAction({ type: "SET_STORAGE", payload: JSON.parse(txt) });
    } catch(e) { 
        runInventoraAction({ type: "SET_STORAGE", payload: defaultStorage });
      }
    }

    setMastersLoaded(true);
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

    runInventoraAction({ type: "SET_INVENTORY", payload: finalInv });
    runInventoraAction({ type: "SET_STORAGE", payload: finalStor });
    setMergeLog(l => [`Merged ${actionsToApply.length} remote actions into Drive`, ...l]);
  }

  // ---------------- Local actions ----------------
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

  async function mergeLocalActions() {
    const localTime = Math.max(
      new Date(inventora.inventory.time || 0).getTime(),
      new Date(inventora.storageUnits.time || 0).getTime()
    );
    const [actions, times] = await getRemoteActionsAfter(new Date(localTime).toISOString());
    if (!actions.length) return;

    const sortedTimes = times.sort();
    const latestActionTime = sortedTimes[sortedTimes.length - 1];
    const mergeTime = latestActionTime ? new Date(latestActionTime).toISOString() : nowIso();
    
    const { finalInv, finalStor } = applyActionsToState(actions, inventora.inventory, inventora.storageUnits);
    finalInv.time = mergeTime;
    finalStor.time = mergeTime;
    
    runInventoraAction({ type: "SET_INVENTORY", payload: finalInv });
    runInventoraAction({ type: "SET_STORAGE", payload: finalStor });
    setMergeLog(l => [`Merged ${actions.length} remote actions into local state`, ...l]);
  }

  return {
    itemMetaKeys,
    storageMetaKeys,
    signedIn,
    mastersLoaded,
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
  };

}