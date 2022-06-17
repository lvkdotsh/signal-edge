import { DeploymentConfigV1 } from '../../types/DeploymentConfig.type';
import { Migration } from '../migrations';

export const deployment_configs_create: Migration<{
    deployment_configs: DeploymentConfigV1;
}> = async (database) => {
    await database.createTable(
        'deployment_configs',
        true,
        {
            deploy_id: {
                type: 'bigint',
            },
            config: {
                type: 'text',
            },
        },
        'deploy_id'
    );
};
