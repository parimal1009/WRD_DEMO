/**
 * Polyfill to allow the Electron app to run smoothly as a standard Static Web App
 * on Vercel or Render if launched in a normal browser.
 */
const webFileCache = {};

if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = {
    // Mock settings with localStorage
    saveSetting: async (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    loadSetting: async (key) => {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    },
    saveSecureSetting: async (key, val) => localStorage.setItem(key, val),
    loadSecureSetting: async (key) => localStorage.getItem(key),

    // Mock filesystem write with standard Web Downloads
    saveFile: async (filename) => filename, // return mock path
    writeFile: async (filePath, base64Data) => {
      // Decode base64 and prompt browser download
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // If it's the audit trail
      const isJson = filePath.endsWith('.json');
      const mimeType = isJson 
        ? 'application/json' 
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filePath;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    },

    // Mock filesystem read with standard Web File Input
    openFile: async () => {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.docx';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return resolve(null);
          
          const reader = new FileReader();
          reader.onload = (ev) => {
             const base64 = ev.target.result.split(',')[1];
             // Cache it so readFile can pull it using the fake path
             const fakePath = file.name;
             webFileCache[fakePath] = base64;
             resolve(fakePath);
          };
          reader.readAsDataURL(file);
        };
        input.click();
      });
    },
    
    // Retrieve cached base64 created from openFile
    readFile: async (path) => {
      if (webFileCache[path]) return webFileCache[path];
      throw new Error(`File ${path} not found in browser cache`);
    },
    downloadFile: async (url) => url // not fully mocked, placeholder
  };
}
