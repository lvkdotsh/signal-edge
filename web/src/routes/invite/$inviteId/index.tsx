import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { FC, useState } from 'react';

import {
    authStore,
    getInvite,
    useAcceptInvite,
    useAuth,
    useCreateAccountViaInvite,
    useInvite,
    useMe,
} from '@/api';
import { components } from '@/api/schema.gen';
import { Input } from '@/components';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { UserPreview } from '@/gui/user/UserPreview';
import { SCPage } from '@/layouts';
import { queryClient } from '@/util/query';
import { useForm } from '@tanstack/react-form';

export const Route = createFileRoute('/invite/$inviteId/')({
    component: RouteComponent,
    beforeLoad: async ({ params }) => {
        const invite = await queryClient.ensureQueryData(
            getInvite(params.inviteId)
        );

        return { invite };
    },
});

function RouteComponent() {
    const { inviteId } = Route.useParams();
    const { data } = useInvite(inviteId);
    const org_name = data?.team.name;
    const [state, setState] = useState<'undefined' | 'guest'>('undefined');
    const { mutate: acceptInvite, data: acceptedInvite } = useAcceptInvite(
        inviteId,
        data?.team.team_id
    );
    const { token } = useAuth();
    const { data: me, isLoading } = useMe();

    if (acceptedInvite && data?.team.team_id) {
        return (
            <Navigate
                to={'/team/$teamId'}
                params={{ teamId: data.team.team_id }}
            />
        );
    }

    return (
        <SCPage title={`Invite to ${org_name}`} hideTitle width="lg">
            {data && (
                <div className="card space-y-4">
                    <InviteCard data={data} />

                    {state == 'undefined' && (
                        <div className="flex w-full justify-center gap-2">
                            <Button
                                className="w-full"
                                variant="primary"
                                onClick={() => {
                                    if (state == 'undefined') {
                                        if (!me) {
                                            setState('guest');
                                        } else {
                                            acceptInvite();
                                        }
                                    }
                                }}
                            >
                                Accept
                            </Button>
                            <Button className="w-full">Decline</Button>
                        </div>
                    )}

                    {state == 'guest' && <GuestSignUp />}
                </div>
            )}
            {me && !isLoading && (
                <div className="flex items-center justify-center gap-1 text-center">
                    You are signed in as
                    <UserPreview user={me} variant="inline" />
                    <Button
                        variant="link"
                        onClick={() =>
                            authStore.send({ type: 'clearAuthToken' })
                        }
                    >
                        Sign out
                    </Button>
                </div>
            )}
            {!me && !isLoading && (
                <p className="px-4 text-sm">
                    You are not signed in, accepting this invite will allow you
                    to create an account. Did you mean to{' '}
                    <Link
                        to="/login"
                        search={{ redirect: window.location.pathname }}
                        className="link"
                    >
                        sign in instead
                    </Link>
                    ?
                </p>
            )}
        </SCPage>
    );
}

const InviteCard: FC<{
    data: components['schemas']['TeamInviteData'];
}> = ({ data }) => {
    const org_name = data.team.name;

    return (
        <>
            <div className="w-full">
                <div className="bg-muted mx-auto aspect-square size-12 overflow-hidden rounded-full">
                    <Avatar s={data.team.team_id} />
                </div>
            </div>
            <div className="text-center">
                <p>
                    You have been invited to join <b>{org_name}</b>
                </p>
            </div>
        </>
    );
};

const GuestSignUp = () => {
    const { mutate: createAccount } = useCreateAccountViaInvite({
        invite_id: Route.useParams().inviteId,
    });

    const { Field, Subscribe, handleSubmit } = useForm({
        defaultValues: {
            username: '',
            password: '',
            confirmPassword: '',
        },
        onSubmit: async ({ value }) => {
            await createAccount({
                username: value.username,
                password: value.password,
            });
        },
    });

    return (
        <div className="space-y-2">
            <Input placeholder="Username" className="w-full" />
            <Input
                placeholder="Password"
                className="w-full"
                type="password"
                id="password"
                autoComplete="current-password"
            />
            <Input
                placeholder="Confirm Password"
                className="w-full"
                type="password"
                id="confirm-password"
                autoComplete="current-password"
            />
            <Button className="w-full" variant="primary">
                Create Account
            </Button>
        </div>
    );
};
