/**
 * Mock for Electron's `app` module — used in test environment
 * to avoid "Cannot find module 'electron'" errors.
 */
export const app = {
    getPath: (name: string) => `/tmp/electron-test/${name}`,
    isPackaged: false,
};

export default {
    app,
};
