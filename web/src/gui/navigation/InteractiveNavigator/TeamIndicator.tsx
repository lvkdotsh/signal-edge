import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { FC } from 'react';

import { useTeam } from '@/api';
import { Avatar } from '@/components';
import { useActiveTeam } from '@/hooks/useActiveTeam';
// import { AvatarOrGradient } from '@/gui/avatar/AvatarOrGradient';
import { buffercnvrt } from '@/util/buffer';

const TeamEntry: FC<{ team_id: string }> = ({ team_id }) => {
    const { data: team } = useTeam(team_id);
    // TODO: implement team icons
    const icon = '';

    return (
        <motion.div
            className="group h-full overflow-hidden rounded-md py-1"
            initial={{ x: '-70%', opacity: 0 }}
            animate={{ x: '0', opacity: 1 }}
            exit={{ x: '-70%', opacity: 0 }}
            transition={{ bounce: 0.2, duration: 0.15 }}
        >
            <Link
                to="/team/$teamId"
                params={{ teamId: team_id }}
                className="flex h-full items-center rounded-md p-1 hover:bg-neutral-900/10"
            >
                <div className="size-8 rounded-full bg-white">
                    <Avatar src={buffercnvrt(icon as any)} s={team_id} />
                </div>
                <div className="ml-2 flex flex-col justify-center">
                    <p className="text-sm font-semibold">{team?.name}</p>
                </div>
            </Link>
        </motion.div>
    );
};

const EmptyTeamEntry: FC = () => {
    return (
        <div className="flex h-full items-center text-black/20">
            Select a team or site...
        </div>
    );
};

export const TeamIndicator: FC = () => {
    const team_id = useActiveTeam();

    return (
        <div className="h-12 w-fit overflow-hidden transition-all">
            <AnimatePresence>
                {/* {!team && !team_id && <EmptyTeamEntry />} */}
                {team_id && <TeamEntry team_id={team_id} />}
            </AnimatePresence>
        </div>
    );
};
