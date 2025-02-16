import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import React from 'react';
import ReactDOM from 'react-dom/client';

// Import the generated route tree
import { routeTree } from '@/routeTree.gen';

import { updateTheme } from './gui/navigation/ThemeSwitcher';
import { PageErrorBoundary } from './gui/PageErrorBoundary';
import { defaultPendingComponent } from './gui/Router';
import { QueryProvider } from './util/query';

// Create a new router instance
const router = createRouter({
    routeTree,
    defaultPendingComponent,
    defaultErrorComponent: PageErrorBoundary,
    context: {
        title: ' Edgeserver',
    },
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    // eslint-disable-next-line prettier/prettier, unused-imports/no-unused-vars
    interface Register {
        router: typeof router;
    }
}

updateTheme();

ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
        <QueryProvider>
            <RouterProvider router={router} />
            {import.meta.env.DEV && <ReactQueryDevtools />}
        </QueryProvider>
    </React.StrictMode>
);
