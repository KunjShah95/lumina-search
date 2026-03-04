import { vi } from 'vitest';

vi.mock('electron', () => {
    return {
        app: {
            getPath: (name: string) => `/tmp/electron-test/${name}`,
            isPackaged: false,
        },
    };
});
