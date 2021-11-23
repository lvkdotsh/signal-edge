import { ScylloClient } from 'scyllo';
import { EdgeName } from './types/EdgeName.type';
import { config } from 'dotenv';
import { Owner } from './types/Owner.type';
import { Site } from './types/Site.type';
import { SiteLookup } from './types/SiteLookup.type';
import { OwnerSiteLookup } from './types/OwnerSiteLookup.type';

config();
const DB = new ScylloClient<{
    // Get a list of all the stored data by SiteID
    edgenames: EdgeName,
    // Get a list of all the owners by OwnerID
    owners: Owner,
    // Get a list of all the sites by siteID
    sites: Site,
    // Get the site belonging to a domain
    sitelookup: SiteLookup,
    // Get the sites belonging to an owner
    ownersitelookup: OwnerSiteLookup
}>({
    client: {
        contactPoints: [process.env.DB_IP]
    }
});

(async () => {
    console.log('Awaiting Connection');
    await DB.awaitConnection();

    console.log('Ensuring Tables');
    await DB.createTable('edgenames', true, {
        cid: {
            type: 'bigint'
        },
        site_id: {
            type: 'bigint'
        }
    }, 'site_id');
    await DB.createTable('owners', true, {
        user_id: {
            type: 'bigint'
        }
    }, 'user_id');
    await DB.createTable('sitelookup', true, {
        host: {
            type: 'text'
        },
        site_id: {
            type: 'bigint'
        }
    }, 'host', ['site_id']);
    await DB.createTable('sites', true, {
        host: { type: 'text' },
        owner: { type: 'bigint' },
        site_id: { type: 'bigint' }
    }, 'site_id');
    await DB.createTable('ownersitelookup', true, {
        owner_id: { type: 'bigint' },
        site_id: { type: 'bigint' }
    }, 'owner_id', ['site_id']);

})();
