'use strict';

/**
 * Personel26 masaüstü köprüsü.
 *
 * Yalnızca yedek klasörü seçme penceresini açar; dosya sistemine veya Node.js
 * API'lerine erişim vermez. Sayfa 127.0.0.1 üzerinden yüklendiği için bu köprü
 * yalnızca masaüstü kabuğunda bulunur, tarayıcı sürümünde yoktur.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('personel26Desktop', {
  isDesktop: true,
  pickBackupFolder: (current) => ipcRenderer.invoke('p26:pick-backup-folder', current),
});
