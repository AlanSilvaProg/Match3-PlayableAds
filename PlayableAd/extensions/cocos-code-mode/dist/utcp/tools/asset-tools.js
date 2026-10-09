"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetTools = void 0;
const package_json_1 = __importDefault(require("../../../package.json"));
const sharp_1 = __importDefault(require("sharp"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const decorators_1 = require("../decorators");
const schemas_1 = require("../schemas");
const path_1 = __importStar(require("path"));
const os_1 = __importDefault(require("os"));
function normalizePath(p) {
    if (!p)
        return 'db://assets';
    let path = p.replace(/\\/g, '/').trim();
    // Handle db:// protocol
    if (path.startsWith('db://')) {
        return path.endsWith('/') && path !== 'db://' ? path.slice(0, -1) : path;
    }
    // Remove leading slash
    if (path.startsWith('/')) {
        path = path.slice(1);
    }
    // Handle root aliases
    if (path === '' || path === 'assets') {
        return 'db://assets';
    }
    // Handle 'assets/' prefix
    if (path.startsWith('assets/')) {
        const result = 'db://' + path;
        return result.endsWith('/') ? result.slice(0, -1) : result;
    }
    // Treat as relative path under assets
    if (path.endsWith('/')) {
        path = path.slice(0, -1);
    }
    return `db://assets/${path}`;
}
class AssetTools {
    async assetGetTree(args) {
        if (args.reference) {
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.reference.id);
            if (!info) {
                throw new Error(`Asset with UUID ${args.reference.id} not found.`);
            }
            args.assetPath = info.url;
        }
        let rootPath = normalizePath(args.assetPath);
        const pattern = `${rootPath}/**`;
        const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
        const rootUuid = await Editor.Message.request('asset-db', 'query-uuid', rootPath);
        const assetsMap = new Map();
        // Create Root Node first
        const rootName = rootPath.split('/').pop() || 'assets';
        const rootNode = {
            filesystemPath: Editor.Project.path + '/' + rootPath.replace('db://', ''),
            reference: { id: rootUuid || 'root', type: 'folder' },
            name: rootName,
            children: []
        };
        assetsMap.set(rootPath, rootNode);
        // First pass: Map assets
        assets.forEach((asset) => {
            if (asset.url === rootPath)
                return; // Skip root, already created
            const type = asset.isDirectory ? 'folder' : asset.type;
            const treeItem = {
                reference: { id: asset.uuid, type: type },
                name: asset.name,
                children: []
            };
            assetsMap.set(asset.url, treeItem);
        });
        // Second pass: Build hierarchy
        assets.forEach((asset) => {
            if (asset.url === rootPath)
                return;
            const treeItem = assetsMap.get(asset.url);
            if (!treeItem)
                return;
            const parentUrl = asset.url.substring(0, asset.url.lastIndexOf('/'));
            const parentItem = assetsMap.get(parentUrl);
            if (parentItem) {
                parentItem.children.push(treeItem);
            }
        });
        return rootNode;
    }
    async assetGetAtPath(args) {
        let targetPath = normalizePath(args.assetPath);
        console.log(`Looking for asset at path: ${targetPath}`);
        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', targetPath);
        if (!assetInfo) {
            throw new Error(`Asset not found at path: ${targetPath}`);
        }
        else {
            return { reference: { id: assetInfo.uuid, type: assetInfo.type } };
        }
    }
    async assetCreate(args) {
        var _a, _b, _c, _d;
        let targetPath = normalizePath(args.assetPath);
        // Map 'preset' from schema to 'type' expected by function
        const type = args.preset;
        const presetMap = {
            'material': 'db://internal/default_file_content/material/default.mtl',
            'effect': 'db://internal/default_file_content/effect/default.effect',
            'scene': 'db://internal/default_file_content/scene/default.scene',
            'prefab': 'db://internal/default_file_content/prefab/default.prefab',
            'animation-clip': 'db://internal/default_file_content/animation-clip/default.anim',
            'render-texture': 'db://internal/default_file_content/render-texture/default.rt',
            'physics-material': 'db://internal/default_file_content/physics-material/default.pmtl',
            'animation-graph': 'db://internal/default_file_content/animation-graph/default.animgraph',
            'animation-graph-variant': 'db://internal/default_file_content/animation-graph-variant/default.animgraphvari',
            'animation-mask': 'db://internal/default_file_content/animation-mask/default.animask',
            'auto-atlas': 'db://internal/default_file_content/auto-atlas/default.pac',
            'effect-header': 'db://internal/default_file_content/effect-header/chunk',
            'label-atlas': 'db://internal/default_file_content/label-atlas/default.labelatlas',
            'terrain': 'db://internal/default_file_content/terrain/default.terrain'
        };
        const assetOptions = {
            overwrite: (_b = (_a = args.options) === null || _a === void 0 ? void 0 : _a.overwrite) !== null && _b !== void 0 ? _b : false,
            rename: (_d = (_c = args.options) === null || _c === void 0 ? void 0 : _c.rename) !== null && _d !== void 0 ? _d : false
        };
        if (type === 'folder' || type === 'typescript') {
            let content = null;
            if (type === 'typescript') {
                const currentExtName = (0, path_1.extname)(targetPath);
                if (currentExtName !== '.ts') {
                    targetPath = currentExtName ? targetPath.slice(0, -currentExtName.length) : targetPath;
                    targetPath += '.ts';
                }
                const className = (0, path_1.basename)(targetPath.slice('db://'.length), '.ts');
                content = this.generateTypescriptClassTemplate(className);
            }
            const result = await Editor.Message.request('asset-db', 'create-asset', targetPath, content, assetOptions);
            if (!result) {
                throw new Error(`Failed to create folder at ${targetPath}`);
            }
            else {
                return { reference: { id: result.uuid, type: type } };
            }
        }
        const source = presetMap[type];
        if (!source) {
            throw new Error(`Unknown asset preset type: ${type}`);
        }
        if ((0, path_1.extname)(targetPath) === '' && type !== 'folder') {
            targetPath += type == 'chunk' ? '.chunk' : (0, path_1.extname)(presetMap[type]);
        }
        const assetInfo = await Editor.Message.request('asset-db', 'copy-asset', source, targetPath, assetOptions);
        if (!assetInfo) {
            throw new Error(`Failed to create asset at ${targetPath}`);
        }
        else {
            return { reference: { id: assetInfo.uuid, type: assetInfo.type } };
        }
    }
    async assetImport(args) {
        var _a, _b, _c, _d;
        let targetPath = normalizePath(args.targetAssetPath);
        const assetOptions = {
            overwrite: (_b = (_a = args.options) === null || _a === void 0 ? void 0 : _a.overwrite) !== null && _b !== void 0 ? _b : false,
            rename: (_d = (_c = args.options) === null || _c === void 0 ? void 0 : _c.rename) !== null && _d !== void 0 ? _d : false
        };
        // Additional resolving for absolute path
        if (args.sourceFilesystemPath.startsWith('~')) {
            args.sourceFilesystemPath = path_1.default.join(os_1.default.homedir(), args.sourceFilesystemPath.slice(1));
        }
        args.sourceFilesystemPath = path_1.default.resolve(args.sourceFilesystemPath);
        args.sourceFilesystemPath = await fs_extra_1.default.realpath(args.sourceFilesystemPath);
        // Checking for existing asset at target path
        let existingAssetInfo = null;
        // If caller tries to import the same file in assets - just reimport
        if (`${Editor.Project.path}${targetPath.slice('db:/'.length)}` === args.sourceFilesystemPath) {
            await Editor.Message.request('asset-db', 'refresh-asset', targetPath);
            existingAssetInfo = await Editor.Message.request('asset-db', 'query-asset-info', targetPath);
        }
        const assetInfo = existingAssetInfo ? existingAssetInfo :
            await Editor.Message.request('asset-db', 'import-asset', args.sourceFilesystemPath, targetPath, assetOptions);
        if (!assetInfo) {
            throw new Error(`Failed to import asset to ${targetPath}`);
        }
        else {
            if (assetInfo.extends && assetInfo.importer === 'image' && args.imageType) {
                // Handle image type override
                const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
                if (meta && meta.userData) {
                    let typeToSet = args.imageType;
                    if (typeToSet === 'normal-map') {
                        typeToSet = 'normal map';
                    }
                    if (typeToSet === 'texture-cube') {
                        typeToSet = 'texture cube';
                    }
                    meta.userData.type = typeToSet;
                    await Editor.Message.request('asset-db', 'save-asset-meta', assetInfo.uuid, JSON.stringify(meta));
                }
            }
            return { reference: { id: assetInfo.uuid, type: assetInfo.type } };
        }
    }
    async assetOperate(args) {
        var _a, _b, _c, _d, _e, _f;
        const assetOptions = {
            overwrite: (_b = (_a = args.options) === null || _a === void 0 ? void 0 : _a.overwrite) !== null && _b !== void 0 ? _b : false,
            rename: (_d = (_c = args.options) === null || _c === void 0 ? void 0 : _c.rename) !== null && _d !== void 0 ? _d : false
        };
        args.targetAssetPath = normalizePath(args.targetAssetPath);
        let result = null;
        switch (args.operation) {
            case 'move':
                if (!args.targetAssetPath) {
                    throw new Error('Target is required for move');
                }
                result = await Editor.Message.request('asset-db', 'move-asset', args.reference.id, args.targetAssetPath, assetOptions);
                break;
            case 'copy':
                if (!args.targetAssetPath) {
                    throw new Error('Target is required for copy');
                }
                result = await Editor.Message.request('asset-db', 'copy-asset', args.reference.id, args.targetAssetPath, assetOptions);
                break;
            case 'delete':
                result = await Editor.Message.request('asset-db', 'delete-asset', args.reference.id);
                break;
            case 'open':
                await Editor.Message.request('asset-db', 'open-asset', args.reference.id);
                result = null;
                break;
            case 'refresh':
                await Editor.Message.request('asset-db', 'refresh-asset', args.reference.id);
                result = null;
                break;
            case 'reimport':
                await Editor.Message.request('asset-db', 'reimport-asset', args.reference.id);
                result = null;
                break;
            default:
                throw new Error(`Unknown operation: ${args.operation}`);
        }
        return { reference: { id: (_e = result === null || result === void 0 ? void 0 : result.uuid) !== null && _e !== void 0 ? _e : '', type: (_f = result === null || result === void 0 ? void 0 : result.type) !== null && _f !== void 0 ? _f : '' } };
    }
    async assetGetPreview(args) {
        const info = await Editor.Message.request('asset-db', 'query-asset-info', args.reference.id);
        if (!info) {
            throw new Error(`Asset ${args.reference.id} not found.`);
        }
        if (!info.importer) {
            throw new Error(`Asset ${args.reference.id} has no importer and cannot be previewed.`);
        }
        args.imageSize = args.imageSize || 512;
        args.jpegQuality = args.jpegQuality || 80;
        args.transparentColor = args.transparentColor || { r: 0, g: 0, b: 0 };
        let importer = info.importer;
        const supportedImporters = [
            'erp-texture-cube',
            'image',
            'sprite-frame',
            'texture',
            'fbx',
            'gltf',
            'gltf-mesh',
            'prefab',
            'material',
            'spine',
            'gltf-skeleton',
            'scene'
        ];
        if (!supportedImporters.includes(importer)) {
            throw new Error(`Asset preview not supported for asset type: ${info.type}`);
        }
        if (importer === 'fbx' || importer === 'gltf') {
            const mesh = Object.values(info.subAssets).find((sub) => sub.importer === 'gltf-mesh');
            if (!mesh) {
                throw new Error(`Asset ${args.reference.id} has no gltf-mesh sub-asset for preview.`);
            }
            args.reference.id = mesh.uuid;
            importer = 'gltf-mesh';
        }
        let sourcePath = null;
        if (importer === 'gltf-mesh' || importer === 'mesh') {
            sourcePath = (await Editor.Message.request('asset-db', 'query-asset-thumbnail', args.reference.id, "origin")).value;
        }
        else if (['erp-texture-cube', 'image', 'sprite-frame', 'texture'].includes(importer)) {
            let fileUuid = args.reference.id;
            if (args.reference.id.includes('@')) {
                fileUuid = args.reference.id.split('@')[0];
            }
            const fileInfo = await Editor.Message.request('asset-db', 'query-asset-info', fileUuid);
            if (fileInfo && fileInfo.file) {
                sourcePath = fileInfo.file;
            }
        }
        if (sourcePath && fs_extra_1.default.existsSync(sourcePath)) {
            try {
                const image = (0, sharp_1.default)(sourcePath);
                const metadata = await image.metadata();
                const requestedSize = args.imageSize || 512;
                let processed = image;
                if ((metadata.width && metadata.width > requestedSize) ||
                    (metadata.height && metadata.height > requestedSize)) {
                    processed = processed.resize(requestedSize, requestedSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
                }
                let buffer;
                if ((metadata.format === 'png' || metadata.hasAlpha)) {
                    buffer = await processed.flatten({ background: args.transparentColor })
                        .jpeg({ quality: args.jpegQuality || 80 })
                        .toBuffer();
                }
                else {
                    buffer = await processed
                        .jpeg({ quality: args.jpegQuality || 80 })
                        .toBuffer();
                }
                return { type: "image", data: buffer.toString('base64'), mimeType: "image/jpeg" };
            }
            catch (e) {
                console.error(`Failed to process image from ${sourcePath} with sharp:`, e);
            }
        }
        // Open panel to ensure renderer process is alive
        await Editor.Panel.openBeside('scene', `${package_json_1.default.name}.preview`);
        let base64Image;
        try {
            // Request generation
            base64Image = await Editor.Message.request(package_json_1.default.name, 'generate-preview', args.reference.id, args.imageSize || 512, args.imageSize || 512, (args.jpegQuality || 80) / 100);
        }
        finally {
            // Close panel
            await Editor.Panel.close(`${package_json_1.default.name}.preview`);
        }
        if (!base64Image) {
            throw new Error(`Failed to generate preview for asset ${args.reference.id}.`);
        }
        return { type: "image", data: base64Image, mimeType: "image/jpeg" };
    }
    generateTypescriptClassTemplate(className) {
        return `import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('${className}')
export class ${className} extends Component {
    start() {

    }

    update(deltaTime: number) {
        
    }
}`;
    }
}
exports.AssetTools = AssetTools;
__decorate([
    (0, decorators_1.utcpTool)('assetGetTree', 'Get the asset and subAsset hierarchy tree. Children have recursive structure.', {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema,
            assetPath: { type: 'string', description: 'Root path to start from' }
        }
    }, schemas_1.AssetTreeItemSchema, "GET", ['asset', 'file', 'tree', 'hierarchy', 'folder', 'subasset'])
], AssetTools.prototype, "assetGetTree", null);
__decorate([
    (0, decorators_1.utcpTool)('assetGetAtPath', 'Get asset reference by given local path and name, including extension. Can be used for subassets too. Returns reference to the asset.', {
        type: 'object',
        properties: {
            assetPath: { type: 'string' }
        },
        required: ['assetPath']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "GET", ['asset', 'get', 'path', 'look', 'find'])
], AssetTools.prototype, "assetGetAtPath", null);
__decorate([
    (0, decorators_1.utcpTool)('assetCreate', 'Create empty asset or folder of given type. Automatically handles folders creation along the path. Returns reference to the new asset.', {
        type: 'object',
        properties: {
            assetPath: { type: 'string' },
            preset: {
                type: 'string',
                enum: [
                    'folder',
                    'material',
                    'effect',
                    'scene',
                    'prefab',
                    'typescript',
                    'animation-clip',
                    'render-texture',
                    'physics-material',
                    'animation-graph',
                    'animation-graph-variant',
                    'animation-mask',
                    'auto-atlas',
                    'effect-header',
                    'label-atlas',
                    'terrain'
                ],
                description: 'Preset type for the new asset'
            },
            options: { type: 'object', properties: { overwrite: { type: 'boolean' }, rename: { type: 'boolean' } }, description: 'Additional options for the operation', nullable: true },
        },
        required: ['assetPath', 'preset']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['asset', 'create', 'new', 'preset', 'folder', 'typescript'])
], AssetTools.prototype, "assetCreate", null);
__decorate([
    (0, decorators_1.utcpTool)('assetImport', 'Import an external file as an asset into the project. Path must end with the extension. Returns reference to the new asset.', {
        type: 'object',
        properties: {
            sourceFilesystemPath: { type: 'string', description: 'Source filesystem path of the file to import' },
            targetAssetPath: { type: 'string', description: 'Target path in the asset database' },
            imageType: { type: 'string', enum: ['raw', 'texture', 'normal-map', 'sprite-frame', 'texture-cube'], description: 'For image files, specify how to import them' },
            options: { type: 'object', properties: { overwrite: { type: 'boolean' }, rename: { type: 'boolean' } }, description: 'Additional options for the operation' },
        },
        required: ['sourceFilesystemPath', 'targetAssetPath']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['asset', 'import', 'file', 'external', 'image'])
], AssetTools.prototype, "assetImport", null);
__decorate([
    (0, decorators_1.utcpTool)('assetOperate', 'Perform operations on assets (move, copy, delete, open). Returns reference to the affected asset (for delete/open returns the source asset reference).', {
        type: 'object',
        properties: {
            operation: { type: 'string', enum: ['move', 'copy', 'delete', 'open', 'refresh', 'reimport'] },
            reference: schemas_1.InstanceReferenceSchema,
            targetAssetPath: { type: 'string', description: 'Target path (for move/copy/import)' },
            options: { type: 'object', properties: { overwrite: { type: 'boolean' }, rename: { type: 'boolean' } }, description: 'Additional options for the operation', nullable: true },
        },
        required: ['operation', 'reference']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['asset', 'operate', 'move', 'copy', 'delete', 'open', 'refresh', 'reimport'])
], AssetTools.prototype, "assetOperate", null);
__decorate([
    (0, decorators_1.utcpTool)('assetGetPreview', 'Returns preview image of the asset (Prefab, Image, Model or Material is supported). IMPORTANT: To visualize the image, you must return the result of this function DIRECTLY as the final value of your code, do NOT wrap it in an object.', {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema,
            imageSize: { type: 'number', description: 'Size of the preview image (square)', default: 512 },
            jpegQuality: { type: 'integer', description: 'JPEG Quality of the preview image', minimum: 40, maximum: 100, default: 80 },
            transparentColor: { type: 'object', properties: { r: { type: 'integer', minimum: 0, maximum: 255 }, g: { type: 'integer', minimum: 0, maximum: 255 }, b: { type: 'integer', minimum: 0, maximum: 255 } }, required: ['r', 'g', 'b'], description: 'Background color for transparent images in RGB format' }
        },
        required: ['reference']
    }, schemas_1.Base64ImageSchema, "GET", ['asset', 'preview', 'screenshot'])
], AssetTools.prototype, "assetGetPreview", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvdXRjcC90b29scy9hc3NldC10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5RUFBZ0Q7QUFDaEQsa0RBQTBCO0FBQzFCLHdEQUEwQjtBQUMxQiw4Q0FBeUM7QUFFekMsd0NBQTBMO0FBQzFMLDZDQUErQztBQUMvQyw0Q0FBb0I7QUFFcEIsU0FBUyxhQUFhLENBQUMsQ0FBVTtJQUM3QixJQUFJLENBQUMsQ0FBQztRQUFFLE9BQU8sYUFBYSxDQUFDO0lBQzdCLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBRXhDLHdCQUF3QjtJQUN4QixJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUMzQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQzdFLENBQUM7SUFFRCx1QkFBdUI7SUFDdkIsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDdkIsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUVELHNCQUFzQjtJQUN0QixJQUFJLElBQUksS0FBSyxFQUFFLElBQUksSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ25DLE9BQU8sYUFBYSxDQUFDO0lBQ3pCLENBQUM7SUFFRCwwQkFBMEI7SUFDMUIsSUFBSSxJQUFJLENBQUMsVUFBVSxD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RSxFQUFFLEVBQUU7WUFDMUgsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxXQUFXLEVBQUUsdURBQXVELEVBQUU7U0FDOVM7UUFDRCxRQUFRLEVBQUUsQ0FBQyxXQUFXLENBQUM7S0FDMUIsRUFDRCwyQkFBaUIsRUFBRSxLQUFLLEVBQUUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUMvRDtpREF5R0EiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vLi4vLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBzaGFycCBmcm9tICdzaGFycCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IHsgdXRjcFRvb2wgfSBmcm9tICcuLi9kZWNvcmF0b3JzJztcbmltcG9ydCB7IEFzc2V0SW5mbywgQXNzZXRPcGVyYXRpb25PcHRpb24gfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvYXNzZXQtZGIvQHR5cGVzL3B1YmxpYyc7XG5pbXBvcnQgeyBBc3NldFRyZWVJdGVtU2NoZW1hLCBJQXNzZXRUcmVlSXRlbSwgQmFzZTY0SW1hZ2VTY2hlbWEsIElCYXNlNjRJbWFnZSwgU3VjY2Vzc0luZGljYXRvclNjaGVtYSwgSVN1Y2Nlc3NJbmRpY2F0b3IsIEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLCBJSW5zdGFuY2VSZWZlcmVuY2UgfSBmcm9tICcuLi9zY2hlbWFzJztcbmltcG9ydCBwYXRoLCB7IGJhc2VuYW1lLCBleHRuYW1lIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuXG5mdW5jdGlvbiBub3JtYWxpemVQYXRoKHA/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICghcCkgcmV0dXJuICdkYjovL2Fzc2V0cyc7XG4gICAgbGV0IHBhdGggPSBwLnJlcGxhY2UoL1xcXFwvZywgJy8nKS50cmltKCk7XG5cbiAgICAvLyBIYW5kbGUgZGI6Ly8gcHJvdG9jb2xcbiAgICBpZiAocGF0aC5zdGFydHNXaXRoKCdkYjovLycpKSB7XG4gICAgICAgIHJldHVybiBwYXRoLmVuZHNXaXRoKCcvJykgJiYgcGF0aCAhPT0gJ2RiOi8vJyA/IHBhdGguc2xpY2UoMCwgLTEpIDogcGF0aDtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgbGVhZGluZyBzbGFzaFxuICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgICBwYXRoID0gcGF0aC5zbGljZSgxKTtcbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgcm9vdCBhbGlhc2VzXG4gICAgaWYgKHBhdGggPT09ICcnIHx8IHBhdGggPT09ICdhc3NldHMnKSB7XG4gICAgICAgIHJldHVybiAnZGI6Ly9hc3NldHMnO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSAnYXNzZXRzLycgcHJlZml4XG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnYXNzZXRzLycpKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9ICdkYjovLycgKyBwYXRoO1xuICAgICAgICByZXR1cm4gcmVzdWx0LmVuZHNXaXRoKCcvJykgPyByZXN1bHQuc2xpY2UoMCwgLTEpIDogcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIFRyZWF0IGFzIHJlbGF0aXZlIHBhdGggdW5kZXIgYXNzZXRzXG4gICAgaWYgKHBhdGguZW5kc1dpdGgoJy8nKSkge1xuICAgICAgICBwYXRoID0gcGF0aC5zbGljZSgwLCAtMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGBkYjovL2Fzc2V0cy8ke3BhdGh9YDtcbn1cblxuZXhwb3J0IGNsYXNzIEFzc2V0VG9vbHMge1xuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnYXNzZXRHZXRUcmVlJyxcbiAgICAgICAgJ0dldCB0aGUgYXNzZXQgYW5kIHN1YkFzc2V0IGhpZXJhcmNoeSB0cmVlLiBDaGlsZHJlbiBoYXZlIHJlY3Vyc2l2ZSBzdHJ1Y3R1cmUuJyxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSxcbiAgICAgICAgICAgICAgICBhc3NldFBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnUm9vdCBwYXRoIHRvIHN0YXJ0IGZyb20nIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgQXNzZXRUcmVlSXRlbVNjaGVtYSwgXCJHRVRcIiwgWydhc3NldCcsICdmaWxlJywgJ3RyZWUnLCAnaGllcmFyY2h5JywgJ2ZvbGRlcicsICdzdWJhc3NldCddXG4gICAgKVxuICAgIGFzeW5jIGFzc2V0R2V0VHJlZShhcmdzOiB7IHJlZmVyZW5jZT86IElJbnN0YW5jZVJlZmVyZW5jZSwgYXNzZXRQYXRoPzogc3RyaW5nIH0pOiBQcm9taXNlPElBc3NldFRyZWVJdGVtPiB7XG4gICAgICAgIGlmIChhcmdzLnJlZmVyZW5jZSkge1xuICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhcmdzLnJlZmVyZW5jZS5pZCk7XG4gICAgICAgICAgICBpZiAoIWluZm8pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2V0IHdpdGggVVVJRCAke2FyZ3MucmVmZXJlbmNlLmlkfSBub3QgZm91bmQuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhcmdzLmFzc2V0UGF0aCA9IGluZm8udXJsO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJvb3RQYXRoID0gbm9ybWFsaXplUGF0aChhcmdzLmFzc2V0UGF0aCk7XG5cbiAgICAgICAgY29uc3QgcGF0dGVybiA9IGAke3Jvb3RQYXRofS8qKmA7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KTtcbiAgICAgICAgY29uc3Qgcm9vdFV1aWQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11dWlkJywgcm9vdFBhdGgpO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0c01hcCA9IG5ldyBNYXA8c3RyaW5nLCBJQXNzZXRUcmVlSXRlbT4oKTtcblxuICAgICAgICAvLyBDcmVhdGUgUm9vdCBOb2RlIGZpcnN0XG4gICAgICAgIGNvbnN0IHJvb3ROYW1lID0gcm9vdFBhdGguc3BsaXQoJy8nKS5wb3AoKSB8fCAnYXNzZXRzJztcbiAgICAgICAgY29uc3Qgcm9vdE5vZGU6IElBc3NldFRyZWVJdGVtID0ge1xuICAgICAgICAgICAgZmlsZXN5c3RlbVBhdGg6IEVkaXRvci5Qcm9qZWN0LnBhdGggKyAnLycgKyByb290UGF0aC5yZXBsYWNlKCdkYjovLycsICcnKSxcbiAgICAgICAgICAgIHJlZmVyZW5jZTogeyBpZDogcm9vdFV1aWQgfHwgJ3Jvb3QnLCB0eXBlOiAnZm9sZGVyJyB9LFxuICAgICAgICAgICAgbmFtZTogcm9vdE5hbWUsXG4gICAgICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgICAgfTtcbiAgICAgICAgYXNzZXRzTWFwLnNldChyb290UGF0aCwgcm9vdE5vZGUpO1xuXG4gICAgICAgIC8vIEZpcnN0IHBhc3M6IE1hcCBhc3NldHNcbiAgICAgICAgYXNzZXRzLmZvckVhY2goKGFzc2V0OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChhc3NldC51cmwgPT09IHJvb3RQYXRoKSByZXR1cm47IC8vIFNraXAgcm9vdCwgYWxyZWFkeSBjcmVhdGVkXG5cbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBhc3NldC5pc0RpcmVjdG9yeSA/ICdmb2xkZXInIDogYXNzZXQudHlwZTtcblxuICAgICAgICAgICAgY29uc3QgdHJlZUl0ZW06IElBc3NldFRyZWVJdGVtID0ge1xuICAgICAgICAgICAgICAgIHJlZmVyZW5jZTogeyBpZDogYXNzZXQudXVpZCwgdHlwZTogdHlwZSB9LFxuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IFtdXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBhc3NldHNNYXAuc2V0KGFzc2V0LnVybCwgdHJlZUl0ZW0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZWNvbmQgcGFzczogQnVpbGQgaGllcmFyY2h5XG4gICAgICAgIGFzc2V0cy5mb3JFYWNoKChhc3NldDogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoYXNzZXQudXJsID09PSByb290UGF0aCkgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCB0cmVlSXRlbSA9IGFzc2V0c01hcC5nZXQoYXNzZXQudXJsKTtcbiAgICAgICAgICAgIGlmICghdHJlZUl0ZW0pIHJldHVybjtcblxuICAgICAgICAgICAgY29uc3QgcGFyZW50VXJsID0gYXNzZXQudXJsLnN1YnN0cmluZygwLCBhc3NldC51cmwubGFzdEluZGV4T2YoJy8nKSk7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnRJdGVtID0gYXNzZXRzTWFwLmdldChwYXJlbnRVcmwpO1xuXG4gICAgICAgICAgICBpZiAocGFyZW50SXRlbSkge1xuICAgICAgICAgICAgICAgIHBhcmVudEl0ZW0uY2hpbGRyZW4ucHVzaCh0cmVlSXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByb290Tm9kZTtcbiAgICB9XG5cbiAgICBAdXRjcFRvb2woXG4gICAgICAgICdhc3NldEdldEF0UGF0aCcsXG4gICAgICAgICdHZXQgYXNzZXQgcmVmZXJlbmNlIGJ5IGdpdmVuIGxvY2FsIHBhdGggYW5kIG5hbWUsIGluY2x1ZGluZyBleHRlbnNpb24uIENhbiBiZSB1c2VkIGZvciBzdWJhc3NldHMgdG9vLiBSZXR1cm5zIHJlZmVyZW5jZSB0byB0aGUgYXNzZXQuJyxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgYXNzZXRQYXRoOiB7IHR5cGU6ICdzdHJpbmcnIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZDogWydhc3NldFBhdGgnXVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEgfSwgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJ10gfSwgXCJHRVRcIiwgWydhc3NldCcsICdnZXQnLCAncGF0aCcsICdsb29rJywgJ2ZpbmQnXVxuICAgIClcbiAgICBhc3luYyBhc3NldEdldEF0UGF0aChhcmdzOiB7IGFzc2V0UGF0aDogc3RyaW5nIH0pOiBQcm9taXNlPHsgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UgfT4ge1xuICAgICAgICBsZXQgdGFyZ2V0UGF0aCA9IG5vcm1hbGl6ZVBhdGgoYXJncy5hc3NldFBhdGgpO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKGBMb29raW5nIGZvciBhc3NldCBhdCBwYXRoOiAke3RhcmdldFBhdGh9YCk7XG5cbiAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHRhcmdldFBhdGgpO1xuICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NldCBub3QgZm91bmQgYXQgcGF0aDogJHt0YXJnZXRQYXRofWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHsgcmVmZXJlbmNlOiB7IGlkOiBhc3NldEluZm8udXVpZCwgdHlwZTogYXNzZXRJbmZvLnR5cGUgfSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnYXNzZXRDcmVhdGUnLFxuICAgICAgICAnQ3JlYXRlIGVtcHR5IGFzc2V0IG9yIGZvbGRlciBvZiBnaXZlbiB0eXBlLiBBdXRvbWF0aWNhbGx5IGhhbmRsZXMgZm9sZGVycyBjcmVhdGlvbiBhbG9uZyB0aGUgcGF0aC4gUmV0dXJucyByZWZlcmVuY2UgdG8gdGhlIG5ldyBhc3NldC4nLFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBhc3NldFBhdGg6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICBwcmVzZXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgIGVudW06IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICdmb2xkZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ21hdGVyaWFsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdlZmZlY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NjZW5lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdwcmVmYWInLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3R5cGVzY3JpcHQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2FuaW1hdGlvbi1jbGlwJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdyZW5kZXItdGV4dHVyZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAncGh5c2ljcy1tYXRlcmlhbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnYW5pbWF0aW9uLWdyYXBoJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdhbmltYXRpb24tZ3JhcGgtdmFyaWFudCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnYW5pbWF0aW9uLW1hc2snLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2F1dG8tYXRsYXMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2VmZmVjdC1oZWFkZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2xhYmVsLWF0bGFzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICd0ZXJyYWluJ1xuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZXNldCB0eXBlIGZvciB0aGUgbmV3IGFzc2V0J1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgb3B0aW9uczogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyBvdmVyd3JpdGU6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sIHJlbmFtZTogeyB0eXBlOiAnYm9vbGVhbicgfSB9LCBkZXNjcmlwdGlvbjogJ0FkZGl0aW9uYWwgb3B0aW9ucyBmb3IgdGhlIG9wZXJhdGlvbicsIG51bGxhYmxlOiB0cnVlIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYXNzZXRQYXRoJywgJ3ByZXNldCddXG4gICAgICAgIH0sXG4gICAgICAgIHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSB9LCByZXF1aXJlZDogWydyZWZlcmVuY2UnXSB9LCBcIlBPU1RcIiwgWydhc3NldCcsICdjcmVhdGUnLCAnbmV3JywgJ3ByZXNldCcsICdmb2xkZXInLCAndHlwZXNjcmlwdCddXG4gICAgKVxuICAgIGFzeW5jIGFzc2V0Q3JlYXRlKGFyZ3M6IHsgYXNzZXRQYXRoOiBzdHJpbmc7IHByZXNldDogc3RyaW5nOyBvcHRpb25zPzogeyBvdmVyd3JpdGU/OiBib29sZWFuLCByZW5hbWU/OiBib29sZWFuIH0gfSk6IFByb21pc2U8eyByZWZlcmVuY2U6IElJbnN0YW5jZVJlZmVyZW5jZSB9PiB7XG4gICAgICAgIGxldCB0YXJnZXRQYXRoID0gbm9ybWFsaXplUGF0aChhcmdzLmFzc2V0UGF0aCk7XG5cbiAgICAgICAgLy8gTWFwICdwcmVzZXQnIGZyb20gc2NoZW1hIHRvICd0eXBlJyBleHBlY3RlZCBieSBmdW5jdGlvblxuICAgICAgICBjb25zdCB0eXBlID0gYXJncy5wcmVzZXQ7XG4gICAgICAgIGNvbnN0IHByZXNldE1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgICdtYXRlcmlhbCc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L21hdGVyaWFsL2RlZmF1bHQubXRsJyxcbiAgICAgICAgICAgICdlZmZlY3QnOiAnZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X2ZpbGVfY29udGVudC9lZmZlY3QvZGVmYXVsdC5lZmZlY3QnLFxuICAgICAgICAgICAgJ3NjZW5lJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvc2NlbmUvZGVmYXVsdC5zY2VuZScsXG4gICAgICAgICAgICAncHJlZmFiJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvcHJlZmFiL2RlZmF1bHQucHJlZmFiJyxcbiAgICAgICAgICAgICdhbmltYXRpb24tY2xpcCc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L2FuaW1hdGlvbi1jbGlwL2RlZmF1bHQuYW5pbScsXG4gICAgICAgICAgICAncmVuZGVyLXRleHR1cmUnOiAnZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X2ZpbGVfY29udGVudC9yZW5kZXItdGV4dHVyZS9kZWZhdWx0LnJ0JyxcbiAgICAgICAgICAgICdwaHlzaWNzLW1hdGVyaWFsJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvcGh5c2ljcy1tYXRlcmlhbC9kZWZhdWx0LnBtdGwnLFxuICAgICAgICAgICAgJ2FuaW1hdGlvbi1ncmFwaCc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L2FuaW1hdGlvbi1ncmFwaC9kZWZhdWx0LmFuaW1ncmFwaCcsXG4gICAgICAgICAgICAnYW5pbWF0aW9uLWdyYXBoLXZhcmlhbnQnOiAnZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X2ZpbGVfY29udGVudC9hbmltYXRpb24tZ3JhcGgtdmFyaWFudC9kZWZhdWx0LmFuaW1ncmFwaHZhcmknLFxuICAgICAgICAgICAgJ2FuaW1hdGlvbi1tYXNrJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvYW5pbWF0aW9uLW1hc2svZGVmYXVsdC5hbmltYXNrJyxcbiAgICAgICAgICAgICdhdXRvLWF0bGFzJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvYXV0by1hdGxhcy9kZWZhdWx0LnBhYycsXG4gICAgICAgICAgICAnZWZmZWN0LWhlYWRlcic6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L2VmZmVjdC1oZWFkZXIvY2h1bmsnLFxuICAgICAgICAgICAgJ2xhYmVsLWF0bGFzJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvbGFiZWwtYXRsYXMvZGVmYXVsdC5sYWJlbGF0bGFzJyxcbiAgICAgICAgICAgICd0ZXJyYWluJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvdGVycmFpbi9kZWZhdWx0LnRlcnJhaW4nXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXNzZXRPcHRpb25zOiBBc3NldE9wZXJhdGlvbk9wdGlvbiA9IHtcbiAgICAgICAgICAgIG92ZXJ3cml0ZTogYXJncy5vcHRpb25zPy5vdmVyd3JpdGUgPz8gZmFsc2UsXG4gICAgICAgICAgICByZW5hbWU6IGFyZ3Mub3B0aW9ucz8ucmVuYW1lID8/IGZhbHNlXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHR5cGUgPT09ICdmb2xkZXInIHx8IHR5cGUgPT09ICd0eXBlc2NyaXB0Jykge1xuICAgICAgICAgICAgbGV0IGNvbnRlbnQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICd0eXBlc2NyaXB0Jykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRFeHROYW1lID0gZXh0bmFtZSh0YXJnZXRQYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudEV4dE5hbWUgIT09ICcudHMnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFBhdGggPSBjdXJyZW50RXh0TmFtZSA/IHRhcmdldFBhdGguc2xpY2UoMCwgLWN1cnJlbnRFeHROYW1lLmxlbmd0aCkgOiB0YXJnZXRQYXRoO1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRQYXRoICs9ICcudHMnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBjbGFzc05hbWUgPSBiYXNlbmFtZSh0YXJnZXRQYXRoLnNsaWNlKCdkYjovLycubGVuZ3RoKSwgJy50cycpO1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSB0aGlzLmdlbmVyYXRlVHlwZXNjcmlwdENsYXNzVGVtcGxhdGUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgdGFyZ2V0UGF0aCwgY29udGVudCwgYXNzZXRPcHRpb25zKTtcbiAgICAgICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIGZvbGRlciBhdCAke3RhcmdldFBhdGh9YCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHJlZmVyZW5jZTogeyBpZDogcmVzdWx0LnV1aWQsIHR5cGU6IHR5cGUgfSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc291cmNlID0gcHJlc2V0TWFwW3R5cGVdO1xuICAgICAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFzc2V0IHByZXNldCB0eXBlOiAke3R5cGV9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXh0bmFtZSh0YXJnZXRQYXRoKSA9PT0gJycgJiYgdHlwZSAhPT0gJ2ZvbGRlcicpIHtcbiAgICAgICAgICAgIHRhcmdldFBhdGggKz0gdHlwZSA9PSAnY2h1bmsnID8gJy5jaHVuaycgOiBleHRuYW1lKHByZXNldE1hcFt0eXBlXSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjb3B5LWFzc2V0Jywgc291cmNlLCB0YXJnZXRQYXRoLCBhc3NldE9wdGlvbnMpO1xuICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIGFzc2V0IGF0ICR7dGFyZ2V0UGF0aH1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB7IHJlZmVyZW5jZTogeyBpZDogYXNzZXRJbmZvLnV1aWQsIHR5cGU6IGFzc2V0SW5mby50eXBlIH0gfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIEB1dGNwVG9vbChcbiAgICAgICAgJ2Fzc2V0SW1wb3J0JyxcbiAgICAgICAgJ0ltcG9ydCBhbiBleHRlcm5hbCBmaWxlIGFzIGFuIGFzc2V0IGludG8gdGhlIHByb2plY3QuIFBhdGggbXVzdCBlbmQgd2l0aCB0aGUgZXh0ZW5zaW9uLiBSZXR1cm5zIHJlZmVyZW5jZSB0byB0aGUgbmV3IGFzc2V0LicsXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHNvdXJjZUZpbGVzeXN0ZW1QYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1NvdXJjZSBmaWxlc3lzdGVtIHBhdGggb2YgdGhlIGZpbGUgdG8gaW1wb3J0JyB9LFxuICAgICAgICAgICAgICAgIHRhcmdldEFzc2V0UGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgcGF0aCBpbiB0aGUgYXNzZXQgZGF0YWJhc2UnIH0sXG4gICAgICAgICAgICAgICAgaW1hZ2VUeXBlOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ3JhdycsICd0ZXh0dXJlJywgJ25vcm1hbC1tYXAnLCAnc3ByaXRlLWZyYW1lJywgJ3RleHR1cmUtY3ViZSddLCBkZXNjcmlwdGlvbjogJ0ZvciBpbWFnZSBmaWxlcywgc3BlY2lmeSBob3cgdG8gaW1wb3J0IHRoZW0nIH0sXG4gICAgICAgICAgICAgICAgb3B0aW9uczogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyBvdmVyd3JpdGU6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sIHJlbmFtZTogeyB0eXBlOiAnYm9vbGVhbicgfSB9LCBkZXNjcmlwdGlvbjogJ0FkZGl0aW9uYWwgb3B0aW9ucyBmb3IgdGhlIG9wZXJhdGlvbicgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZDogWydzb3VyY2VGaWxlc3lzdGVtUGF0aCcsICd0YXJnZXRBc3NldFBhdGgnXVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEgfSwgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJ10gfSwgXCJQT1NUXCIsIFsnYXNzZXQnLCAnaW1wb3J0JywgJ2ZpbGUnLCAnZXh0ZXJuYWwnLCAnaW1hZ2UnXVxuICAgIClcbiAgICBhc3luYyBhc3NldEltcG9ydChhcmdzOiB7IHNvdXJjZUZpbGVzeXN0ZW1QYXRoOiBzdHJpbmcsIHRhcmdldEFzc2V0UGF0aDogc3RyaW5nLCBpbWFnZVR5cGU/OiAncmF3JyB8ICd0ZXh0dXJlJyB8ICdub3JtYWwtbWFwJyB8ICdzcHJpdGUtZnJhbWUnIHwgJ3RleHR1cmUtY3ViZScsIG9wdGlvbnM/OiB7IG92ZXJ3cml0ZT86IGJvb2xlYW4sIHJlbmFtZT86IGJvb2xlYW4gfSB9KTogUHJvbWlzZTx7IHJlZmVyZW5jZTogSUluc3RhbmNlUmVmZXJlbmNlIH0+IHtcbiAgICAgICAgbGV0IHRhcmdldFBhdGggPSBub3JtYWxpemVQYXRoKGFyZ3MudGFyZ2V0QXNzZXRQYXRoKTtcblxuICAgICAgICBjb25zdCBhc3NldE9wdGlvbnM6IEFzc2V0T3BlcmF0aW9uT3B0aW9uID0ge1xuICAgICAgICAgICAgb3ZlcndyaXRlOiBhcmdzLm9wdGlvbnM/Lm92ZXJ3cml0ZSA/PyBmYWxzZSxcbiAgICAgICAgICAgIHJlbmFtZTogYXJncy5vcHRpb25zPy5yZW5hbWUgPz8gZmFsc2VcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGRpdGlvbmFsIHJlc29sdmluZyBmb3IgYWJzb2x1dGUgcGF0aFxuICAgICAgICBpZiAoYXJncy5zb3VyY2VGaWxlc3lzdGVtUGF0aC5zdGFydHNXaXRoKCd+JykpIHtcbiAgICAgICAgICAgIGFyZ3Muc291cmNlRmlsZXN5c3RlbVBhdGggPSBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCBhcmdzLnNvdXJjZUZpbGVzeXN0ZW1QYXRoLnNsaWNlKDEpKTtcbiAgICAgICAgfVxuICAgICAgICBhcmdzLnNvdXJjZUZpbGVzeXN0ZW1QYXRoID0gcGF0aC5yZXNvbHZlKGFyZ3Muc291cmNlRmlsZXN5c3RlbVBhdGgpO1xuICAgICAgICBhcmdzLnNvdXJjZUZpbGVzeXN0ZW1QYXRoID0gYXdhaXQgZnMucmVhbHBhdGgoYXJncy5zb3VyY2VGaWxlc3lzdGVtUGF0aCk7XG5cbiAgICAgICAgLy8gQ2hlY2tpbmcgZm9yIGV4aXN0aW5nIGFzc2V0IGF0IHRhcmdldCBwYXRoXG4gICAgICAgIGxldCBleGlzdGluZ0Fzc2V0SW5mbzogQXNzZXRJbmZvIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIC8vIElmIGNhbGxlciB0cmllcyB0byBpbXBvcnQgdGhlIHNhbWUgZmlsZSBpbiBhc3NldHMgLSBqdXN0IHJlaW1wb3J0XG4gICAgICAgIGlmIChgJHtFZGl0b3IuUHJvamVjdC5wYXRofSR7dGFyZ2V0UGF0aC5zbGljZSgnZGI6LycubGVuZ3RoKX1gID09PSBhcmdzLnNvdXJjZUZpbGVzeXN0ZW1QYXRoKSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JywgdGFyZ2V0UGF0aCk7XG4gICAgICAgICAgICBleGlzdGluZ0Fzc2V0SW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB0YXJnZXRQYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGV4aXN0aW5nQXNzZXRJbmZvID8gZXhpc3RpbmdBc3NldEluZm8gOlxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnaW1wb3J0LWFzc2V0JywgYXJncy5zb3VyY2VGaWxlc3lzdGVtUGF0aCwgdGFyZ2V0UGF0aCwgYXNzZXRPcHRpb25zKTtcbiAgICAgICAgaWYgKCFhc3NldEluZm8pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGltcG9ydCBhc3NldCB0byAke3RhcmdldFBhdGh9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoYXNzZXRJbmZvLmV4dGVuZHMgJiYgYXNzZXRJbmZvLmltcG9ydGVyID09PSAnaW1hZ2UnICYmIGFyZ3MuaW1hZ2VUeXBlKSB7XG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIGltYWdlIHR5cGUgb3ZlcnJpZGVcbiAgICAgICAgICAgICAgICBjb25zdCBtZXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtbWV0YScsIGFzc2V0SW5mby51dWlkKTtcbiAgICAgICAgICAgICAgICBpZiAobWV0YSAmJiBtZXRhLnVzZXJEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB0eXBlVG9TZXQ6IHN0cmluZyA9IGFyZ3MuaW1hZ2VUeXBlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZVRvU2V0ID09PSAnbm9ybWFsLW1hcCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVUb1NldCA9ICdub3JtYWwgbWFwJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZVRvU2V0ID09PSAndGV4dHVyZS1jdWJlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZVRvU2V0ID0gJ3RleHR1cmUgY3ViZSc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbWV0YS51c2VyRGF0YS50eXBlID0gdHlwZVRvU2V0O1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0LW1ldGEnLCBhc3NldEluZm8udXVpZCwgSlNPTi5zdHJpbmdpZnkobWV0YSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgcmVmZXJlbmNlOiB7IGlkOiBhc3NldEluZm8udXVpZCwgdHlwZTogYXNzZXRJbmZvLnR5cGUgfSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnYXNzZXRPcGVyYXRlJyxcbiAgICAgICAgJ1BlcmZvcm0gb3BlcmF0aW9ucyBvbiBhc3NldHMgKG1vdmUsIGNvcHksIGRlbGV0ZSwgb3BlbikuIFJldHVybnMgcmVmZXJlbmNlIHRvIHRoZSBhZmZlY3RlZCBhc3NldCAoZm9yIGRlbGV0ZS9vcGVuIHJldHVybnMgdGhlIHNvdXJjZSBhc3NldCByZWZlcmVuY2UpLicsXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIG9wZXJhdGlvbjogeyB0eXBlOiAnc3RyaW5nJywgZW51bTogWydtb3ZlJywgJ2NvcHknLCAnZGVsZXRlJywgJ29wZW4nLCAncmVmcmVzaCcsICdyZWltcG9ydCddIH0sXG4gICAgICAgICAgICAgICAgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSxcbiAgICAgICAgICAgICAgICB0YXJnZXRBc3NldFBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IHBhdGggKGZvciBtb3ZlL2NvcHkvaW1wb3J0KScgfSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IG92ZXJ3cml0ZTogeyB0eXBlOiAnYm9vbGVhbicgfSwgcmVuYW1lOiB7IHR5cGU6ICdib29sZWFuJyB9IH0sIGRlc2NyaXB0aW9uOiAnQWRkaXRpb25hbCBvcHRpb25zIGZvciB0aGUgb3BlcmF0aW9uJywgbnVsbGFibGU6IHRydWUgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZDogWydvcGVyYXRpb24nLCAncmVmZXJlbmNlJ11cbiAgICAgICAgfSxcbiAgICAgICAgeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyByZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hIH0sIHJlcXVpcmVkOiBbJ3JlZmVyZW5jZSddIH0sIFwiUE9TVFwiLCBbJ2Fzc2V0JywgJ29wZXJhdGUnLCAnbW92ZScsICdjb3B5JywgJ2RlbGV0ZScsICdvcGVuJywgJ3JlZnJlc2gnLCAncmVpbXBvcnQnXVxuICAgIClcbiAgICBhc3luYyBhc3NldE9wZXJhdGUoYXJnczogeyBvcGVyYXRpb246IHN0cmluZywgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UsIHRhcmdldEFzc2V0UGF0aD86IHN0cmluZywgb3B0aW9ucz86IHsgb3ZlcndyaXRlPzogYm9vbGVhbiwgcmVuYW1lPzogYm9vbGVhbiB9IH0pOiBQcm9taXNlPHsgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UgfT4ge1xuICAgICAgICBjb25zdCBhc3NldE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBvdmVyd3JpdGU6IGFyZ3Mub3B0aW9ucz8ub3ZlcndyaXRlID8/IGZhbHNlLFxuICAgICAgICAgICAgcmVuYW1lOiBhcmdzLm9wdGlvbnM/LnJlbmFtZSA/PyBmYWxzZVxuICAgICAgICB9O1xuXG4gICAgICAgIGFyZ3MudGFyZ2V0QXNzZXRQYXRoID0gbm9ybWFsaXplUGF0aChhcmdzLnRhcmdldEFzc2V0UGF0aCk7XG4gICAgICAgIGxldCByZXN1bHQ6IEFzc2V0SW5mbyB8IG51bGwgPSBudWxsO1xuXG4gICAgICAgIHN3aXRjaCAoYXJncy5vcGVyYXRpb24pIHtcbiAgICAgICAgICAgIGNhc2UgJ21vdmUnOlxuICAgICAgICAgICAgICAgIGlmICghYXJncy50YXJnZXRBc3NldFBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUYXJnZXQgaXMgcmVxdWlyZWQgZm9yIG1vdmUnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdtb3ZlLWFzc2V0JywgYXJncy5yZWZlcmVuY2UuaWQsIGFyZ3MudGFyZ2V0QXNzZXRQYXRoLCBhc3NldE9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdjb3B5JzpcbiAgICAgICAgICAgICAgICBpZiAoIWFyZ3MudGFyZ2V0QXNzZXRQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGFyZ2V0IGlzIHJlcXVpcmVkIGZvciBjb3B5Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NvcHktYXNzZXQnLCBhcmdzLnJlZmVyZW5jZS5pZCwgYXJncy50YXJnZXRBc3NldFBhdGgsIGFzc2V0T3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZGVsZXRlLWFzc2V0JywgYXJncy5yZWZlcmVuY2UuaWQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdvcGVuJzpcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdvcGVuLWFzc2V0JywgYXJncy5yZWZlcmVuY2UuaWQpO1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG51bGw7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ3JlZnJlc2gnOlxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnLCBhcmdzLnJlZmVyZW5jZS5pZCk7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3JlaW1wb3J0JzpcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFyZ3MucmVmZXJlbmNlLmlkKTtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBudWxsO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gb3BlcmF0aW9uOiAke2FyZ3Mub3BlcmF0aW9ufWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgcmVmZXJlbmNlOiB7IGlkOiByZXN1bHQ/LnV1aWQgPz8gJycsIHR5cGU6IHJlc3VsdD8udHlwZSA/PyAnJyB9IH07XG4gICAgfVxuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnYXNzZXRHZXRQcmV2aWV3JyxcbiAgICAgICAgJ1JldHVybnMgcHJldmlldyBpbWFnZSBvZiB0aGUgYXNzZXQgKFByZWZhYiwgSW1hZ2UsIE1vZGVsIG9yIE1hdGVyaWFsIGlzIHN1cHBvcnRlZCkuIElNUE9SVEFOVDogVG8gdmlzdWFsaXplIHRoZSBpbWFnZSwgeW91IG11c3QgcmV0dXJuIHRoZSByZXN1bHQgb2YgdGhpcyBmdW5jdGlvbiBESVJFQ1RMWSBhcyB0aGUgZmluYWwgdmFsdWUgb2YgeW91ciBjb2RlLCBkbyBOT1Qgd3JhcCBpdCBpbiBhbiBvYmplY3QuJyxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSxcbiAgICAgICAgICAgICAgICBpbWFnZVNpemU6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnU2l6ZSBvZiB0aGUgcHJldmlldyBpbWFnZSAoc3F1YXJlKScsIGRlZmF1bHQ6IDUxMiB9LFxuICAgICAgICAgICAgICAgIGpwZWdRdWFsaXR5OiB7IHR5cGU6ICdpbnRlZ2VyJywgZGVzY3JpcHRpb246ICdKUEVHIFF1YWxpdHkgb2YgdGhlIHByZXZpZXcgaW1hZ2UnLCBtaW5pbXVtOiA0MCwgbWF4aW11bTogMTAwLCBkZWZhdWx0OiA4MCB9LFxuICAgICAgICAgICAgICAgIHRyYW5zcGFyZW50Q29sb3I6IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgcjogeyB0eXBlOiAnaW50ZWdlcicsIG1pbmltdW06IDAsIG1heGltdW06IDI1NSB9LCBnOiB7IHR5cGU6ICdpbnRlZ2VyJywgbWluaW11bTogMCwgbWF4aW11bTogMjU1IH0sIGI6IHsgdHlwZTogJ2ludGVnZXInLCBtaW5pbXVtOiAwLCBtYXhpbXVtOiAyNTUgfSB9LCByZXF1aXJlZDogWydyJywgJ2cnLCAnYiddLCBkZXNjcmlwdGlvbjogJ0JhY2tncm91bmQgY29sb3IgZm9yIHRyYW5zcGFyZW50IGltYWdlcyBpbiBSR0IgZm9ybWF0JyB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJ11cbiAgICAgICAgfSxcbiAgICAgICAgQmFzZTY0SW1hZ2VTY2hlbWEsIFwiR0VUXCIsIFsnYXNzZXQnLCAncHJldmlldycsICdzY3JlZW5zaG90J11cbiAgICApXG4gICAgYXN5bmMgYXNzZXRHZXRQcmV2aWV3KGFyZ3M6IHsgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UsIGltYWdlU2l6ZT86IG51bWJlciwganBlZ1F1YWxpdHk/OiBudW1iZXIsIHRyYW5zcGFyZW50Q29sb3I/OiB7IHI6IG51bWJlciwgZzogbnVtYmVyLCBiOiBudW1iZXIgfSB9KTogUHJvbWlzZTxJQmFzZTY0SW1hZ2U+IHtcbiAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhcmdzLnJlZmVyZW5jZS5pZCk7XG4gICAgICAgIGlmICghaW5mbykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NldCAke2FyZ3MucmVmZXJlbmNlLmlkfSBub3QgZm91bmQuYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpbmZvLmltcG9ydGVyKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2V0ICR7YXJncy5yZWZlcmVuY2UuaWR9IGhhcyBubyBpbXBvcnRlciBhbmQgY2Fubm90IGJlIHByZXZpZXdlZC5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFyZ3MuaW1hZ2VTaXplID0gYXJncy5pbWFnZVNpemUgfHwgNTEyO1xuICAgICAgICBhcmdzLmpwZWdRdWFsaXR5ID0gYXJncy5qcGVnUXVhbGl0eSB8fCA4MDtcbiAgICAgICAgYXJncy50cmFuc3BhcmVudENvbG9yID0gYXJncy50cmFuc3BhcmVudENvbG9yIHx8IHsgcjogMCwgZzogMCwgYjogMCB9O1xuICAgICAgICBsZXQgaW1wb3J0ZXIgPSBpbmZvLmltcG9ydGVyO1xuXG4gICAgICAgIGNvbnN0IHN1cHBvcnRlZEltcG9ydGVycyA9IFtcbiAgICAgICAgICAgICdlcnAtdGV4dHVyZS1jdWJlJyxcbiAgICAgICAgICAgICdpbWFnZScsXG4gICAgICAgICAgICAnc3ByaXRlLWZyYW1lJyxcbiAgICAgICAgICAgICd0ZXh0dXJlJyxcbiAgICAgICAgICAgICdmYngnLFxuICAgICAgICAgICAgJ2dsdGYnLFxuICAgICAgICAgICAgJ2dsdGYtbWVzaCcsXG4gICAgICAgICAgICAncHJlZmFiJyxcbiAgICAgICAgICAgICdtYXRlcmlhbCcsXG4gICAgICAgICAgICAnc3BpbmUnLFxuICAgICAgICAgICAgJ2dsdGYtc2tlbGV0b24nLFxuICAgICAgICAgICAgJ3NjZW5lJ1xuICAgICAgICBdO1xuXG4gICAgICAgIGlmICghc3VwcG9ydGVkSW1wb3J0ZXJzLmluY2x1ZGVzKGltcG9ydGVyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NldCBwcmV2aWV3IG5vdCBzdXBwb3J0ZWQgZm9yIGFzc2V0IHR5cGU6ICR7aW5mby50eXBlfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGltcG9ydGVyID09PSAnZmJ4JyB8fCBpbXBvcnRlciA9PT0gJ2dsdGYnKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoID0gT2JqZWN0LnZhbHVlcyhpbmZvLnN1YkFzc2V0cykuZmluZCgoc3ViOiBhbnkpID0+IHN1Yi5pbXBvcnRlciA9PT0gJ2dsdGYtbWVzaCcpO1xuICAgICAgICAgICAgaWYgKCFtZXNoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NldCAke2FyZ3MucmVmZXJlbmNlLmlkfSBoYXMgbm8gZ2x0Zi1tZXNoIHN1Yi1hc3NldCBmb3IgcHJldmlldy5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFyZ3MucmVmZXJlbmNlLmlkID0gbWVzaC51dWlkO1xuICAgICAgICAgICAgaW1wb3J0ZXIgPSAnZ2x0Zi1tZXNoJztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzb3VyY2VQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgICAgICBpZiAoaW1wb3J0ZXIgPT09ICdnbHRmLW1lc2gnIHx8IGltcG9ydGVyID09PSAnbWVzaCcpIHtcbiAgICAgICAgICAgIHNvdXJjZVBhdGggPSAoYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtdGh1bWJuYWlsJywgYXJncy5yZWZlcmVuY2UuaWQsIFwib3JpZ2luXCIpIGFzIGFueSkudmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoWydlcnAtdGV4dHVyZS1jdWJlJywgJ2ltYWdlJywgJ3Nwcml0ZS1mcmFtZScsICd0ZXh0dXJlJ10uaW5jbHVkZXMoaW1wb3J0ZXIpKSB7XG4gICAgICAgICAgICBsZXQgZmlsZVV1aWQgPSBhcmdzLnJlZmVyZW5jZS5pZDtcbiAgICAgICAgICAgIGlmIChhcmdzLnJlZmVyZW5jZS5pZC5pbmNsdWRlcygnQCcpKSB7XG4gICAgICAgICAgICAgICAgZmlsZVV1aWQgPSBhcmdzLnJlZmVyZW5jZS5pZC5zcGxpdCgnQCcpWzBdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBmaWxlSW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBmaWxlVXVpZCk7XG4gICAgICAgICAgICBpZiAoZmlsZUluZm8gJiYgZmlsZUluZm8uZmlsZSkge1xuICAgICAgICAgICAgICAgIHNvdXJjZVBhdGggPSBmaWxlSW5mby5maWxlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNvdXJjZVBhdGggJiYgZnMuZXhpc3RzU3luYyhzb3VyY2VQYXRoKSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbWFnZSA9IHNoYXJwKHNvdXJjZVBhdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1ldGFkYXRhID0gYXdhaXQgaW1hZ2UubWV0YWRhdGEoKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0ZWRTaXplID0gYXJncy5pbWFnZVNpemUgfHwgNTEyO1xuICAgICAgICAgICAgICAgIGxldCBwcm9jZXNzZWQgPSBpbWFnZTtcblxuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgKG1ldGFkYXRhLndpZHRoICYmIG1ldGFkYXRhLndpZHRoID4gcmVxdWVzdGVkU2l6ZSkgfHxcbiAgICAgICAgICAgICAgICAgICAgKG1ldGFkYXRhLmhlaWdodCAmJiBtZXRhZGF0YS5oZWlnaHQgPiByZXF1ZXN0ZWRTaXplKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICBwcm9jZXNzZWQgPSBwcm9jZXNzZWQucmVzaXplKHJlcXVlc3RlZFNpemUsIHJlcXVlc3RlZFNpemUsIHsgZml0OiAnY29udGFpbicsIGJhY2tncm91bmQ6IHsgcjogMCwgZzogMCwgYjogMCwgYWxwaGE6IDAgfSB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgYnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmICgobWV0YWRhdGEuZm9ybWF0ID09PSAncG5nJyB8fCBtZXRhZGF0YS5oYXNBbHBoYSkpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVyID0gYXdhaXQgcHJvY2Vzc2VkLmZsYXR0ZW4oeyBiYWNrZ3JvdW5kOiBhcmdzLnRyYW5zcGFyZW50Q29sb3IgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5qcGVnKHsgcXVhbGl0eTogYXJncy5qcGVnUXVhbGl0eSB8fCA4MCB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRvQnVmZmVyKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVyID0gYXdhaXQgcHJvY2Vzc2VkXG4gICAgICAgICAgICAgICAgICAgICAgICAuanBlZyh7IHF1YWxpdHk6IGFyZ3MuanBlZ1F1YWxpdHkgfHwgODAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50b0J1ZmZlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4geyB0eXBlOiBcImltYWdlXCIsIGRhdGE6IGJ1ZmZlci50b1N0cmluZygnYmFzZTY0JyksIG1pbWVUeXBlOiBcImltYWdlL2pwZWdcIiB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBwcm9jZXNzIGltYWdlIGZyb20gJHtzb3VyY2VQYXRofSB3aXRoIHNoYXJwOmAsIGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3BlbiBwYW5lbCB0byBlbnN1cmUgcmVuZGVyZXIgcHJvY2VzcyBpcyBhbGl2ZVxuICAgICAgICBhd2FpdCBFZGl0b3IuUGFuZWwub3BlbkJlc2lkZSgnc2NlbmUnLCBgJHtwYWNrYWdlSlNPTi5uYW1lfS5wcmV2aWV3YCk7XG5cbiAgICAgICAgbGV0IGJhc2U2NEltYWdlOiBzdHJpbmc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBSZXF1ZXN0IGdlbmVyYXRpb25cbiAgICAgICAgICAgIGJhc2U2NEltYWdlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdChwYWNrYWdlSlNPTi5uYW1lLCAnZ2VuZXJhdGUtcHJldmlldycsIGFyZ3MucmVmZXJlbmNlLmlkLCBhcmdzLmltYWdlU2l6ZSB8fCA1MTIsIGFyZ3MuaW1hZ2VTaXplIHx8IDUxMiwgKGFyZ3MuanBlZ1F1YWxpdHkgfHwgODApIC8gMTAwKTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIC8vIENsb3NlIHBhbmVsXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuUGFuZWwuY2xvc2UoYCR7cGFja2FnZUpTT04ubmFtZX0ucHJldmlld2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFiYXNlNjRJbWFnZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZ2VuZXJhdGUgcHJldmlldyBmb3IgYXNzZXQgJHthcmdzLnJlZmVyZW5jZS5pZH0uYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgdHlwZTogXCJpbWFnZVwiLCBkYXRhOiBiYXNlNjRJbWFnZSwgbWltZVR5cGU6IFwiaW1hZ2UvanBlZ1wiIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVR5cGVzY3JpcHRDbGFzc1RlbXBsYXRlKGNsYXNzTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIGBpbXBvcnQgeyBfZGVjb3JhdG9yLCBDb21wb25lbnQsIE5vZGUgfSBmcm9tICdjYyc7XG5jb25zdCB7IGNjY2xhc3MsIHByb3BlcnR5IH0gPSBfZGVjb3JhdG9yO1xuXG5AY2NjbGFzcygnJHtjbGFzc05hbWV9JylcbmV4cG9ydCBjbGFzcyAke2NsYXNzTmFtZX0gZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIHN0YXJ0KCkge1xuXG4gICAgfVxuXG4gICAgdXBkYXRlKGRlbHRhVGltZTogbnVtYmVyKSB7XG4gICAgICAgIFxuICAgIH1cbn1gO1xuICAgIH1cbn0iXX0=