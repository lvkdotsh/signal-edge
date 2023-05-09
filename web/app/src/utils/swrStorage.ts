import { Cache } from 'swr';

export const localStorageProvider = <T>(c: Readonly<Cache<T>>): Cache<T> => {
    // When initializing, we restore the data from `localStorage` into a map.
    const map = new Map(JSON.parse(localStorage.getItem('app-cache') || '[]'));

    // Before unloading the app, we write back all the data into `localStorage`.
    window.addEventListener('beforeunload', () => {
        const appCache = JSON.stringify(Array.from(map.entries()));

        localStorage.setItem('app-cache', appCache);
    });

    // We still use the map for write & read for performance.
    return map as Cache<T>;
};
