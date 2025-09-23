// ---------------- DRIVE helpers using REST + fetch ----------------
import {useEffect, useState, useRef } from "react";

export default function createDriveManager(setStatus) {
  const FOLDER_NAME = "InventoraApp";
  const CLIENT_ID = "840716343022-4p7cpk2v1nj32u7s1km6ckq57imuikhe.apps.googleusercontent.com";
  const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly";

  const [signedIn, setSignedIn] = useState(() => !!localStorage.getItem('accessToken'));
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [folderId, setFolderId] = useState(null);
  const [userId, setUserId] = useState(null);
  // For race conditions when calling ensureFolder.
  const folderPromiseRef = useRef(null);
  const tokenClientRef = useRef(null);

  // Init GIS token client.
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
      if(res === null){
        folderPromiseRef.current = null;
        return null;
      }
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
    if(await ensureFolder() === null) return null;
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
    if(await ensureFolder() === null) return null;
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

  return {
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
    handleAuthButton
  };
}
