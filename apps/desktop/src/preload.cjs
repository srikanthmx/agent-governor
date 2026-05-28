const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentGovernorDesktop", {
  /**
   * @param {(payload: { code?: number; signal?: string }) => void} callback
   */
  onWebExit(callback) {
    ipcRenderer.on("agent-governor:web-exit", (_event, payload) => callback(payload));
  }
});
