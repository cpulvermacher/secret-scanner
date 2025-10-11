/// <reference types="vite/client" />

export const debugLog = (...args: unknown[]) => {
    if (import.meta.env.MODE !== "production") {
        console.log(...args);
    }
};
