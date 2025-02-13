import { FC } from 'react';
import { FiFile, FiFolder } from 'react-icons/fi';

import { useDeploymentFiles } from '@/api';
import { components } from '@/api/schema.gen';

type DeploymentFile = components['schemas']['DeploymentFile'];

type FolderNode = {
    type: 'directory';
    files: Record<string, TreeNode>;
};

type TreeNode = FolderNode | FileNode;
type FileNode = { type: 'file'; file: DeploymentFile };
const reorgFilesIntoTree = (files?: DeploymentFile[]): TreeNode => {
    const tree: FolderNode = {
        type: 'directory',
        files: {},
    };

    if (!files) {
        return tree;
    }

    for (const file of files) {
        // Split the path and remove any empty segments (from leading/trailing slashes)
        const segments = file.file_path.split('/').filter(Boolean);

        if (segments.length === 0) {
            continue; // Skip if the path is empty
        }

        // The last segment is assumed to be the file name
        const fileName = segments.pop() as string;
        let currentFolder: FolderNode = tree;

        // Ensure that each directory in the path exists in the tree
        for (const segment of segments) {
            if (!currentFolder.files[segment]) {
                currentFolder.files[segment] = {
                    type: 'directory',
                    files: {},
                };
            }

            currentFolder = currentFolder.files[segment] as FolderNode;
        }

        // Insert the file node in the current folder
        currentFolder.files[fileName] = {
            type: 'file',
            file,
        };
    }

    return tree;
};

export const FileExplorer: FC<{ siteId: string; deploymentId: string }> = ({
    siteId,
    deploymentId,
}) => {
    const { data: deploymentFiles } = useDeploymentFiles(siteId, deploymentId);
    const tree = reorgFilesIntoTree(deploymentFiles);

    return (
        <div>
            <div className="card">
                <TreeEntry node={tree} name="/" />
            </div>
            {deploymentFiles && (
                <div className="card text-wrap break-words">
                    <pre className="w-full whitespace-break-spaces">
                        {JSON.stringify(deploymentFiles, undefined, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export const TreeEntry: FC<{ node: TreeNode; name: string }> = ({
    node,
    name,
}) => {
    if (node.type === 'file') {
        return <FileEntry file={node.file} name={name} />;
    }

    return <FolderEntry node={node} name={name} />;
};

export const FolderEntry: FC<{ node: FolderNode; name: string }> = ({
    node,
    name,
}) => {
    return (
        <div>
            <div className="flex items-center gap-2">
                <FiFolder />
                <span>{name}</span>
            </div>
            <ul className="pl-4">
                {Object.entries(node.files).map(([key, value]) => (
                    <li key={key}>
                        <TreeEntry node={value} name={key} />
                    </li>
                ))}
            </ul>
        </div>
    );
};

export const FileEntry: FC<{ file: DeploymentFile; name: string }> = ({
    file,
    name,
}) => {
    return (
        <div className="flex items-center gap-2">
            <FiFile />
            <span>{name}</span>
        </div>
    );
};
