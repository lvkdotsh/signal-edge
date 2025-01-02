import {
    createFileRoute,
    Outlet,
    useRouterState,
} from '@tanstack/react-router';

import { SiteSettingsNav } from '@/gui/site/SiteSettingsNav';
import { SidePage } from '@/layouts';

export const Route = createFileRoute('/_authed/site/$siteId/settings/_s')({
    component: RouteComponent,
});

function RouteComponent() {
    const matches = useRouterState({ select: (s) => s.matches });

    const { title, suffix } = matches[matches.length - 1].context;

    return (
        <SidePage title={title} suffix={suffix} sidebar={<SiteSettingsNav />}>
            <Outlet />
        </SidePage>
    );
}
