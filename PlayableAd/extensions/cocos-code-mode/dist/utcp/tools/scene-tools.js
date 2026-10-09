"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneTools = void 0;
const package_json_1 = __importDefault(require("../../../package.json"));
const decorators_1 = require("../decorators");
const schemas_1 = require("../schemas");
class SceneTools {
    async nodeGetTree(args) {
        var _a;
        let treeBase;
        if (args.reference) {
            treeBase = await Editor.Message.request('scene', 'query-node-tree', args.reference.id);
        }
        else {
            // Default queries the whole scene
            treeBase = await Editor.Message.request('scene', 'query-node-tree');
        }
        if (!treeBase) {
            throw new Error(`Node tree not found for ${((_a = args.reference) === null || _a === void 0 ? void 0 : _a.id) || 'entire scene'}`);
        }
        const formatNode = (node) => {
            const comps = node.components ? node.components.map((c) => ({
                reference: { id: c.value, type: c.type }
            })) : [];
            let children = [];
            children = node.children ? node.children.map(formatNode).filter((c) => c !== null) : [];
            return {
                reference: { id: node.uuid, type: 'cc.Node' },
                name: node.name,
                active: node.active,
                components: comps,
                children: children
            };
        };
        const result = formatNode(treeBase);
        result.path = treeBase.path || undefined;
        return result;
    }
    async nodeGetAtPath(args) {
        const nodeTree = await Editor.Message.request('scene', 'query-node-tree');
        if (!nodeTree) {
            throw new Error(`Scene is empty or could not retrieve scene tree.`);
        }
        const sceneRootName = nodeTree.name;
        if (args.hierarchyPath.startsWith('/')) {
            args.hierarchyPath = args.hierarchyPath.slice(1);
        }
        if (args.hierarchyPath.startsWith(`${sceneRootName}`)) {
            args.hierarchyPath = args.hierarchyPath.slice(sceneRootName.length);
        }
        if (args.hierarchyPath === '') {
            return { references: [{ id: nodeTree.uuid }] };
        }
        const pathParts = args.hierarchyPath.split('/').filter(p => p.length > 0);
        let currentNodes = [nodeTree];
        for (const part of pathParts) {
            const nextNodes = [];
            for (const node of currentNodes) {
                const matchingChildren = (node.children || []).filter((child) => child.name === part);
                nextNodes.push(...matchingChildren);
            }
            currentNodes = nextNodes;
            if (currentNodes.length === 0) {
                break;
            }
        }
        return { references: currentNodes.map((node) => ({ id: node.uuid, type: 'cc.Node' })) };
    }
    async sceneCreatePrimitiveNode(args) {
        const primitiveMap = {
            'Capsule': "db://internal/default_prefab/3d/Capsule.prefab",
            'Cone': "db://internal/default_prefab/3d/Cone.prefab",
            'Cube': "db://internal/default_prefab/3d/Cube.prefab",
            'Cylinder': "db://internal/default_prefab/3d/Cylinder.prefab",
            'Plane': "db://internal/default_prefab/3d/Plane.prefab",
            'Quad': "db://internal/default_prefab/3d/Quad.prefab",
            'Sphere': "db://internal/default_prefab/3d/Sphere.prefab",
            'Torus': "db://internal/default_prefab/3d/Torus.prefab",
        };
        if (!primitiveMap[args.primitiveType]) {
            throw new Error(`Unsupported primitive type: ${args.primitiveType}`);
        }
        const prefabUrl = primitiveMap[args.primitiveType];
        const assetUuid = await Editor.Message.request('asset-db', 'query-uuid', prefabUrl);
        if (!assetUuid) {
            throw new Error(`Failed to find asset for primitive type ${args.primitiveType} at ${prefabUrl}`);
        }
        return await this.sceneCreateNode({
            name: args.name,
            parentReference: args.parentReference,
            assetReference: { id: assetUuid, type: 'cc.Prefab' },
            unwrapPrefab: true
        });
    }
    async sceneCreateNode(args) {
        const options = {
            name: args.name
        };
        if (args.parentReference) {
            options.parent = args.parentReference.id;
        }
        else {
            // Force root if no parent provided
            options.parent = (await Editor.Message.request('scene', 'query-node-tree')).uuid;
        }
        let assetUuid = null;
        // 1. Determine Asset UUID
        if ((args.assetReference && 'id' in args.assetReference)) {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', args.assetReference.id);
            if (!assetInfo) {
                throw new Error(`Asset reference not found: ${args.assetReference.id}`);
            }
            let prefabFound = assetInfo.type === 'cc.Prefab';
            // If not a prefab, check if it has a prefab sub-asset (like in case of FBX)
            if (!prefabFound) {
                for (let subAsset of Object.values(assetInfo.subAssets)) {
                    if (subAsset.type === 'cc.Prefab') {
                        assetUuid = subAsset.uuid;
                        prefabFound = true;
                        break;
                    }
                }
            }
            else {
                assetUuid = assetInfo.uuid;
            }
            if (!prefabFound) {
                throw new Error(`Provided asset reference ${args.assetReference.id} is not a prefab and does not contain a prefab sub-asset.`);
            }
            else {
                if (!args.unwrapPrefab) {
                    options.unlinkPrefab = false;
                    options.type = 'cc.Prefab';
                }
            }
        }
        if (assetUuid) {
            options.assetUuid = assetUuid;
        }
        // 2. Create Node
        const result = await Editor.Message.request('scene', 'create-node', options);
        const newNodeUuid = Array.isArray(result) ? result[0] : result;
        if (!newNodeUuid) {
            throw new Error(`Failed to create node ${args.name}${args.assetReference ? ` from asset ${args.assetReference.id}` : ''}.`);
        }
        await Editor.Message.request('scene', 'snapshot');
        return { reference: { id: newNodeUuid, type: 'cc.Node' } };
    }
    async nodeOperate(args) {
        if (await Editor.Message.request('scene', 'query-node', args.reference.id) === null) {
            throw new Error(`Target node ${args.reference.id} not found`);
        }
        switch (args.operation) {
            case 'move':
                if (!args.newParentReference) {
                    throw new Error("newParentReference required for move");
                }
                await Editor.Message.request('scene', 'set-parent', {
                    parent: args.newParentReference.id,
                    uuids: args.reference.id,
                    keepWorldTransform: true
                });
                if (args.siblingIndex !== undefined) {
                    await this.setSiblingIndex(args.reference.id, args.siblingIndex);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'copy':
                const duplicateResult = await Editor.Message.request('scene', 'duplicate-node', [args.reference.id]);
                if (!duplicateResult || duplicateResult.length === 0) {
                    throw new Error(`Node ${args.reference.id} duplication failed`);
                }
                const newNodes = duplicateResult;
                const newNodeId = newNodes[0];
                if (args.newParentReference) {
                    await Editor.Message.request('scene', 'set-parent', {
                        parent: args.newParentReference.id,
                        uuids: newNodes,
                        keepWorldTransform: true
                    });
                }
                if (args.siblingIndex !== undefined) {
                    await this.setSiblingIndex(newNodeId, args.siblingIndex);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true, copiedNodeReference: { id: newNodeId, type: 'cc.Node' } };
            case 'delete':
                await Editor.Message.request('scene', 'remove-node', {
                    uuid: args.reference.id
                });
                const nodeCheck = await Editor.Message.request('scene', 'query-node', args.reference.id);
                if (nodeCheck !== null && nodeCheck !== undefined) {
                    throw new Error(`Node ${args.reference.id} still exists after removal`);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'create_prefab':
                if (!args.newPrefabPath) {
                    throw new Error("newPrefabPath required for create_prefab");
                }
                const parentInfo = await this.getParentAndSiblingIndex(args.reference.id);
                const createdPrefabUuid = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: package_json_1.default.name,
                    method: 'createPrefabFromNode',
                    args: [args.reference.id, args.newPrefabPath]
                });
                if (!createdPrefabUuid) {
                    throw new Error("Failed to create prefab asset.");
                }
                const updatedNodeId = await this.getUpdatedUuid(parentInfo.parentUuid, parentInfo.siblingIndex);
                await Editor.Message.request('scene', 'snapshot');
                return { success: true, createdPrefabAssetReference: { id: createdPrefabUuid, type: 'cc.Prefab' }, updatedNodeReference: { id: updatedNodeId, type: 'cc.Node' } };
            case 'revert_prefab':
                const revertSuccess = await Editor.Message.request('scene', 'restore-prefab', { uuid: args.reference.id });
                await Editor.Message.request('scene', 'snapshot');
                return { success: revertSuccess };
            case 'apply_prefab':
                const applyError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: package_json_1.default.name,
                    method: 'applyPrefabByNode',
                    args: [args.reference.id]
                });
                if (applyError != null) {
                    throw new Error(`Failed to apply prefab: ${applyError}`);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'unwrap_prefab':
                const unwrapError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: package_json_1.default.name,
                    method: 'unlinkPrefabByNode',
                    args: [args.reference.id, false]
                });
                if (unwrapError != null) {
                    throw new Error(`Failed to unwrap prefab: ${unwrapError}`);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'unwrap_prefab_completely':
                const unwrapAllError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: package_json_1.default.name,
                    method: 'unlinkPrefabByNode',
                    args: [args.reference.id, true]
                });
                if (unwrapAllError != null) {
                    throw new Error(`Failed to unwrap prefab completely: ${unwrapAllError}`);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'open_prefab':
                const nodeForPrefab = await Editor.Message.request('scene', 'query-node', args.reference.id);
                if (!nodeForPrefab) {
                    throw new Error(`Node ${args.reference.id} not found`);
                }
                const pInfo = nodeForPrefab.__prefab__ || nodeForPrefab._prefab || (nodeForPrefab.value && (nodeForPrefab.value.__prefab__ || nodeForPrefab.value._prefab));
                const pValue = (pInfo === null || pInfo === void 0 ? void 0 : pInfo.value) || pInfo;
                const targetUuid = (pValue === null || pValue === void 0 ? void 0 : pValue.assetUuid) || (pValue === null || pValue === void 0 ? void 0 : pValue.uuid);
                if (!targetUuid) {
                    throw new Error(`Node ${args.reference.id} is not linked to a prefab`);
                }
                try {
                    await Editor.Message.request('asset-db', 'open-asset', targetUuid);
                }
                catch (error) {
                    throw new Error(`Failed to open prefab asset ${targetUuid}. Reason: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
                }
                return { success: true };
            default:
                throw new Error(`Unknown scene node operation: ${args.operation}`);
        }
    }
    // Helpers
    async getParent(nodeUuid) {
        var _a, _b, _c;
        const node = await Editor.Message.request('scene', 'query-node', nodeUuid);
        if ((_b = (_a = node === null || node === void 0 ? void 0 : node.parent) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.uuid)
            return node.parent.value.uuid;
        if ((_c = node === null || node === void 0 ? void 0 : node.parent) === null || _c === void 0 ? void 0 : _c.uuid)
            return node.parent.uuid;
        return await Editor.Message.request('scene', 'query-uuid');
    }
    // Helper to set sibling index
    async setSiblingIndex(uuid, index) {
        // Get parent first
        const parentUuid = await this.getParent(uuid);
        if (!parentUuid) {
            throw new Error(`Node ${uuid} has no parent`);
        }
        // Get children of parent
        const parentNode = await Editor.Message.request('scene', 'query-node', parentUuid);
        const childrenArray = parentNode.children;
        if (!childrenArray || !Array.isArray(childrenArray)) {
            throw new Error(`Parent node ${parentUuid} has no children`);
        }
        const currentIndex = childrenArray.findIndex((child) => child.value.uuid === uuid);
        if (currentIndex === -1) {
            throw new Error(`Node ${uuid} not found in parent children`);
        }
        if (currentIndex === index)
            return true;
        // Calculate offset
        // We need to move the element at currentIndex to targetIndex.
        // The API move-array-element works with offset from current position.
        // Ensure index is within bounds [0, length-1]
        const targetIndex = Math.max(0, Math.min(index, childrenArray.length - 1));
        const offset = targetIndex - currentIndex;
        if (offset === 0)
            return true;
        return await Editor.Message.request('scene', 'move-array-element', {
            uuid: parentUuid,
            path: 'children',
            target: currentIndex,
            offset: offset,
        });
    }
    async getParentAndSiblingIndex(uuid) {
        const parentUuid = await this.getParent(uuid);
        if (!parentUuid) {
            throw new Error(`Node ${uuid} has no parent`);
        }
        const parentNode = await Editor.Message.request('scene', 'query-node', parentUuid);
        const childrenArray = parentNode.children;
        if (!childrenArray || !Array.isArray(childrenArray)) {
            throw new Error(`Parent node ${parentUuid} has no children`);
        }
        const index = childrenArray.findIndex((child) => child.value.uuid === uuid);
        if (index === -1) {
            throw new Error(`Node ${uuid} not found in parent children`);
        }
        return { parentUuid, siblingIndex: index };
    }
    async getUpdatedUuid(parentUuid, siblingIndex) {
        const parentNodeInfo = await Editor.Message.request('scene', 'query-node', parentUuid);
        if (!parentNodeInfo || !parentNodeInfo.children || !Array.isArray(parentNodeInfo.children) || !parentNodeInfo.children[siblingIndex]) {
            throw new Error(`Failed to retrieve updated node info after prefab creation.`);
        }
        return parentNodeInfo.children[siblingIndex].value.uuid;
    }
}
exports.SceneTools = SceneTools;
__decorate([
    (0, decorators_1.utcpTool)('nodeGetTree', 'Get the hierarchy tree of specific node or scene root if no reference is provided. Children have recursive structure.', {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema
        }
    }, schemas_1.SceneTreeItemSchema, "GET", ['scene', 'graph', 'node', 'hierarchy', 'tree'])
], SceneTools.prototype, "nodeGetTree", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeGetAtPath', 'Get nodes at specific path in the scene hierarchy. Usually returns one node, but can return multiple nodes with the same name.', {
        type: 'object',
        properties: {
            hierarchyPath: { type: 'string', description: 'Path to the node in the scene hierarchy"' },
        },
        required: ['hierarchyPath']
    }, { type: 'object', properties: { references: { type: 'array', items: schemas_1.InstanceReferenceSchema } } }, "GET", ['scene', 'node', 'get', 'path', 'find', 'look', 'instance', 'hierarchy'])
], SceneTools.prototype, "nodeGetAtPath", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeCreatePrimitive', 'Create a new node with predefined primitive geometry MeshRenderer. If no parent is specified, root node is used. Returns reference to the new node.', { type: 'object',
        properties: {
            name: { type: 'string' },
            primitiveType: { type: 'string', enum: [
                    'Capsule', 'Cone', 'Cube', 'Cylinder', 'Plane', 'Quad', 'Sphere', 'Torus',
                ] },
            parentReference: schemas_1.InstanceReferenceSchema
        },
        required: ['name', 'primitiveType']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['scene', 'node', 'create', 'add'])
], SceneTools.prototype, "sceneCreatePrimitiveNode", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeCreate', 'Create a new node in the scene. If no parent is specified, root node is used. Returns reference to the new node.', {
        type: 'object',
        properties: {
            name: { type: 'string' },
            parentReference: schemas_1.InstanceReferenceSchema,
            assetReference: schemas_1.InstanceReferenceSchema,
            unwrapPrefab: { type: 'boolean', default: false }
        },
        required: ['name']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['scene', 'node', 'create', 'add'])
], SceneTools.prototype, "sceneCreateNode", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeOperate', 'Perform operation on referenced node, including prefab operations.', {
        type: 'object',
        properties: {
            operation: { type: 'string', enum: ['move', 'copy', 'delete', 'create_prefab', 'revert_prefab', 'apply_prefab', 'unwrap_prefab', 'unwrap_prefab_completely', 'open_prefab'] },
            reference: schemas_1.InstanceReferenceSchema,
            newParentReference: schemas_1.InstanceReferenceSchema,
            newPrefabPath: { type: 'string', description: 'For create_prefab: target db:// path', nullable: true },
            siblingIndex: { type: 'integer', description: 'For move/copy: target index in parent children array', nullable: true }
        },
        required: ['operation', 'reference']
    }, { type: 'object',
        properties: {
            success: { type: 'boolean' },
            createdPrefabAssetReference: schemas_1.InstanceReferenceSchema,
            updatedNodeReference: schemas_1.InstanceReferenceSchema,
            copiedNodeReference: schemas_1.InstanceReferenceSchema
        }
    }, "POST", ['scene', 'node', 'remove', 'move', 'copy', 'delete', 'prefab', 'apply', 'revert', 'unwrap', 'create'])
], SceneTools.prototype, "nodeOperate", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvdXRjcC90b29scy9zY2VuZS10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSx5RUFBZ0Q7QUFDaEQsOENBQXlDO0FBQ3pDLHdDQUErSTtBQUUvSSxNQUFhLFVBQVU7SUFhYixBQUFOLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBd0M7O1FBQ3RELElBQUksUUFBUSxDQUFDO1FBQ2IsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEIsUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDNUYsQ0FBQzthQUFNLENBQUM7WUFDSCxrQ0FBa0M7WUFDbEMsUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDekUsQ0FBQztRQUVELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUEsTUFBQSxJQUFJLENBQUMsU0FBUywwQ0FBRSxFQUFFLEtBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUN2RixDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFTLEVBQWtCLEVBQUU7WUFFOUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzdELFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFO2FBQzNDLENBQUMs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LFFBQVEsRUFBRSxJQUFJLEVBQUU7WUFDdEcsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsc0RBQXNELEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTtTQUN6SDtRQUNELFFBQVEsRUFBRSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUM7S0FDdkMsRUFDRCxFQUFFLElBQUksRUFBRSxRQUFRO1FBQ1osVUFBVSxFQUFFO1lBQ1IsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUM1QiwyQkFBMkIsRUFBRSxpQ0FBdUI7WUFDcEQsb0JBQW9CLEVBQUUsaUNBQXVCO1lBQzdDLG1CQUFtQixFQUFFLGlDQUF1QjtTQUMvQztLQUNKLEVBQUUsTUFBTSxFQUFHLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUNySDs2Q0FvS0EiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vLi4vLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCB7IHV0Y3BUb29sIH0gZnJvbSAnLi4vZGVjb3JhdG9ycyc7XG5pbXBvcnQgeyBJU2NlbmVUcmVlSXRlbSwgU2NlbmVUcmVlSXRlbVNjaGVtYSwgQmFzZTY0SW1hZ2VTY2hlbWEsIElCYXNlNjRJbWFnZSwgSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsIElJbnN0YW5jZVJlZmVyZW5jZSB9IGZyb20gJy4uL3NjaGVtYXMnO1xuXG5leHBvcnQgY2xhc3MgU2NlbmVUb29scyB7XG5cbiAgICBAdXRjcFRvb2woXG4gICAgICAgICdub2RlR2V0VHJlZScsXG4gICAgICAgICdHZXQgdGhlIGhpZXJhcmNoeSB0cmVlIG9mIHNwZWNpZmljIG5vZGUgb3Igc2NlbmUgcm9vdCBpZiBubyByZWZlcmVuY2UgaXMgcHJvdmlkZWQuIENoaWxkcmVuIGhhdmUgcmVjdXJzaXZlIHN0cnVjdHVyZS4nLFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIFNjZW5lVHJlZUl0ZW1TY2hlbWEsIFwiR0VUXCIsICBbJ3NjZW5lJywgJ2dyYXBoJywgJ25vZGUnLCAnaGllcmFyY2h5JywgJ3RyZWUnXVxuICAgIClcbiAgICBhc3luYyBub2RlR2V0VHJlZShhcmdzOiB7IHJlZmVyZW5jZT86IElJbnN0YW5jZVJlZmVyZW5jZSB9KTogUHJvbWlzZTxJU2NlbmVUcmVlSXRlbT4ge1xuICAgICAgICBsZXQgdHJlZUJhc2U7XG4gICAgICAgIGlmIChhcmdzLnJlZmVyZW5jZSkge1xuICAgICAgICAgICAgIHRyZWVCYXNlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJywgYXJncy5yZWZlcmVuY2UuaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgIC8vIERlZmF1bHQgcXVlcmllcyB0aGUgd2hvbGUgc2NlbmVcbiAgICAgICAgICAgICB0cmVlQmFzZSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoIXRyZWVCYXNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgdHJlZSBub3QgZm91bmQgZm9yICR7YXJncy5yZWZlcmVuY2U/LmlkIHx8ICdlbnRpcmUgc2NlbmUnfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZm9ybWF0Tm9kZSA9IChub2RlOiBhbnkpOiBJU2NlbmVUcmVlSXRlbSA9PiB7XG5cbiAgICAgICAgICAgY29uc3QgY29tcHMgPSBub2RlLmNvbXBvbmVudHMgPyBub2RlLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICByZWZlcmVuY2U6IHsgaWQ6IGMudmFsdWUsIHR5cGU6IGMudHlwZSB9XG4gICAgICAgICAgIH0pKSA6IFtdO1xuXG4gICAgICAgICAgIGxldCBjaGlsZHJlbjogSVNjZW5lVHJlZUl0ZW1bXSA9IFtdO1xuICAgICAgICAgICAgY2hpbGRyZW4gPSBub2RlLmNoaWxkcmVuID8gbm9kZS5jaGlsZHJlbi5tYXAoZm9ybWF0Tm9kZSkuZmlsdGVyKChjOiBhbnkpID0+IGMgIT09IG51bGwpIDogW107XG5cbiAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2U6IHsgaWQ6IG5vZGUudXVpZCwgdHlwZTogJ2NjLk5vZGUnIH0sXG4gICAgICAgICAgICAgICAgbmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgICAgIGFjdGl2ZTogbm9kZS5hY3RpdmUsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogY29tcHMsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IGNoaWxkcmVuXG4gICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBjb25zdCByZXN1bHQ6IElTY2VuZVRyZWVJdGVtID0gZm9ybWF0Tm9kZSh0cmVlQmFzZSk7XG4gICAgICAgIHJlc3VsdC5wYXRoID0gKHRyZWVCYXNlIGFzIGFueSkucGF0aCB8fCB1bmRlZmluZWQ7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnbm9kZUdldEF0UGF0aCcsXG4gICAgICAgICdHZXQgbm9kZXMgYXQgc3BlY2lmaWMgcGF0aCBpbiB0aGUgc2NlbmUgaGllcmFyY2h5LiBVc3VhbGx5IHJldHVybnMgb25lIG5vZGUsIGJ1dCBjYW4gcmV0dXJuIG11bHRpcGxlIG5vZGVzIHdpdGggdGhlIHNhbWUgbmFtZS4nLFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBoaWVyYXJjaHlQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1BhdGggdG8gdGhlIG5vZGUgaW4gdGhlIHNjZW5lIGhpZXJhcmNoeVwiJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2hpZXJhcmNoeVBhdGgnXVxuICAgICAgICB9LCB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZXM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hIH0gfSB9LCBcIkdFVFwiLCAgWydzY2VuZScsICdub2RlJywgJ2dldCcsICdwYXRoJywgJ2ZpbmQnLCAnbG9vaycsICdpbnN0YW5jZScsICdoaWVyYXJjaHknXVxuICAgIClcbiAgICBhc3luYyBub2RlR2V0QXRQYXRoKGFyZ3M6IHsgaGllcmFyY2h5UGF0aDogc3RyaW5nIH0pOiBQcm9taXNlPHsgcmVmZXJlbmNlczogSUluc3RhbmNlUmVmZXJlbmNlW10gfT4ge1xuICAgICAgICBjb25zdCBub2RlVHJlZSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICBpZiAoIW5vZGVUcmVlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNjZW5lIGlzIGVtcHR5IG9yIGNvdWxkIG5vdCByZXRyaWV2ZSBzY2VuZSB0cmVlLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NlbmVSb290TmFtZSA9IChub2RlVHJlZS5uYW1lIGFzIHVua25vd24gYXMgc3RyaW5nKTtcbiAgICAgICAgaWYgKGFyZ3MuaGllcmFyY2h5UGF0aC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgICAgICAgIGFyZ3MuaGllcmFyY2h5UGF0aCA9IGFyZ3MuaGllcmFyY2h5UGF0aC5zbGljZSgxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXJncy5oaWVyYXJjaHlQYXRoLnN0YXJ0c1dpdGgoYCR7c2NlbmVSb290TmFtZX1gKSkge1xuICAgICAgICAgICAgYXJncy5oaWVyYXJjaHlQYXRoID0gYXJncy5oaWVyYXJjaHlQYXRoLnNsaWNlKHNjZW5lUm9vdE5hbWUubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXJncy5oaWVyYXJjaHlQYXRoID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgcmVmZXJlbmNlczogW3sgaWQ6IChub2RlVHJlZS51dWlkIGFzIHVua25vd24gYXMgc3RyaW5nKSB9XSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gYXJncy5oaWVyYXJjaHlQYXRoLnNwbGl0KCcvJykuZmlsdGVyKHAgPT4gcC5sZW5ndGggPiAwKTtcbiAgICAgICAgbGV0IGN1cnJlbnROb2RlcyA9IFtub2RlVHJlZV07XG4gICAgICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXRoUGFydHMpIHtcbiAgICAgICAgICAgIGNvbnN0IG5leHROb2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBjdXJyZW50Tm9kZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGluZ0NoaWxkcmVuID0gKG5vZGUuY2hpbGRyZW4gfHwgW10pLmZpbHRlcigoY2hpbGQ6IGFueSkgPT4gY2hpbGQubmFtZSA9PT0gcGFydCk7XG4gICAgICAgICAgICAgICAgbmV4dE5vZGVzLnB1c2goLi4ubWF0Y2hpbmdDaGlsZHJlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjdXJyZW50Tm9kZXMgPSBuZXh0Tm9kZXM7XG4gICAgICAgICAgICBpZiAoY3VycmVudE5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgcmVmZXJlbmNlczogY3VycmVudE5vZGVzLm1hcCgobm9kZTogYW55KSA9PiAoeyBpZDogbm9kZS51dWlkLCB0eXBlOiAnY2MuTm9kZScgfSkpIH07XG4gICAgfVxuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnbm9kZUNyZWF0ZVByaW1pdGl2ZScsXG4gICAgICAgICdDcmVhdGUgYSBuZXcgbm9kZSB3aXRoIHByZWRlZmluZWQgcHJpbWl0aXZlIGdlb21ldHJ5IE1lc2hSZW5kZXJlci4gSWYgbm8gcGFyZW50IGlzIHNwZWNpZmllZCwgcm9vdCBub2RlIGlzIHVzZWQuIFJldHVybnMgcmVmZXJlbmNlIHRvIHRoZSBuZXcgbm9kZS4nLFxuICAgICAgICAgeyAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgIHByaW1pdGl2ZVR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFtcbiAgICAgICAgICAgICAgICAgICAgJ0NhcHN1bGUnLCAnQ29uZScsICdDdWJlJywgJ0N5bGluZGVyJywgJ1BsYW5lJywgJ1F1YWQnLCAnU3BoZXJlJywgJ1RvcnVzJyxcbiAgICAgICAgICAgICAgICBdIH0sXG4gICAgICAgICAgICAgICAgcGFyZW50UmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25hbWUnLCAncHJpbWl0aXZlVHlwZSddXG4gICAgICAgICB9LCBcbiAgICAgICAgIHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSB9LCByZXF1aXJlZDogWydyZWZlcmVuY2UnXSB9LCBcIlBPU1RcIiwgIFsnc2NlbmUnLCAnbm9kZScsICdjcmVhdGUnLCAnYWRkJ11cbiAgICApXG4gICAgYXN5bmMgc2NlbmVDcmVhdGVQcmltaXRpdmVOb2RlKGFyZ3M6IHsgbmFtZTogc3RyaW5nLCBwcmltaXRpdmVUeXBlOiBzdHJpbmcsIHBhcmVudFJlZmVyZW5jZT86IElJbnN0YW5jZVJlZmVyZW5jZSB9KTogUHJvbWlzZTx7IHJlZmVyZW5jZTogSUluc3RhbmNlUmVmZXJlbmNlIH0+IHtcbiAgICAgICAgY29uc3QgcHJpbWl0aXZlTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgICAgJ0NhcHN1bGUnOiBcImRiOi8vaW50ZXJuYWwvZGVmYXVsdF9wcmVmYWIvM2QvQ2Fwc3VsZS5wcmVmYWJcIixcbiAgICAgICAgICAgICdDb25lJzogXCJkYjovL2ludGVybmFsL2RlZmF1bHRfcHJlZmFiLzNkL0NvbmUucHJlZmFiXCIsXG4gICAgICAgICAgICAnQ3ViZSc6IFwiZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X3ByZWZhYi8zZC9DdWJlLnByZWZhYlwiLFxuICAgICAgICAgICAgJ0N5bGluZGVyJzogXCJkYjovL2ludGVybmFsL2RlZmF1bHRfcHJlZmFiLzNkL0N5bGluZGVyLnByZWZhYlwiLFxuICAgICAgICAgICAgJ1BsYW5lJzogXCJkYjovL2ludGVybmFsL2RlZmF1bHRfcHJlZmFiLzNkL1BsYW5lLnByZWZhYlwiLFxuICAgICAgICAgICAgJ1F1YWQnOiBcImRiOi8vaW50ZXJuYWwvZGVmYXVsdF9wcmVmYWIvM2QvUXVhZC5wcmVmYWJcIixcbiAgICAgICAgICAgICdTcGhlcmUnOiBcImRiOi8vaW50ZXJuYWwvZGVmYXVsdF9wcmVmYWIvM2QvU3BoZXJlLnByZWZhYlwiLFxuICAgICAgICAgICAgJ1RvcnVzJzogXCJkYjovL2ludGVybmFsL2RlZmF1bHRfcHJlZmFiLzNkL1RvcnVzLnByZWZhYlwiLFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICghcHJpbWl0aXZlTWFwW2FyZ3MucHJpbWl0aXZlVHlwZV0pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJpbWl0aXZlIHR5cGU6ICR7YXJncy5wcmltaXRpdmVUeXBlfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJlZmFiVXJsID0gcHJpbWl0aXZlTWFwW2FyZ3MucHJpbWl0aXZlVHlwZV07XG4gICAgICAgIGNvbnN0IGFzc2V0VXVpZCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXV1aWQnLCBwcmVmYWJVcmwpO1xuICAgICAgICBpZiAoIWFzc2V0VXVpZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCBhc3NldCBmb3IgcHJpbWl0aXZlIHR5cGUgJHthcmdzLnByaW1pdGl2ZVR5cGV9IGF0ICR7cHJlZmFiVXJsfWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNjZW5lQ3JlYXRlTm9kZSh7XG4gICAgICAgICAgICBuYW1lOiBhcmdzLm5hbWUsXG4gICAgICAgICAgICBwYXJlbnRSZWZlcmVuY2U6IGFyZ3MucGFyZW50UmVmZXJlbmNlLFxuICAgICAgICAgICAgYXNzZXRSZWZlcmVuY2U6IHsgaWQ6IGFzc2V0VXVpZCwgdHlwZTogJ2NjLlByZWZhYicgfSxcbiAgICAgICAgICAgIHVud3JhcFByZWZhYjogdHJ1ZVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBAdXRjcFRvb2woXG4gICAgICAgICdub2RlQ3JlYXRlJyxcbiAgICAgICAgJ0NyZWF0ZSBhIG5ldyBub2RlIGluIHRoZSBzY2VuZS4gSWYgbm8gcGFyZW50IGlzIHNwZWNpZmllZCwgcm9vdCBub2RlIGlzIHVzZWQuIFJldHVybnMgcmVmZXJlbmNlIHRvIHRoZSBuZXcgbm9kZS4nLFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgcGFyZW50UmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSxcbiAgICAgICAgICAgICAgICBhc3NldFJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsXG4gICAgICAgICAgICAgICAgdW53cmFwUHJlZmFiOiB7IHR5cGU6ICdib29sZWFuJywgZGVmYXVsdDogZmFsc2UgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25hbWUnXVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEgfSwgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJ10gfSwgXCJQT1NUXCIsICBbJ3NjZW5lJywgJ25vZGUnLCAnY3JlYXRlJywgJ2FkZCddXG4gICAgKVxuICAgIGFzeW5jIHNjZW5lQ3JlYXRlTm9kZShhcmdzOiB7IG5hbWU6IHN0cmluZywgcGFyZW50UmVmZXJlbmNlPzogSUluc3RhbmNlUmVmZXJlbmNlLCBhc3NldFJlZmVyZW5jZT86IElJbnN0YW5jZVJlZmVyZW5jZSwgdW53cmFwUHJlZmFiPzogYm9vbGVhbiB9KTogUHJvbWlzZTx7IHJlZmVyZW5jZTogSUluc3RhbmNlUmVmZXJlbmNlIH0+IHtcbiAgICAgICAgY29uc3Qgb3B0aW9uczogYW55ID0ge1xuICAgICAgICAgICAgbmFtZTogYXJncy5uYW1lXG4gICAgICAgIH07XG4gICAgICAgIGlmIChhcmdzLnBhcmVudFJlZmVyZW5jZSkge1xuICAgICAgICAgICAgb3B0aW9ucy5wYXJlbnQgPSBhcmdzLnBhcmVudFJlZmVyZW5jZS5pZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEZvcmNlIHJvb3QgaWYgbm8gcGFyZW50IHByb3ZpZGVkXG4gICAgICAgICAgICBvcHRpb25zLnBhcmVudCA9IChhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKSkudXVpZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBhc3NldFV1aWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gICAgICAgIC8vIDEuIERldGVybWluZSBBc3NldCBVVUlEXG4gICAgICAgIGlmICgoYXJncy5hc3NldFJlZmVyZW5jZSAmJiAnaWQnIGluIGFyZ3MuYXNzZXRSZWZlcmVuY2UpKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXJncy5hc3NldFJlZmVyZW5jZS5pZCk7XG4gICAgICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXQgcmVmZXJlbmNlIG5vdCBmb3VuZDogJHthcmdzLmFzc2V0UmVmZXJlbmNlLmlkfWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgcHJlZmFiRm91bmQgPSBhc3NldEluZm8udHlwZSA9PT0gJ2NjLlByZWZhYic7XG4gICAgICAgICAgICAvLyBJZiBub3QgYSBwcmVmYWIsIGNoZWNrIGlmIGl0IGhhcyBhIHByZWZhYiBzdWItYXNzZXQgKGxpa2UgaW4gY2FzZSBvZiBGQlgpXG4gICAgICAgICAgICBpZiAoIXByZWZhYkZvdW5kKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgc3ViQXNzZXQgb2YgT2JqZWN0LnZhbHVlcyhhc3NldEluZm8uc3ViQXNzZXRzKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViQXNzZXQudHlwZSA9PT0gJ2NjLlByZWZhYicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZCA9IHN1YkFzc2V0LnV1aWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmYWJGb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkID0gYXNzZXRJbmZvLnV1aWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcHJlZmFiRm91bmQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3ZpZGVkIGFzc2V0IHJlZmVyZW5jZSAke2FyZ3MuYXNzZXRSZWZlcmVuY2UuaWR9IGlzIG5vdCBhIHByZWZhYiBhbmQgZG9lcyBub3QgY29udGFpbiBhIHByZWZhYiBzdWItYXNzZXQuYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghYXJncy51bndyYXBQcmVmYWIpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy51bmxpbmtQcmVmYWIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy50eXBlID0gJ2NjLlByZWZhYic7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFzc2V0VXVpZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5hc3NldFV1aWQgPSBhc3NldFV1aWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAyLiBDcmVhdGUgTm9kZVxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIG9wdGlvbnMpO1xuICAgICAgICBjb25zdCBuZXdOb2RlVXVpZCA9IEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdFswXSA6IHJlc3VsdDtcblxuICAgICAgICBpZiAoIW5ld05vZGVVdWlkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgbm9kZSAke2FyZ3MubmFtZX0ke2FyZ3MuYXNzZXRSZWZlcmVuY2UgPyBgIGZyb20gYXNzZXQgJHthcmdzLmFzc2V0UmVmZXJlbmNlLmlkfWAgOiAnJ30uYCk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xuXG4gICAgICAgIHJldHVybiB7IHJlZmVyZW5jZTogeyBpZDogbmV3Tm9kZVV1aWQsIHR5cGU6ICdjYy5Ob2RlJyB9IH07XG4gICAgfVxuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnbm9kZU9wZXJhdGUnLFxuICAgICAgICAnUGVyZm9ybSBvcGVyYXRpb24gb24gcmVmZXJlbmNlZCBub2RlLCBpbmNsdWRpbmcgcHJlZmFiIG9wZXJhdGlvbnMuJyxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgb3BlcmF0aW9uOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ21vdmUnLCAnY29weScsICdkZWxldGUnLCAnY3JlYXRlX3ByZWZhYicsICdyZXZlcnRfcHJlZmFiJywgJ2FwcGx5X3ByZWZhYicsICd1bndyYXBfcHJlZmFiJywgJ3Vud3JhcF9wcmVmYWJfY29tcGxldGVseScsICdvcGVuX3ByZWZhYiddIH0sXG4gICAgICAgICAgICAgICAgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSxcbiAgICAgICAgICAgICAgICBuZXdQYXJlbnRSZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLFxuICAgICAgICAgICAgICAgIG5ld1ByZWZhYlBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnRm9yIGNyZWF0ZV9wcmVmYWI6IHRhcmdldCBkYjovLyBwYXRoJywgbnVsbGFibGU6IHRydWUgfSxcbiAgICAgICAgICAgICAgICBzaWJsaW5nSW5kZXg6IHsgdHlwZTogJ2ludGVnZXInLCBkZXNjcmlwdGlvbjogJ0ZvciBtb3ZlL2NvcHk6IHRhcmdldCBpbmRleCBpbiBwYXJlbnQgY2hpbGRyZW4gYXJyYXknLCBudWxsYWJsZTogdHJ1ZSB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnb3BlcmF0aW9uJywgJ3JlZmVyZW5jZSddXG4gICAgICAgIH0sXG4gICAgICAgIHsgdHlwZTogJ29iamVjdCcsIFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG4gICAgICAgICAgICAgICAgY3JlYXRlZFByZWZhYkFzc2V0UmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSxcbiAgICAgICAgICAgICAgICB1cGRhdGVkTm9kZVJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsXG4gICAgICAgICAgICAgICAgY29waWVkTm9kZVJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWFcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgXCJQT1NUXCIsICBbJ3NjZW5lJywgJ25vZGUnLCAncmVtb3ZlJywgJ21vdmUnLCAnY29weScsICdkZWxldGUnLCAncHJlZmFiJywgJ2FwcGx5JywgJ3JldmVydCcsICd1bndyYXAnLCAnY3JlYXRlJ11cbiAgICApXG4gICAgYXN5bmMgbm9kZU9wZXJhdGUoYXJnczogeyBvcGVyYXRpb246IHN0cmluZywgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UsIG5ld1BhcmVudFJlZmVyZW5jZT86IElJbnN0YW5jZVJlZmVyZW5jZSwgbmV3UHJlZmFiUGF0aD86IHN0cmluZywgc2libGluZ0luZGV4PzogbnVtYmVyIH0pOiBcbiAgICAgICAgUHJvbWlzZTx7IHN1Y2Nlc3M/OiBib29sZWFuLCBjcmVhdGVkUHJlZmFiQXNzZXRSZWZlcmVuY2U/OiBJSW5zdGFuY2VSZWZlcmVuY2UsIHVwZGF0ZWROb2RlUmVmZXJlbmNlPzogSUluc3RhbmNlUmVmZXJlbmNlLCBjb3BpZWROb2RlUmVmZXJlbmNlPzogSUluc3RhbmNlUmVmZXJlbmNlIH0+IHtcbiAgICAgICAgaWYgKGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBhcmdzLnJlZmVyZW5jZS5pZCkgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGFyZ2V0IG5vZGUgJHthcmdzLnJlZmVyZW5jZS5pZH0gbm90IGZvdW5kYCk7XG4gICAgICAgIH1cblxuICAgICAgICBzd2l0Y2ggKGFyZ3Mub3BlcmF0aW9uKSB7XG4gICAgICAgICAgICBjYXNlICdtb3ZlJzpcbiAgICAgICAgICAgICAgICBpZiAoIWFyZ3MubmV3UGFyZW50UmVmZXJlbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5ld1BhcmVudFJlZmVyZW5jZSByZXF1aXJlZCBmb3IgbW92ZVwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcGFyZW50Jywge1xuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGFyZ3MubmV3UGFyZW50UmVmZXJlbmNlLmlkLFxuICAgICAgICAgICAgICAgICAgICB1dWlkczogYXJncy5yZWZlcmVuY2UuaWQsXG4gICAgICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybTogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFyZ3Muc2libGluZ0luZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRTaWJsaW5nSW5kZXgoYXJncy5yZWZlcmVuY2UuaWQsIGFyZ3Muc2libGluZ0luZGV4KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcblxuICAgICAgICAgICAgY2FzZSAnY29weSc6XG4gICAgICAgICAgICAgICAgIGNvbnN0IGR1cGxpY2F0ZVJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2R1cGxpY2F0ZS1ub2RlJywgW2FyZ3MucmVmZXJlbmNlLmlkXSk7XG4gICAgICAgICAgICAgICAgIGlmICghZHVwbGljYXRlUmVzdWx0IHx8IGR1cGxpY2F0ZVJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlICR7YXJncy5yZWZlcmVuY2UuaWR9IGR1cGxpY2F0aW9uIGZhaWxlZGApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICBjb25zdCBuZXdOb2RlcyA9IGR1cGxpY2F0ZVJlc3VsdCBhcyBzdHJpbmdbXTtcbiAgICAgICAgICAgICAgICAgY29uc3QgbmV3Tm9kZUlkID0gbmV3Tm9kZXNbMF07IFxuICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubmV3UGFyZW50UmVmZXJlbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcGFyZW50Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBhcmdzLm5ld1BhcmVudFJlZmVyZW5jZS5pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWRzOiBuZXdOb2RlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybTogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICBpZiAoYXJncy5zaWJsaW5nSW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRTaWJsaW5nSW5kZXgobmV3Tm9kZUlkLCBhcmdzLnNpYmxpbmdJbmRleCk7XG4gICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xuICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY29waWVkTm9kZVJlZmVyZW5jZTogeyBpZDogbmV3Tm9kZUlkLCB0eXBlOiAnY2MuTm9kZScgfSB9O1xuXG4gICAgICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1ub2RlJywge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiBhcmdzLnJlZmVyZW5jZS5pZFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZUNoZWNrID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIGFyZ3MucmVmZXJlbmNlLmlkKTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZUNoZWNrICE9PSBudWxsICYmIG5vZGVDaGVjayAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZSAke2FyZ3MucmVmZXJlbmNlLmlkfSBzdGlsbCBleGlzdHMgYWZ0ZXIgcmVtb3ZhbGApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NuYXBzaG90Jyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG5cbiAgICAgICAgICAgIGNhc2UgJ2NyZWF0ZV9wcmVmYWInOlxuICAgICAgICAgICAgICAgIGlmICghYXJncy5uZXdQcmVmYWJQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5ld1ByZWZhYlBhdGggcmVxdWlyZWQgZm9yIGNyZWF0ZV9wcmVmYWJcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudEluZm8gPSBhd2FpdCB0aGlzLmdldFBhcmVudEFuZFNpYmxpbmdJbmRleChhcmdzLnJlZmVyZW5jZS5pZCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVkUHJlZmFiVXVpZCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBwYWNrYWdlSlNPTi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdjcmVhdGVQcmVmYWJGcm9tTm9kZScsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLnJlZmVyZW5jZS5pZCwgYXJncy5uZXdQcmVmYWJQYXRoXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICghY3JlYXRlZFByZWZhYlV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIHRvIGNyZWF0ZSBwcmVmYWIgYXNzZXQuXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkTm9kZUlkID0gYXdhaXQgdGhpcy5nZXRVcGRhdGVkVXVpZChwYXJlbnRJbmZvLnBhcmVudFV1aWQsIHBhcmVudEluZm8uc2libGluZ0luZGV4KTtcblxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NuYXBzaG90Jyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBjcmVhdGVkUHJlZmFiQXNzZXRSZWZlcmVuY2U6IHsgaWQ6IGNyZWF0ZWRQcmVmYWJVdWlkLCB0eXBlOiAnY2MuUHJlZmFiJyB9LCB1cGRhdGVkTm9kZVJlZmVyZW5jZTogeyBpZDogdXBkYXRlZE5vZGVJZCwgdHlwZTogJ2NjLk5vZGUnIH0gfTtcbiAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICBjYXNlICdyZXZlcnRfcHJlZmFiJzpcbiAgICAgICAgICAgICAgICBjb25zdCByZXZlcnRTdWNjZXNzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVzdG9yZS1wcmVmYWInLCB7IHV1aWQ6IGFyZ3MucmVmZXJlbmNlLmlkIH0pO1xuXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc25hcHNob3QnKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHJldmVydFN1Y2Nlc3MgfTtcblxuICAgICAgICAgICAgY2FzZSAnYXBwbHlfcHJlZmFiJzpcbiAgICAgICAgICAgICAgICBjb25zdCBhcHBseUVycm9yID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHBhY2thZ2VKU09OLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ2FwcGx5UHJlZmFiQnlOb2RlJyxcbiAgICAgICAgICAgICAgICAgICAgYXJnczogW2FyZ3MucmVmZXJlbmNlLmlkXVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFwcGx5RXJyb3IgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBhcHBseSBwcmVmYWI6ICR7YXBwbHlFcnJvcn1gKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuXG4gICAgICAgICAgICBjYXNlICd1bndyYXBfcHJlZmFiJzpcbiAgICAgICAgICAgICAgICBjb25zdCB1bndyYXBFcnJvciA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBwYWNrYWdlSlNPTi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICd1bmxpbmtQcmVmYWJCeU5vZGUnLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5yZWZlcmVuY2UuaWQsIGZhbHNlXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh1bndyYXBFcnJvciAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHVud3JhcCBwcmVmYWI6ICR7dW53cmFwRXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc25hcHNob3QnKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcblxuICAgICAgICAgICAgY2FzZSAndW53cmFwX3ByZWZhYl9jb21wbGV0ZWx5JzpcbiAgICAgICAgICAgICAgICBjb25zdCB1bndyYXBBbGxFcnJvciA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBwYWNrYWdlSlNPTi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICd1bmxpbmtQcmVmYWJCeU5vZGUnLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5yZWZlcmVuY2UuaWQsIHRydWVdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHVud3JhcEFsbEVycm9yICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gdW53cmFwIHByZWZhYiBjb21wbGV0ZWx5OiAke3Vud3JhcEFsbEVycm9yfWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NuYXBzaG90Jyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG5cbiAgICAgICAgICAgIGNhc2UgJ29wZW5fcHJlZmFiJzpcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlRm9yUHJlZmFiOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgYXJncy5yZWZlcmVuY2UuaWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZUZvclByZWZhYikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJHthcmdzLnJlZmVyZW5jZS5pZH0gbm90IGZvdW5kYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBwSW5mbyA9IG5vZGVGb3JQcmVmYWIuX19wcmVmYWJfXyB8fCBub2RlRm9yUHJlZmFiLl9wcmVmYWIgfHwgKG5vZGVGb3JQcmVmYWIudmFsdWUgJiYgKG5vZGVGb3JQcmVmYWIudmFsdWUuX19wcmVmYWJfXyB8fCBub2RlRm9yUHJlZmFiLnZhbHVlLl9wcmVmYWIpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwVmFsdWUgPSBwSW5mbz8udmFsdWUgfHwgcEluZm87XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0VXVpZCA9IHBWYWx1ZT8uYXNzZXRVdWlkIHx8IHBWYWx1ZT8udXVpZDtcblxuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJHthcmdzLnJlZmVyZW5jZS5pZH0gaXMgbm90IGxpbmtlZCB0byBhIHByZWZhYmApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdvcGVuLWFzc2V0JywgdGFyZ2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBvcGVuIHByZWZhYiBhc3NldCAke3RhcmdldFV1aWR9LiBSZWFzb246ICR7ZXJyb3I/Lm1lc3NhZ2UgfHwgZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBzY2VuZSBub2RlIG9wZXJhdGlvbjogJHthcmdzLm9wZXJhdGlvbn1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhlbHBlcnNcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UGFyZW50KG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICBjb25zdCBub2RlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKG5vZGU/LnBhcmVudD8udmFsdWU/LnV1aWQpIHJldHVybiBub2RlLnBhcmVudC52YWx1ZS51dWlkO1xuICAgICAgICBpZiAobm9kZT8ucGFyZW50Py51dWlkKSByZXR1cm4gbm9kZS5wYXJlbnQudXVpZDtcbiAgICAgICAgcmV0dXJuIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LXV1aWQnKTtcbiAgICB9XG5cbiAgICAvLyBIZWxwZXIgdG8gc2V0IHNpYmxpbmcgaW5kZXhcbiAgICBwcml2YXRlIGFzeW5jIHNldFNpYmxpbmdJbmRleCh1dWlkOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpIHtcbiAgICAgICAgLy8gR2V0IHBhcmVudCBmaXJzdFxuICAgICAgICBjb25zdCBwYXJlbnRVdWlkID0gYXdhaXQgdGhpcy5nZXRQYXJlbnQodXVpZCk7XG4gICAgICAgIGlmICghcGFyZW50VXVpZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlICR7dXVpZH0gaGFzIG5vIHBhcmVudGApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2V0IGNoaWxkcmVuIG9mIHBhcmVudFxuICAgICAgICBjb25zdCBwYXJlbnROb2RlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHBhcmVudFV1aWQpO1xuICAgICAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gcGFyZW50Tm9kZS5jaGlsZHJlbjtcbiAgICAgICAgaWYgKCFjaGlsZHJlbkFycmF5IHx8ICFBcnJheS5pc0FycmF5KGNoaWxkcmVuQXJyYXkpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCBub2RlICR7cGFyZW50VXVpZH0gaGFzIG5vIGNoaWxkcmVuYCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjdXJyZW50SW5kZXggPSBjaGlsZHJlbkFycmF5LmZpbmRJbmRleCgoY2hpbGQ6IGFueSkgPT4gY2hpbGQudmFsdWUudXVpZCA9PT0gdXVpZCk7XG4gICAgICAgIGlmIChjdXJyZW50SW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJHt1dWlkfSBub3QgZm91bmQgaW4gcGFyZW50IGNoaWxkcmVuYCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY3VycmVudEluZGV4ID09PSBpbmRleCkgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIG9mZnNldFxuICAgICAgICAvLyBXZSBuZWVkIHRvIG1vdmUgdGhlIGVsZW1lbnQgYXQgY3VycmVudEluZGV4IHRvIHRhcmdldEluZGV4LlxuICAgICAgICAvLyBUaGUgQVBJIG1vdmUtYXJyYXktZWxlbWVudCB3b3JrcyB3aXRoIG9mZnNldCBmcm9tIGN1cnJlbnQgcG9zaXRpb24uXG4gICAgICAgIFxuICAgICAgICAvLyBFbnN1cmUgaW5kZXggaXMgd2l0aGluIGJvdW5kcyBbMCwgbGVuZ3RoLTFdXG4gICAgICAgIGNvbnN0IHRhcmdldEluZGV4ID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oaW5kZXgsIGNoaWxkcmVuQXJyYXkubGVuZ3RoIC0gMSkpO1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0YXJnZXRJbmRleCAtIGN1cnJlbnRJbmRleDtcbiAgICAgICAgXG4gICAgICAgIGlmIChvZmZzZXQgPT09IDApIHJldHVybiB0cnVlO1xuXG4gICAgICAgIHJldHVybiBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdtb3ZlLWFycmF5LWVsZW1lbnQnLCB7XG4gICAgICAgICAgICB1dWlkOiBwYXJlbnRVdWlkLFxuICAgICAgICAgICAgcGF0aDogJ2NoaWxkcmVuJyxcbiAgICAgICAgICAgIHRhcmdldDogY3VycmVudEluZGV4LFxuICAgICAgICAgICAgb2Zmc2V0OiBvZmZzZXQsXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UGFyZW50QW5kU2libGluZ0luZGV4KHV1aWQ6IHN0cmluZyk6IFByb21pc2U8eyBwYXJlbnRVdWlkOiBzdHJpbmcsIHNpYmxpbmdJbmRleDogbnVtYmVyIH0+IHtcbiAgICAgICAgY29uc3QgcGFyZW50VXVpZCA9IGF3YWl0IHRoaXMuZ2V0UGFyZW50KHV1aWQpO1xuICAgICAgICBpZiAoIXBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZSAke3V1aWR9IGhhcyBubyBwYXJlbnRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhcmVudE5vZGUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgcGFyZW50VXVpZCk7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuQXJyYXkgPSBwYXJlbnROb2RlLmNoaWxkcmVuO1xuICAgICAgICBpZiAoIWNoaWxkcmVuQXJyYXkgfHwgIUFycmF5LmlzQXJyYXkoY2hpbGRyZW5BcnJheSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IG5vZGUgJHtwYXJlbnRVdWlkfSBoYXMgbm8gY2hpbGRyZW5gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBpbmRleCA9IGNoaWxkcmVuQXJyYXkuZmluZEluZGV4KChjaGlsZDogYW55KSA9PiBjaGlsZC52YWx1ZS51dWlkID09PSB1dWlkKTtcbiAgICAgICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlICR7dXVpZH0gbm90IGZvdW5kIGluIHBhcmVudCBjaGlsZHJlbmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHBhcmVudFV1aWQsIHNpYmxpbmdJbmRleDogaW5kZXggfTtcbiAgICB9XG4gICAgXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRVcGRhdGVkVXVpZChwYXJlbnRVdWlkOiBzdHJpbmcsIHNpYmxpbmdJbmRleDogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgICAgY29uc3QgcGFyZW50Tm9kZUluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgcGFyZW50VXVpZCk7XG4gICAgICAgIGlmICghcGFyZW50Tm9kZUluZm8gfHwgIXBhcmVudE5vZGVJbmZvLmNoaWxkcmVuIHx8ICFBcnJheS5pc0FycmF5KHBhcmVudE5vZGVJbmZvLmNoaWxkcmVuKSB8fCAhcGFyZW50Tm9kZUluZm8uY2hpbGRyZW5bc2libGluZ0luZGV4XSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcmV0cmlldmUgdXBkYXRlZCBub2RlIGluZm8gYWZ0ZXIgcHJlZmFiIGNyZWF0aW9uLmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwYXJlbnROb2RlSW5mby5jaGlsZHJlbltzaWJsaW5nSW5kZXhdLnZhbHVlLnV1aWQ7XG4gICAgfVxufSJdfQ==