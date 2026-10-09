"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetPropertyTool = void 0;
const decorators_1 = require("../decorators");
const tools_utils_1 = require("../utils/tools-utils");
const asset_importers_1 = require("../utils/asset-importers");
const schemas_1 = require("../schemas");
class SetPropertyTool {
    async setCurrentSceneProperties(params) {
        return await this.setInstanceProperties({
            reference: { id: params.settingsType }, propertyPaths: params.propertyPaths, values: params.values
        });
    }
    async setInstanceProperties(params) {
        let { reference: { id: uuid }, propertyPaths, values } = params;
        if (!propertyPaths || !values) {
            throw new Error(`Property paths and values are required.`);
        }
        if (propertyPaths.length !== values.length) {
            throw new Error(`Property paths count (${propertyPaths.length}) does not match values count (${values.length}).`);
        }
        let info = await tools_utils_1.ToolsUtils.inspectInstance(uuid, false);
        if (!info) {
            throw new Error(`Target ${uuid} not found or not supported.`);
        }
        uuid = info.uuid;
        const { type, props, assetInfo } = info;
        if (!props) {
            throw new Error(`Could not retrieve properties for ${type} of instance ${uuid}.`);
        }
        for (let i = 0; i < propertyPaths.length; i++) {
            await this.setProperty(info, propertyPaths[i], values[i]);
        }
        return { success: true };
    }
    async setProperty({ uuid, type, props, assetInfo }, propertyPath, value) {
        var _a;
        // Find property definition in the dump
        let targetProp = null;
        try {
            targetProp = this.findPropertyInDump(props, propertyPath);
        }
        catch (e) {
            throw new Error(`Property '${propertyPath}' resolution failed: ${e.message}. Please recheck TypescriptDefinition of ${uuid}. Arrays are reached by indexes.`);
        }
        if (!targetProp) {
            throw new Error(`Property '${propertyPath}' not found on ${type} of instance ${uuid}.`);
        }
        // Normalize value based on property definition
        value = this.normalizeValue(value, targetProp);
        if (assetInfo) {
            try {
                const success = await ((_a = asset_importers_1.ImporterManager.getInstance().getImporter(assetInfo.importer)) === null || _a === void 0 ? void 0 : _a.setProperty(assetInfo, propertyPath, value));
                if (!success) {
                    throw new Error(`Importer failed to set property.`);
                }
            }
            catch (e) {
                throw new Error(`Failed to set property on Asset ${uuid}: ${e}`);
            }
            return;
        }
        if (type === 'cc.SceneGlobals') {
            // Scene Globals are part of the scene node but under _globals
            propertyPath = `_globals.${propertyPath}`;
            // uuid is already set to the Scene UUID from inspectInstance
        }
        else if (type !== 'cc.Node') {
            const nodeUuid = props.node.value.uuid;
            const nodeInfo = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeInfo) {
                throw new Error(`Parent Node ${nodeUuid} for Component ${uuid} not found.`);
            }
            const componentIndex = nodeInfo.__comps__.findIndex((comp) => comp.value.uuid.value === uuid);
            propertyPath = `__comps__.${componentIndex}.${propertyPath}`;
            uuid = nodeUuid;
        }
        await this.applyValue(uuid, propertyPath, targetProp, value);
    }
    normalizeValue(value, prop) {
        // Try to parse string values into proper types
        if (typeof value === 'string') {
            const isStringProp = prop.type === 'String';
            if (!isStringProp) {
                const t = value.trim();
                if (t === 'true')
                    return true;
                if (t === 'false')
                    return false;
                if (!isNaN(Number(t)) && t !== '') {
                    return Number(t);
                }
                if ((t.startsWith('{') || t.startsWith('[')) && (t.endsWith('}') || t.endsWith(']'))) {
                    try {
                        return JSON.parse(t);
                    }
                    catch (e) { }
                }
            }
        }
        return value;
    }
    findPropertyInDump(root, path) {
        if (!path)
            return null;
        if (!root)
            return null;
        const parts = path.split('.');
        let current = { value: root }; // Wrap to unify traversal
        // Helper to check if object looks like a property definition
        const isProperty = (obj) => obj && typeof obj === 'object' && ('type' in obj || 'extends' in obj);
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            // Current is expected to be an IProperty or object containing IProperty data
            let val = current.value;
            // If current is just the dictionary (root), use it directly
            if (current === root || (typeof current === 'object' && !('value' in current))) {
                val = current;
            }
            if (val === undefined || val === null)
                return null;
            // 1. Array Index
            if (Array.isArray(val)) {
                const idx = parseInt(part);
                if (!isNaN(idx)) {
                    // Existing index
                    if (val[idx] !== undefined) {
                        const elem = val[idx];
                        if (isProperty(elem)) {
                            current = elem;
                        }
                        else if (current.elementTypeData) {
                            // Hydrate from schema
                            current = Object.assign(Object.assign({}, current.elementTypeData), { value: elem });
                        }
                        else {
                            // Fallback for primitive arrays without schema
                            current = { value: elem, type: 'Unknown' };
                        }
                        continue;
                    }
                    // Extending array support: Allow index == length if schema exists.
                    // Don't allow gaps (idx > length).
                    if (idx === val.length) {
                        if (current.elementTypeData) {
                            current = current.elementTypeData;
                            continue;
                        }
                        else {
                            throw new Error(`Array extension at '${part}' failed: No elementTypeData.`);
                        }
                    }
                    throw new Error(`Array index '${idx}' out of bounds (length: ${val.length}) at '${part}'.`);
                }
                throw new Error(`Invalid array index '${part}' at '${path}'.`);
            }
            // 2. Object Key
            if (typeof val === 'object') {
                if (part in val) {
                    const propCandidate = val[part];
                    if (isProperty(propCandidate)) {
                        current = propCandidate;
                    }
                    else {
                        // Not a property, probably a raw value in a struct (like position.x = 0)
                        // Try to find schema in default value if available
                        let schema = null;
                        if (current.default && current.default.value && typeof current.default.value === 'object' && part in current.default.value) {
                            schema = current.default.value[part];
                        }
                        if (schema) {
                            current = Object.assign(Object.assign({}, schema), { value: propCandidate });
                        }
                        else {
                            // No schema found, treat as untyped value
                            current = { value: propCandidate, type: 'Unknown' };
                        }
                    }
                    continue;
                }
                throw new Error(`Key '${part}' not found ${i == 0 ? '' : 'in ' + parts.slice(0, i).join('.')}.`);
            }
            throw new Error(`Path segment '${part}' '${i == 0 ? '' : 'at ' + parts.slice(0, i).join('.')}' failed resolution.`);
        }
        return current;
    }
    async applyValue(uuid, path, prop, value) {
        var _a, _b, _c;
        // Handle direct references
        if ((_a = prop.extends) === null || _a === void 0 ? void 0 : _a.includes('cc.Object')) {
            value = await this.convertObjectReferenceToCocos(value, prop);
        }
        // Handle array of references
        if (Array.isArray(value) && ((_c = (_b = prop.elementTypeData) === null || _b === void 0 ? void 0 : _b.extends) === null || _c === void 0 ? void 0 : _c.includes('cc.Object'))) {
            const convertedArray = [];
            value.forEach(async (item, index) => {
                convertedArray[index] = await this.convertObjectReferenceToCocos(item, prop.elementTypeData);
            });
            value = convertedArray;
        }
        const dump = { value, type: prop.type };
        await Editor.Message.request('scene', 'set-property', {
            uuid,
            path,
            dump
        });
        await Editor.Message.request('scene', 'snapshot');
    }
    async convertObjectReferenceToCocos(value, prop) {
        const extendsInfo = prop.extends || [];
        // Accept plain UUID string or { uuid: string } structure
        if (typeof value === 'string') {
            value = { uuid: value };
        }
        // Reference object with id is sent
        if (typeof value === 'object' && value !== null && 'id' in value) {
            value = { uuid: value.id };
        }
        // Special case for asset subtype check
        if (extendsInfo.includes('cc.Asset')) {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', value.uuid);
            if (!assetInfo) {
                throw new Error(`Asset with id ${value.uuid} not found.`);
            }
            let foundSubAsset = false;
            if (assetInfo.type !== prop.type) {
                Object.values(assetInfo.subAssets || {}).forEach(subAsset => {
                    if (subAsset.type === prop.type) {
                        value = { uuid: subAsset.uuid };
                        foundSubAsset = true;
                    }
                });
            }
            else {
                foundSubAsset = true;
            }
            if (!foundSubAsset && assetInfo.type !== prop.type) {
                throw new Error(`Reference type mismatch: expected ${prop.type}, got ${assetInfo.type}.`);
            }
        }
        return value;
    }
}
exports.SetPropertyTool = SetPropertyTool;
__decorate([
    (0, decorators_1.utcpTool)("inspectorSetSettingsProperties", "Sets a property on the specific settings. If a property path or type is not confirmed via inspectorGet* tools, you MUST NOT call any setter.", { type: 'object',
        properties: {
            settingsType: { type: 'string', enum: ['CurrentSceneGlobals', 'ProjectSettings'] },
            propertyPath: { type: 'string', description: "Plain path to the property (e.g., 'ambient.skyLightingColor.r'). Don't support code execution." },
            value: { type: ['array', 'object', 'string', 'number', 'boolean', 'null'], additionalProperties: true }
        },
        required: ['settingsType', 'propertyPath', 'value']
    }, schemas_1.SuccessIndicatorSchema, "POST", ['property', 'set', 'scene', 'settings', 'project', 'modify', 'config'])
], SetPropertyTool.prototype, "setCurrentSceneProperties", null);
__decorate([
    (0, decorators_1.utcpTool)("inspectorSetInstanceProperties", "Sets a property on instance of Node, Component or Asset. If a property path or type is not confirmed via inspectorGet* tools, you MUST NOT call any setter.", {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema,
            propertyPaths: { type: 'array', items: { type: 'string' }, description: "Plain paths to the properties (e.g., ['position.x', 'rotation.y']). Don't support code execution. Arrays are reached by indexes. (e.g. 'sharedMaterials.0')" },
            values: { type: 'array', items: { type: ['array', 'object', 'string', 'number', 'boolean', 'null'], additionalProperties: true } }
        },
        required: ['reference', 'propertyPaths', 'values']
    }, schemas_1.SuccessIndicatorSchema, "POST", ['property', 'set', 'instance', 'node', 'component', 'asset', 'modify', 'meta'])
], SetPropertyTool.prototype, "setInstanceProperties", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0LXByb3BlcnRpZXMtdG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS91dGNwL3Rvb2xzL3NldC1wcm9wZXJ0aWVzLXRvb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsOENBQXlDO0FBRXpDLHNEQUFrRDtBQUNsRCw4REFBMkQ7QUFFM0Qsd0NBQW9IO0FBSXBILE1BQWEsZUFBZTtJQWNsQixBQUFOLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxNQUF3RTtRQUNwRyxPQUFPLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDO1lBQ3BDLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsWUFBWSxFQUFFLEVBQUUsYUFBYSxFQUFFLE1BQU0sQ0FBQyxhQUFhLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1NBQ3JHLENBQUMsQ0FBQztJQUNQLENBQUM7SUFpQkssQUFBTixLQUFLLENBQUMscUJBQXFCLENBQUMsTUFBaUY7UUFDekcsSUFBSSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDO1FBRWhFLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVELElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDekMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsYUFBYSxDQUFDLE1BQU0sa0NBQWtDLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO1FBQ3RILENBQUM7UUFFRCxJQUFJLElBQUksR0FBRyxNQUFNLHdCQUFVLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN6RCxJQUFJ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QUUsZUFBZSxFQUFFLFFBQVEsQ0FBQztLQUNyRCxFQUNELGdDQUFzQixFQUFFLE1BQU0sRUFBRSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FDbEg7NERBOEJBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXRjcFRvb2wgfSBmcm9tICcuLi9kZWNvcmF0b3JzJztcbmltcG9ydCB7IElQcm9wZXJ0eSwgSVByb3BlcnR5VmFsdWVUeXBlIH0gZnJvbSAnQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL3NjZW5lL0B0eXBlcy9wdWJsaWMnO1xuaW1wb3J0IHsgVG9vbHNVdGlscyB9IGZyb20gJy4uL3V0aWxzL3Rvb2xzLXV0aWxzJztcbmltcG9ydCB7IEltcG9ydGVyTWFuYWdlciB9IGZyb20gJy4uL3V0aWxzL2Fzc2V0LWltcG9ydGVycyc7XG5pbXBvcnQgeyBBc3NldEluZm8gfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvYXNzZXQtZGIvQHR5cGVzL3B1YmxpYyc7XG5pbXBvcnQgeyBJSW5zdGFuY2VSZWZlcmVuY2UsIEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLCBJU3VjY2Vzc0luZGljYXRvciwgU3VjY2Vzc0luZGljYXRvclNjaGVtYSB9IGZyb20gJy4uL3NjaGVtYXMnO1xuXG5kZWNsYXJlIGNvbnN0IEVkaXRvcjogYW55O1xuXG5leHBvcnQgY2xhc3MgU2V0UHJvcGVydHlUb29sIHtcbiAgICBAdXRjcFRvb2woXG4gICAgICAgIFwiaW5zcGVjdG9yU2V0U2V0dGluZ3NQcm9wZXJ0aWVzXCIsXG4gICAgICAgIFwiU2V0cyBhIHByb3BlcnR5IG9uIHRoZSBzcGVjaWZpYyBzZXR0aW5ncy4gSWYgYSBwcm9wZXJ0eSBwYXRoIG9yIHR5cGUgaXMgbm90IGNvbmZpcm1lZCB2aWEgaW5zcGVjdG9yR2V0KiB0b29scywgeW91IE1VU1QgTk9UIGNhbGwgYW55IHNldHRlci5cIixcbiAgICAgICAgeyB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBzZXR0aW5nc1R5cGU6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFsnQ3VycmVudFNjZW5lR2xvYmFscycsICdQcm9qZWN0U2V0dGluZ3MnXSB9LFxuICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246IFwiUGxhaW4gcGF0aCB0byB0aGUgcHJvcGVydHkgKGUuZy4sICdhbWJpZW50LnNreUxpZ2h0aW5nQ29sb3IucicpLiBEb24ndCBzdXBwb3J0IGNvZGUgZXhlY3V0aW9uLlwiIH0sXG4gICAgICAgICAgICAgICAgdmFsdWU6IHsgdHlwZTogWydhcnJheScsICdvYmplY3QnLCAnc3RyaW5nJywgJ251bWJlcicsICdib29sZWFuJywgJ251bGwnXSwgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3NldHRpbmdzVHlwZScsICdwcm9wZXJ0eVBhdGgnLCAndmFsdWUnXVxuICAgICAgICB9LFxuICAgICAgICBTdWNjZXNzSW5kaWNhdG9yU2NoZW1hLCBcIlBPU1RcIiwgWydwcm9wZXJ0eScsICdzZXQnLCAnc2NlbmUnLCAnc2V0dGluZ3MnLCAncHJvamVjdCcsICdtb2RpZnknLCAnY29uZmlnJ11cbiAgICApXG4gICAgYXN5bmMgc2V0Q3VycmVudFNjZW5lUHJvcGVydGllcyhwYXJhbXM6IHsgc2V0dGluZ3NUeXBlOiBzdHJpbmcsIHByb3BlcnR5UGF0aHM6IHN0cmluZ1tdLCB2YWx1ZXM6IGFueVtdIH0pOiBQcm9taXNlPElTdWNjZXNzSW5kaWNhdG9yPiB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNldEluc3RhbmNlUHJvcGVydGllcyh7XG4gICAgICAgICAgICByZWZlcmVuY2U6IHsgaWQ6IHBhcmFtcy5zZXR0aW5nc1R5cGUgfSwgcHJvcGVydHlQYXRoczogcGFyYW1zLnByb3BlcnR5UGF0aHMsIHZhbHVlczogcGFyYW1zLnZhbHVlc1xuICAgICAgICB9KTtcbiAgICB9XG5cblxuICAgIEB1dGNwVG9vbChcbiAgICAgICAgXCJpbnNwZWN0b3JTZXRJbnN0YW5jZVByb3BlcnRpZXNcIixcbiAgICAgICAgXCJTZXRzIGEgcHJvcGVydHkgb24gaW5zdGFuY2Ugb2YgTm9kZSwgQ29tcG9uZW50IG9yIEFzc2V0LiBJZiBhIHByb3BlcnR5IHBhdGggb3IgdHlwZSBpcyBub3QgY29uZmlybWVkIHZpYSBpbnNwZWN0b3JHZXQqIHRvb2xzLCB5b3UgTVVTVCBOT1QgY2FsbCBhbnkgc2V0dGVyLlwiLFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aHM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246IFwiUGxhaW4gcGF0aHMgdG8gdGhlIHByb3BlcnRpZXMgKGUuZy4sIFsncG9zaXRpb24ueCcsICdyb3RhdGlvbi55J10pLiBEb24ndCBzdXBwb3J0IGNvZGUgZXhlY3V0aW9uLiBBcnJheXMgYXJlIHJlYWNoZWQgYnkgaW5kZXhlcy4gKGUuZy4gJ3NoYXJlZE1hdGVyaWFscy4wJylcIiB9LFxuICAgICAgICAgICAgICAgIHZhbHVlczogeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiBbJ2FycmF5JywgJ29iamVjdCcsICdzdHJpbmcnLCAnbnVtYmVyJywgJ2Jvb2xlYW4nLCAnbnVsbCddLCBhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSB9IH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZDogWydyZWZlcmVuY2UnLCAncHJvcGVydHlQYXRocycsICd2YWx1ZXMnXVxuICAgICAgICB9LFxuICAgICAgICBTdWNjZXNzSW5kaWNhdG9yU2NoZW1hLCBcIlBPU1RcIiwgWydwcm9wZXJ0eScsICdzZXQnLCAnaW5zdGFuY2UnLCAnbm9kZScsICdjb21wb25lbnQnLCAnYXNzZXQnLCAnbW9kaWZ5JywgJ21ldGEnXVxuICAgIClcbiAgICBhc3luYyBzZXRJbnN0YW5jZVByb3BlcnRpZXMocGFyYW1zOiB7IHJlZmVyZW5jZTogSUluc3RhbmNlUmVmZXJlbmNlLCBwcm9wZXJ0eVBhdGhzOiBzdHJpbmdbXSwgdmFsdWVzOiBhbnlbXSB9KTogUHJvbWlzZTxJU3VjY2Vzc0luZGljYXRvcj4ge1xuICAgICAgICBsZXQgeyByZWZlcmVuY2U6IHsgaWQ6IHV1aWQgfSwgcHJvcGVydHlQYXRocywgdmFsdWVzIH0gPSBwYXJhbXM7XG5cbiAgICAgICAgaWYgKCFwcm9wZXJ0eVBhdGhzIHx8ICF2YWx1ZXMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgcGF0aHMgYW5kIHZhbHVlcyBhcmUgcmVxdWlyZWQuYCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJvcGVydHlQYXRocy5sZW5ndGggIT09IHZhbHVlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgcGF0aHMgY291bnQgKCR7cHJvcGVydHlQYXRocy5sZW5ndGh9KSBkb2VzIG5vdCBtYXRjaCB2YWx1ZXMgY291bnQgKCR7dmFsdWVzLmxlbmd0aH0pLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGluZm8gPSBhd2FpdCBUb29sc1V0aWxzLmluc3BlY3RJbnN0YW5jZSh1dWlkLCBmYWxzZSk7XG4gICAgICAgIGlmICghaW5mbykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUYXJnZXQgJHt1dWlkfSBub3QgZm91bmQgb3Igbm90IHN1cHBvcnRlZC5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHV1aWQgPSBpbmZvLnV1aWQ7XG5cbiAgICAgICAgY29uc3QgeyB0eXBlLCBwcm9wcywgYXNzZXRJbmZvIH0gPSBpbmZvO1xuXG4gICAgICAgIGlmICghcHJvcHMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHJldHJpZXZlIHByb3BlcnRpZXMgZm9yICR7dHlwZX0gb2YgaW5zdGFuY2UgJHt1dWlkfS5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvcGVydHlQYXRocy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRQcm9wZXJ0eShpbmZvLCBwcm9wZXJ0eVBhdGhzW2ldLCB2YWx1ZXNbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0UHJvcGVydHkoeyB1dWlkLCB0eXBlLCBwcm9wcywgYXNzZXRJbmZvIH06IHsgdXVpZDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIHByb3BzOiB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9IHwgbnVsbCwgYXNzZXRJbmZvOiBBc3NldEluZm8gfCBudWxsIH0sIHByb3BlcnR5UGF0aDogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8vIEZpbmQgcHJvcGVydHkgZGVmaW5pdGlvbiBpbiB0aGUgZHVtcFxuICAgICAgICBsZXQgdGFyZ2V0UHJvcDogSVByb3BlcnR5IHwgbnVsbCA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0YXJnZXRQcm9wID0gdGhpcy5maW5kUHJvcGVydHlJbkR1bXAocHJvcHMsIHByb3BlcnR5UGF0aCk7XG4gICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eVBhdGh9JyByZXNvbHV0aW9uIGZhaWxlZDogJHtlLm1lc3NhZ2V9LiBQbGVhc2UgcmVjaGVjayBUeXBlc2NyaXB0RGVmaW5pdGlvbiBvZiAke3V1aWR9LiBBcnJheXMgYXJlIHJlYWNoZWQgYnkgaW5kZXhlcy5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGFyZ2V0UHJvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eVBhdGh9JyBub3QgZm91bmQgb24gJHt0eXBlfSBvZiBpbnN0YW5jZSAke3V1aWR9LmApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm9ybWFsaXplIHZhbHVlIGJhc2VkIG9uIHByb3BlcnR5IGRlZmluaXRpb25cbiAgICAgICAgdmFsdWUgPSB0aGlzLm5vcm1hbGl6ZVZhbHVlKHZhbHVlLCB0YXJnZXRQcm9wKTtcblxuICAgICAgICBpZiAoYXNzZXRJbmZvKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3M6IGJvb2xlYW4gfCB1bmRlZmluZWQgPSBhd2FpdCBJbXBvcnRlck1hbmFnZXIuZ2V0SW5zdGFuY2UoKS5nZXRJbXBvcnRlcihhc3NldEluZm8uaW1wb3J0ZXIpPy5zZXRQcm9wZXJ0eShhc3NldEluZm8sIHByb3BlcnR5UGF0aCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEltcG9ydGVyIGZhaWxlZCB0byBzZXQgcHJvcGVydHkuYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHNldCBwcm9wZXJ0eSBvbiBBc3NldCAke3V1aWR9OiAke2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlNjZW5lR2xvYmFscycpIHtcbiAgICAgICAgICAgIC8vIFNjZW5lIEdsb2JhbHMgYXJlIHBhcnQgb2YgdGhlIHNjZW5lIG5vZGUgYnV0IHVuZGVyIF9nbG9iYWxzXG4gICAgICAgICAgICBwcm9wZXJ0eVBhdGggPSBgX2dsb2JhbHMuJHtwcm9wZXJ0eVBhdGh9YDtcbiAgICAgICAgICAgIC8vIHV1aWQgaXMgYWxyZWFkeSBzZXQgdG8gdGhlIFNjZW5lIFVVSUQgZnJvbSBpbnNwZWN0SW5zdGFuY2VcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlICE9PSAnY2MuTm9kZScpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gKHByb3BzIGFzIGFueSkubm9kZS52YWx1ZS51dWlkO1xuICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlSW5mbykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IE5vZGUgJHtub2RlVXVpZH0gZm9yIENvbXBvbmVudCAke3V1aWR9IG5vdCBmb3VuZC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gbm9kZUluZm8uX19jb21wc19fLmZpbmRJbmRleCgoY29tcDogYW55KSA9PiBjb21wLnZhbHVlLnV1aWQudmFsdWUgPT09IHV1aWQpO1xuICAgICAgICAgICAgcHJvcGVydHlQYXRoID0gYF9fY29tcHNfXy4ke2NvbXBvbmVudEluZGV4fS4ke3Byb3BlcnR5UGF0aH1gO1xuICAgICAgICAgICAgdXVpZCA9IG5vZGVVdWlkO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdGhpcy5hcHBseVZhbHVlKHV1aWQsIHByb3BlcnR5UGF0aCwgdGFyZ2V0UHJvcCwgdmFsdWUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgbm9ybWFsaXplVmFsdWUodmFsdWU6IGFueSwgcHJvcDogSVByb3BlcnR5KTogYW55IHtcbiAgICAgICAgLy8gVHJ5IHRvIHBhcnNlIHN0cmluZyB2YWx1ZXMgaW50byBwcm9wZXIgdHlwZXNcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGNvbnN0IGlzU3RyaW5nUHJvcCA9IHByb3AudHlwZSA9PT0gJ1N0cmluZyc7XG4gICAgICAgICAgICBpZiAoIWlzU3RyaW5nUHJvcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHQgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICAgICAgaWYgKHQgPT09ICd0cnVlJykgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHQgPT09ICdmYWxzZScpIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGlmICghaXNOYU4oTnVtYmVyKHQpKSAmJiB0ICE9PSAnJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKHQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICgodC5zdGFydHNXaXRoKCd7JykgfHwgdC5zdGFydHNXaXRoKCdbJykpICYmICh0LmVuZHNXaXRoKCd9JykgfHwgdC5lbmRzV2l0aCgnXScpKSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZSh0KTsgfSBjYXRjaCAoZSkgeyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGZpbmRQcm9wZXJ0eUluRHVtcChyb290OiB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9IHwgQXNzZXRJbmZvIHwgbnVsbCwgcGF0aDogc3RyaW5nKTogSVByb3BlcnR5IHwgbnVsbCB7XG4gICAgICAgIGlmICghcGF0aCkgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICghcm9vdCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgICAgICAgbGV0IGN1cnJlbnQ6IGFueSA9IHsgdmFsdWU6IHJvb3QgfTsgLy8gV3JhcCB0byB1bmlmeSB0cmF2ZXJzYWxcblxuICAgICAgICAvLyBIZWxwZXIgdG8gY2hlY2sgaWYgb2JqZWN0IGxvb2tzIGxpa2UgYSBwcm9wZXJ0eSBkZWZpbml0aW9uXG4gICAgICAgIGNvbnN0IGlzUHJvcGVydHkgPSAob2JqOiBhbnkpID0+IG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiAoJ3R5cGUnIGluIG9iaiB8fCAnZXh0ZW5kcycgaW4gb2JqKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJ0ID0gcGFydHNbaV07XG5cbiAgICAgICAgICAgIC8vIEN1cnJlbnQgaXMgZXhwZWN0ZWQgdG8gYmUgYW4gSVByb3BlcnR5IG9yIG9iamVjdCBjb250YWluaW5nIElQcm9wZXJ0eSBkYXRhXG4gICAgICAgICAgICBsZXQgdmFsID0gY3VycmVudC52YWx1ZTtcbiAgICAgICAgICAgIC8vIElmIGN1cnJlbnQgaXMganVzdCB0aGUgZGljdGlvbmFyeSAocm9vdCksIHVzZSBpdCBkaXJlY3RseVxuICAgICAgICAgICAgaWYgKGN1cnJlbnQgPT09IHJvb3QgfHwgKHR5cGVvZiBjdXJyZW50ID09PSAnb2JqZWN0JyAmJiAhKCd2YWx1ZScgaW4gY3VycmVudCkpKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gY3VycmVudDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZhbCA9PT0gdW5kZWZpbmVkIHx8IHZhbCA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgICAgIC8vIDEuIEFycmF5IEluZGV4XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWR4ID0gcGFyc2VJbnQocGFydCk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc05hTihpZHgpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEV4aXN0aW5nIGluZGV4XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWxbaWR4XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbGVtID0gdmFsW2lkeF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNQcm9wZXJ0eShlbGVtKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBlbGVtO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50LmVsZW1lbnRUeXBlRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEh5ZHJhdGUgZnJvbSBzY2hlbWFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0geyAuLi5jdXJyZW50LmVsZW1lbnRUeXBlRGF0YSwgdmFsdWU6IGVsZW0gfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmFsbGJhY2sgZm9yIHByaW1pdGl2ZSBhcnJheXMgd2l0aG91dCBzY2hlbWFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0geyB2YWx1ZTogZWxlbSwgdHlwZTogJ1Vua25vd24nIH07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBFeHRlbmRpbmcgYXJyYXkgc3VwcG9ydDogQWxsb3cgaW5kZXggPT0gbGVuZ3RoIGlmIHNjaGVtYSBleGlzdHMuXG4gICAgICAgICAgICAgICAgICAgIC8vIERvbid0IGFsbG93IGdhcHMgKGlkeCA+IGxlbmd0aCkuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpZHggPT09IHZhbC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50LmVsZW1lbnRUeXBlRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LmVsZW1lbnRUeXBlRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBcnJheSBleHRlbnNpb24gYXQgJyR7cGFydH0nIGZhaWxlZDogTm8gZWxlbWVudFR5cGVEYXRhLmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXJyYXkgaW5kZXggJyR7aWR4fScgb3V0IG9mIGJvdW5kcyAobGVuZ3RoOiAke3ZhbC5sZW5ndGh9KSBhdCAnJHtwYXJ0fScuYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBhcnJheSBpbmRleCAnJHtwYXJ0fScgYXQgJyR7cGF0aH0nLmApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAyLiBPYmplY3QgS2V5XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBpZiAocGFydCBpbiB2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJvcENhbmRpZGF0ZSA9IHZhbFtwYXJ0IGFzIGtleW9mIHR5cGVvZiB2YWxdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNQcm9wZXJ0eShwcm9wQ2FuZGlkYXRlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudCA9IHByb3BDYW5kaWRhdGU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOb3QgYSBwcm9wZXJ0eSwgcHJvYmFibHkgYSByYXcgdmFsdWUgaW4gYSBzdHJ1Y3QgKGxpa2UgcG9zaXRpb24ueCA9IDApXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZmluZCBzY2hlbWEgaW4gZGVmYXVsdCB2YWx1ZSBpZiBhdmFpbGFibGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzY2hlbWEgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQuZGVmYXVsdCAmJiBjdXJyZW50LmRlZmF1bHQudmFsdWUgJiYgdHlwZW9mIGN1cnJlbnQuZGVmYXVsdC52YWx1ZSA9PT0gJ29iamVjdCcgJiYgcGFydCBpbiBjdXJyZW50LmRlZmF1bHQudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWEgPSBjdXJyZW50LmRlZmF1bHQudmFsdWVbcGFydF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzY2hlbWEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0geyAuLi5zY2hlbWEsIHZhbHVlOiBwcm9wQ2FuZGlkYXRlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vIHNjaGVtYSBmb3VuZCwgdHJlYXQgYXMgdW50eXBlZCB2YWx1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSB7IHZhbHVlOiBwcm9wQ2FuZGlkYXRlLCB0eXBlOiAnVW5rbm93bicgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBLZXkgJyR7cGFydH0nIG5vdCBmb3VuZCAke2kgPT0gMCA/ICcnIDogJ2luICcgKyBwYXJ0cy5zbGljZSgwLCBpKS5qb2luKCcuJyl9LmApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhdGggc2VnbWVudCAnJHtwYXJ0fScgJyR7aSA9PSAwID8gJycgOiAnYXQgJyArIHBhcnRzLnNsaWNlKDAsIGkpLmpvaW4oJy4nKX0nIGZhaWxlZCByZXNvbHV0aW9uLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGN1cnJlbnQgYXMgSVByb3BlcnR5O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYXBwbHlWYWx1ZSh1dWlkOiBzdHJpbmcsIHBhdGg6IHN0cmluZywgcHJvcDogSVByb3BlcnR5LCB2YWx1ZTogYW55KSB7XG4gICAgICAgIC8vIEhhbmRsZSBkaXJlY3QgcmVmZXJlbmNlc1xuICAgICAgICBpZiAocHJvcC5leHRlbmRzPy5pbmNsdWRlcygnY2MuT2JqZWN0JykpIHtcbiAgICAgICAgICAgIHZhbHVlID0gYXdhaXQgdGhpcy5jb252ZXJ0T2JqZWN0UmVmZXJlbmNlVG9Db2Nvcyh2YWx1ZSwgcHJvcCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIYW5kbGUgYXJyYXkgb2YgcmVmZXJlbmNlc1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgcHJvcC5lbGVtZW50VHlwZURhdGE/LmV4dGVuZHM/LmluY2x1ZGVzKCdjYy5PYmplY3QnKSkge1xuICAgICAgICAgICAgY29uc3QgY29udmVydGVkQXJyYXk6IGFueVtdID0gW107XG4gICAgICAgICAgICB2YWx1ZS5mb3JFYWNoKGFzeW5jIChpdGVtLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnZlcnRlZEFycmF5W2luZGV4XSA9IGF3YWl0IHRoaXMuY29udmVydE9iamVjdFJlZmVyZW5jZVRvQ29jb3MoaXRlbSwgcHJvcC5lbGVtZW50VHlwZURhdGEhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFsdWUgPSBjb252ZXJ0ZWRBcnJheTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGR1bXAgPSB7IHZhbHVlLCB0eXBlOiBwcm9wLnR5cGUgfTtcblxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgIGR1bXBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc25hcHNob3QnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNvbnZlcnRPYmplY3RSZWZlcmVuY2VUb0NvY29zKHZhbHVlOiBhbnksIHByb3A6IElQcm9wZXJ0eSk6IFByb21pc2U8eyB1dWlkOiBzdHJpbmcgfT4ge1xuICAgICAgICBjb25zdCBleHRlbmRzSW5mbyA9IHByb3AuZXh0ZW5kcyB8fCBbXTtcblxuICAgICAgICAvLyBBY2NlcHQgcGxhaW4gVVVJRCBzdHJpbmcgb3IgeyB1dWlkOiBzdHJpbmcgfSBzdHJ1Y3R1cmVcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhbHVlID0geyB1dWlkOiB2YWx1ZSB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZWZlcmVuY2Ugb2JqZWN0IHdpdGggaWQgaXMgc2VudFxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCAmJiAnaWQnIGluIHZhbHVlKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHsgdXVpZDogdmFsdWUuaWQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgYXNzZXQgc3VidHlwZSBjaGVja1xuICAgICAgICBpZiAoZXh0ZW5kc0luZm8uaW5jbHVkZXMoJ2NjLkFzc2V0JykpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogQXNzZXRJbmZvIHwgbnVsbCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB2YWx1ZS51dWlkKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NldCB3aXRoIGlkICR7dmFsdWUudXVpZH0gbm90IGZvdW5kLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGZvdW5kU3ViQXNzZXQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChhc3NldEluZm8udHlwZSAhPT0gcHJvcC50eXBlKSB7XG4gICAgICAgICAgICAgICAgT2JqZWN0LnZhbHVlcyhhc3NldEluZm8uc3ViQXNzZXRzIHx8IHt9KS5mb3JFYWNoKHN1YkFzc2V0ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1YkFzc2V0LnR5cGUgPT09IHByb3AudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB7IHV1aWQ6IHN1YkFzc2V0LnV1aWQgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kU3ViQXNzZXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvdW5kU3ViQXNzZXQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWZvdW5kU3ViQXNzZXQgJiYgYXNzZXRJbmZvLnR5cGUgIT09IHByb3AudHlwZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVmZXJlbmNlIHR5cGUgbWlzbWF0Y2g6IGV4cGVjdGVkICR7cHJvcC50eXBlfSwgZ290ICR7YXNzZXRJbmZvLnR5cGV9LmApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG59XG4iXX0=