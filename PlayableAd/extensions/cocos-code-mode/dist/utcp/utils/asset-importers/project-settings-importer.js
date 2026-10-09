"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSettingsImporter = void 0;
class ProjectSettingsImporter {
    get name() {
        return 'project-settings';
    }
    get className() {
        return 'ProjectSettings';
    }
    async getProperties(assetInfo) {
        try {
            // Get actual config
            const projectConfig = await Editor.Message.request('project', 'query-config', 'project') || {};
            // Build manual properties
            return this.buildProperties(projectConfig);
        }
        catch (e) {
            console.warn('[ProjectSettingsImporter] Failed to query project settings:', e);
            return {};
        }
    }
    async setProperty(assetInfo, path, value) {
        try {
            // Handle Custom Layers
            if (path.startsWith('customLayers')) {
                return this.setLayerProperty(path, value);
            }
            // Handle Sorting Layers
            if (path.startsWith('sortingLayers')) {
                return this.setSortingLayerProperty(path, value);
            }
            // Handle Physics Collision Groups
            if (path.startsWith('physics.collisionGroups')) {
                return this.setCollisionGroupProperty(path, value);
            }
            // Handle General Settings
            if (path.startsWith('general')) {
                return this.setGeneralProperty(path, value);
            }
            // Handle Default Material (Reference Unwrap)
            if (path === 'physics.defaultMaterial' && value && typeof value === 'object' && value.uuid) {
                value = value.uuid;
            }
            // Handle Collision Matrix (Object vs Array)
            // If path is physics.collisionMatrix.5, it maps to physics.collisionMatrix["5"] which is fine.
            await Editor.Message.request('project', 'set-config', 'project', path, value);
            return true;
        }
        catch (e) {
            console.warn('[ProjectSettingsImporter] Failed to set project settings:', e);
            return false;
        }
    }
    async setGeneralProperty(path, value) {
        const config = await Editor.Message.request('project', 'query-config', 'project');
        const general = config.general || {};
        const parts = path.split('.');
        const key = parts[1];
        if (key === 'designResolution') {
            // sub-properties: general.designResolution.width
            if (parts.length === 3) {
                const subKey = parts[2];
                general.designResolution[subKey] = value;
            }
            else {
                // general.designResolution (Replace size values)
                if (value && typeof value === 'object') {
                    if ('width' in value)
                        general.designResolution.width = value.width;
                    if ('height' in value)
                        general.designResolution.height = value.height;
                }
            }
        }
        else if (key === 'fitWidth' || key === 'fitHeight') {
            general.designResolution[key] = value;
        }
        else {
            general[key] = value;
        }
        await Editor.Message.request('project', 'set-config', 'project', 'general', general);
        return true;
    }
    async setCollisionGroupProperty(path, value) {
        // path: physics.collisionGroups.0.name or physics.collisionGroups.0
        const parts = path.split('.');
        const indexStr = parts[2];
        if (!indexStr)
            return false;
        const index = parseInt(indexStr);
        if (isNaN(index))
            return false;
        const config = await Editor.Message.request('project', 'query-config', 'project');
        const physics = config.physics || {};
        const groups = physics.collisionGroups || [];
        let newName = "";
        if (typeof value === 'string')
            newName = value;
        else if (typeof value === 'object' && value.name)
            newName = value.name;
        // Note: 'index' variable here refers to the ARRAY INDEX in the configuration list,
        // NOT the collision group index (1 << groupIndex).
        if (index < groups.length) {
            // Modification
            if (newName)
                groups[index].name = newName;
        }
        else if (index === groups.length) {
            // Creation: Find first available group index (0..31)
            const usedIndices = new Set(groups.map((g) => g.index));
            // Usually 0 is Default.
            if (!usedIndices.has(0))
                usedIndices.add(0); // Treat 0 as used usually
            let nextGroupIndex = 1;
            while (usedIndices.has(nextGroupIndex)) {
                nextGroupIndex++;
            }
            if (nextGroupIndex > 31) {
                console.warn('Max collision groups reached (32).');
                return false;
            }
            groups.push({
                index: nextGroupIndex,
                name: newName || `Group ${nextGroupIndex}`
            });
        }
        else {
            return false;
        }
        physics.collisionGroups = groups;
        await Editor.Message.request('project', 'set-config', 'project', 'physics', physics);
        return true;
    }
    async setSortingLayerProperty(path, value) {
        // path: sortingLayers.0 or sortingLayers.0.name
        const parts = path.split('.');
        const indexStr = parts[1];
        if (!indexStr)
            return false;
        const index = parseInt(indexStr);
        if (isNaN(index))
            return false;
        const config = await Editor.Message.request('project', 'query-config', 'project');
        const sortingInfo = config['sorting-layer'] || { layers: [], increaseId: 0 };
        const layers = sortingInfo.layers || [];
        // Determine what we are setting
        let patchData = {};
        if (parts.length === 2) {
            if (typeof value === 'string')
                patchData = { name: value };
            else
                patchData = value;
        }
        else if (parts.length === 3) {
            const field = parts[2];
            patchData[field] = value;
        }
        else {
            return false;
        }
        if (index < layers.length) {
            // Modification
            layers[index] = Object.assign(Object.assign({}, layers[index]), patchData);
        }
        else if (index === layers.length) {
            // Creation
            const newId = (sortingInfo.increaseId || 0) + 1;
            sortingInfo.increaseId = newId;
            let newValue = patchData.value;
            if (newValue === undefined) {
                const maxVal = layers.reduce((max, l) => (l.value !== undefined && l.value > max) ? l.value : max, -1);
                newValue = maxVal + 1;
            }
            const newLayer = {
                id: newId,
                name: patchData.name || `Layer ${newId}`,
                value: newValue
            };
            layers.push(newLayer);
        }
        else {
            return false;
        }
        sortingInfo.layers = layers;
        // Update the full sorting-layer object to ensure increaseId and set-config sync
        await Editor.Message.request('project', 'set-config', 'project', 'sorting-layer', sortingInfo);
        return true;
    }
    async setLayerProperty(path, value) {
        // parsing path: customLayers.0.name or customLayers.0
        const parts = path.split('.');
        const indexStr = parts[1];
        if (!indexStr)
            return false;
        const index = parseInt(indexStr);
        if (isNaN(index))
            return false;
        let newName = "";
        if (typeof value === 'string')
            newName = value;
        else if (typeof value === 'object' && value.name)
            newName = value.name;
        await Editor.Message.request('project', 'set-config', 'project', `layer.${index}`, { name: newName, value: 1 << (index + 1) });
        return true;
    }
    buildProperties(data) {
        const result = {};
        result['sortingLayers'] = {
            value: data && data['sorting-layer'] && data['sorting-layer'].layers ? this.buildSortingLayerProperties(data['sorting-layer'].layers) : [],
            extends: [],
            type: 'SortingLayerItem',
            isArray: true,
            tooltip: 'Sorting layers for sprites'
        };
        result['customLayers'] = {
            value: data && data.layer ? this.buildLayerProperties(data.layer) : [],
            extends: [],
            type: 'LayerItem',
            isArray: true,
            tooltip: 'User defined rendering layers'
        };
        result['physics'] = {
            value: data && data.physics ? this.buildPhysicsProperties(data.physics) : {},
            type: 'PhysicsSettings'
        };
        result['general'] = {
            value: data && data.general ? this.buildGeneralProperties(data.general) : {},
            type: 'GeneralSettings'
        };
        return result;
    }
    buildGeneralProperties(general) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const result = {};
        result['designResolution'] = {
            value: { width: (_b = (_a = general.designResolution) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 1280, height: (_d = (_c = general.designResolution) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 720 },
            type: 'cc.Size',
            extends: ['cc.ValueType']
        };
        result['fitWidth'] = { value: (_f = (_e = general.designResolution) === null || _e === void 0 ? void 0 : _e.fitWidth) !== null && _f !== void 0 ? _f : false, type: 'Boolean' };
        result['fitHeight'] = { value: (_h = (_g = general.designResolution) === null || _g === void 0 ? void 0 : _g.fitHeight) !== null && _h !== void 0 ? _h : false, type: 'Boolean' };
        result['downloadMaxConcurrency'] = { value: (_j = general.downloadMaxConcurrency) !== null && _j !== void 0 ? _j : 15, type: 'Integer', min: 1 };
        result['highQuality'] = { value: (_k = general.highQuality) !== null && _k !== void 0 ? _k : false, type: 'Boolean' };
        return result;
    }
    buildPhysicsProperties(physics) {
        const result = {};
        // Simple props
        const props = [
            { key: 'allowSleep', type: 'Boolean' },
            { key: 'autoSimulation', type: 'Boolean' },
            { key: 'sleepThreshold', type: 'Float' },
            { key: 'fixedTimeStep', type: 'Float', options: { min: 0 } },
            { key: 'maxSubSteps', type: 'Integer', options: { min: 1 } },
        ];
        for (const p of props) {
            if (p.key in physics) {
                result[p.key] = Object.assign({ value: physics[p.key], type: p.type }, p.options);
            }
        }
        if (physics.gravity) {
            result['gravity'] = { value: physics.gravity, type: 'cc.Vec3', extends: ['cc.ValueType'] };
        }
        result['defaultMaterial'] = {
            value: physics.defaultMaterial ? { uuid: physics.defaultMaterial } : null,
            type: 'cc.PhysicsMaterial',
            extends: ['cc.Object']
        };
        // Collision Groups
        const groups = physics.collisionGroups || [];
        result['collisionGroups'] = {
            value: groups.map((g) => ({
                value: {
                    index: { value: g.index, type: 'Integer', readonly: true },
                    name: { value: g.name, type: 'String' }
                },
                type: 'CollisionGroupItem'
            })),
            type: 'CollisionGroupItem',
            isArray: true,
            elementTypeData: {
                type: 'CollisionGroupItem',
                value: {
                    index: { value: 0, type: 'Integer', readonly: true },
                    name: { value: '', type: 'String' }
                }
            }
        };
        // Collision Matrix
        const bitmaskList = [];
        // Default group 0
        const defaultGroup = groups.find((g) => g.index === 0);
        bitmaskList.push({ name: defaultGroup ? defaultGroup.name : 'DEFAULT', value: 1 << 0 });
        for (const g of groups) {
            if (g.index !== 0) {
                bitmaskList.push({ name: g.name, value: 1 << g.index });
            }
        }
        const matrixObj = physics.collisionMatrix || {};
        const matrixArr = [];
        // Calculate max index to display
        const indices = [0, ...groups.map((g) => g.index), ...Object.keys(matrixObj).map(k => parseInt(k))];
        const maxIndex = Math.max(...indices);
        for (let i = 0; i <= maxIndex; i++) {
            matrixArr.push({
                value: matrixObj[i] || 0,
                type: 'BitMask',
                bitmaskList: bitmaskList
            });
        }
        result['collisionMatrix'] = {
            value: matrixArr,
            type: 'BitMask',
            isArray: true,
            elementTypeData: {
                type: 'BitMask',
                value: 0,
                bitmaskList: bitmaskList
            }
        };
        return result;
    }
    buildSortingLayerProperties(layers) {
        return layers.map(layer => ({
            extends: [],
            value: {
                id: {
                    value: layer.id,
                    type: 'Integer',
                    readonly: true
                },
                name: {
                    value: layer.name,
                    type: 'String'
                },
                value: {
                    value: layer.value,
                    type: 'Integer'
                }
            },
            type: 'SortingLayerItem'
        }));
    }
    buildLayerProperties(layers) {
        return layers.map(layer => ({
            extends: [],
            value: {
                name: {
                    value: layer.name,
                    type: 'String'
                },
                value: {
                    value: layer.value,
                    type: 'Integer',
                    readonly: true
                }
            },
            type: 'LayerItem'
        }));
    }
}
exports.ProjectSettingsImporter = ProjectSettingsImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvamVjdC1zZXR0aW5ncy1pbXBvcnRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NvdXJjZS91dGNwL3V0aWxzL2Fzc2V0LWltcG9ydGVycy9wcm9qZWN0LXNldHRpbmdzLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQU1BLE1BQWEsdUJBQXVCO0lBQ2hDLElBQUksSUFBSTtRQUNKLE9BQU8sa0JBQWtCLENBQUM7SUFDOUIsQ0FBQztJQUVELElBQUksU0FBUztRQUNULE9BQU8saUJBQWlCLENBQUM7SUFDN0IsQ0FBQztJQUVELEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBb0I7UUFDcEMsSUFBSSxDQUFDO1lBQ0Qsb0JBQW9CO1lBQ3BCLE1BQU0sYUFBYSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLGNBQWMsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUM7WUFFL0YsMEJBQTBCO1lBQzFCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNULE9BQU8sQ0FBQyxJQUFJLENBQUMsNkRBQTZELEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDL0UsT0FBTyxFQUFFLENBQUM7UUFDZCxDQUFDO0lBQ0wsQ0FBQztJQUVELEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBb0IsRUFBRSxJQUFZLEVBQUUsS0FBVTtRQUM1RCxJQUFJLENBQUM7WUFDRCx1QkFBdUI7WUFDdkIsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM5QyxDQUFDO1lBRUQsd0JBQXdCO1lBQ3hCLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsRUFB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QUNwQixDQUFDLENBQUMsQ0FBQztJQUNSLENBQUM7Q0FDSjtBQXBZRCwwREFvWUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJQXNzZXRJbXBvcnRlciB9IGZyb20gJy4vYmFzZS1pbXBvcnRlcic7XG5pbXBvcnQgeyBBc3NldEluZm8gfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvYXNzZXQtZGIvQHR5cGVzL3B1YmxpYyc7XG5pbXBvcnQgeyBJUHJvcGVydHlWYWx1ZVR5cGUgfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvc2NlbmUvQHR5cGVzL3B1YmxpYyc7XG5cbmRlY2xhcmUgY29uc3QgRWRpdG9yOiBhbnk7XG5cbmV4cG9ydCBjbGFzcyBQcm9qZWN0U2V0dGluZ3NJbXBvcnRlciBpbXBsZW1lbnRzIElBc3NldEltcG9ydGVyIHtcbiAgICBnZXQgbmFtZSgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gJ3Byb2plY3Qtc2V0dGluZ3MnO1xuICAgIH1cblxuICAgIGdldCBjbGFzc05hbWUoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuICdQcm9qZWN0U2V0dGluZ3MnO1xuICAgIH1cblxuICAgIGFzeW5jIGdldFByb3BlcnRpZXMoYXNzZXRJbmZvOiBBc3NldEluZm8pOiBQcm9taXNlPHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5VmFsdWVUeXBlIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCBhY3R1YWwgY29uZmlnXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0Q29uZmlnID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJvamVjdCcsICdxdWVyeS1jb25maWcnLCAncHJvamVjdCcpIHx8IHt9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBCdWlsZCBtYW51YWwgcHJvcGVydGllc1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGRQcm9wZXJ0aWVzKHByb2plY3RDb25maWcpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1tQcm9qZWN0U2V0dGluZ3NJbXBvcnRlcl0gRmFpbGVkIHRvIHF1ZXJ5IHByb2plY3Qgc2V0dGluZ3M6JywgZSk7XG4gICAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzZXRQcm9wZXJ0eShhc3NldEluZm86IEFzc2V0SW5mbywgcGF0aDogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBIYW5kbGUgQ3VzdG9tIExheWVyc1xuICAgICAgICAgICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnY3VzdG9tTGF5ZXJzJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZXRMYXllclByb3BlcnR5KHBhdGgsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSGFuZGxlIFNvcnRpbmcgTGF5ZXJzXG4gICAgICAgICAgICBpZiAocGF0aC5zdGFydHNXaXRoKCdzb3J0aW5nTGF5ZXJzJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZXRTb3J0aW5nTGF5ZXJQcm9wZXJ0eShwYXRoLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEhhbmRsZSBQaHlzaWNzIENvbGxpc2lvbiBHcm91cHNcbiAgICAgICAgICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJ3BoeXNpY3MuY29sbGlzaW9uR3JvdXBzJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZXRDb2xsaXNpb25Hcm91cFByb3BlcnR5KHBhdGgsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSGFuZGxlIEdlbmVyYWwgU2V0dGluZ3NcbiAgICAgICAgICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJ2dlbmVyYWwnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnNldEdlbmVyYWxQcm9wZXJ0eShwYXRoLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEhhbmRsZSBEZWZhdWx0IE1hdGVyaWFsIChSZWZlcmVuY2UgVW53cmFwKVxuICAgICAgICAgICAgaWYgKHBhdGggPT09ICdwaHlzaWNzLmRlZmF1bHRNYXRlcmlhbCcgJiYgdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS51dWlkKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS51dWlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBIYW5kbGUgQ29sbGlzaW9uIE1hdHJpeCAoT2JqZWN0IHZzIEFycmF5KVxuICAgICAgICAgICAgLy8gSWYgcGF0aCBpcyBwaHlzaWNzLmNvbGxpc2lvbk1hdHJpeC41LCBpdCBtYXBzIHRvIHBoeXNpY3MuY29sbGlzaW9uTWF0cml4W1wiNVwiXSB3aGljaCBpcyBmaW5lLlxuXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3NldC1jb25maWcnLCAncHJvamVjdCcsIHBhdGgsIHZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1tQcm9qZWN0U2V0dGluZ3NJbXBvcnRlcl0gRmFpbGVkIHRvIHNldCBwcm9qZWN0IHNldHRpbmdzOicsIGUpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBwcml2YXRlIGFzeW5jIHNldEdlbmVyYWxQcm9wZXJ0eShwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgY29uc3QgY29uZmlnID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJvamVjdCcsICdxdWVyeS1jb25maWcnLCAncHJvamVjdCcpO1xuICAgICAgICBjb25zdCBnZW5lcmFsID0gY29uZmlnLmdlbmVyYWwgfHwge307XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcbiAgICAgICAgY29uc3Qga2V5ID0gcGFydHNbMV07XG4gICAgICAgIFxuICAgICAgICBpZiAoa2V5ID09PSAnZGVzaWduUmVzb2x1dGlvbicpIHtcbiAgICAgICAgICAgICAvLyBzdWItcHJvcGVydGllczogZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uLndpZHRoXG4gICAgICAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgICAgICBjb25zdCBzdWJLZXkgPSBwYXJ0c1syXTtcbiAgICAgICAgICAgICAgICAgZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uW3N1YktleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAvLyBnZW5lcmFsLmRlc2lnblJlc29sdXRpb24gKFJlcGxhY2Ugc2l6ZSB2YWx1ZXMpXG4gICAgICAgICAgICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICBpZiAoJ3dpZHRoJyBpbiB2YWx1ZSkgZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uLndpZHRoID0gdmFsdWUud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgICBpZiAoJ2hlaWdodCcgaW4gdmFsdWUpIGdlbmVyYWwuZGVzaWduUmVzb2x1dGlvbi5oZWlnaHQgPSB2YWx1ZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSAnZml0V2lkdGgnIHx8IGtleSA9PT0gJ2ZpdEhlaWdodCcpIHtcbiAgICAgICAgICAgICBnZW5lcmFsLmRlc2lnblJlc29sdXRpb25ba2V5XSA9IHZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgIGdlbmVyYWxba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3NldC1jb25maWcnLCAncHJvamVjdCcsICdnZW5lcmFsJywgZ2VuZXJhbCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Q29sbGlzaW9uR3JvdXBQcm9wZXJ0eShwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgLy8gcGF0aDogcGh5c2ljcy5jb2xsaXNpb25Hcm91cHMuMC5uYW1lIG9yIHBoeXNpY3MuY29sbGlzaW9uR3JvdXBzLjBcbiAgICAgICAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgICAgIGNvbnN0IGluZGV4U3RyID0gcGFydHNbMl07XG4gICAgICAgIGlmICghaW5kZXhTdHIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgaW5kZXggPSBwYXJzZUludChpbmRleFN0cik7XG4gICAgICAgIGlmIChpc05hTihpbmRleCkpIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCBjb25maWcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3F1ZXJ5LWNvbmZpZycsICdwcm9qZWN0Jyk7XG4gICAgICAgIGNvbnN0IHBoeXNpY3MgPSBjb25maWcucGh5c2ljcyB8fCB7fTtcbiAgICAgICAgY29uc3QgZ3JvdXBzID0gcGh5c2ljcy5jb2xsaXNpb25Hcm91cHMgfHwgW107XG5cbiAgICAgICAgbGV0IG5ld05hbWUgPSBcIlwiO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgbmV3TmFtZSA9IHZhbHVlO1xuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLm5hbWUpIG5ld05hbWUgPSB2YWx1ZS5uYW1lO1xuXG4gICAgICAgIC8vIE5vdGU6ICdpbmRleCcgdmFyaWFibGUgaGVyZSByZWZlcnMgdG8gdGhlIEFSUkFZIElOREVYIGluIHRoZSBjb25maWd1cmF0aW9uIGxpc3QsXG4gICAgICAgIC8vIE5PVCB0aGUgY29sbGlzaW9uIGdyb3VwIGluZGV4ICgxIDw8IGdyb3VwSW5kZXgpLlxuICAgICAgICBcbiAgICAgICAgaWYgKGluZGV4IDwgZ3JvdXBzLmxlbmd0aCkge1xuICAgICAgICAgICAgIC8vIE1vZGlmaWNhdGlvblxuICAgICAgICAgICAgIGlmIChuZXdOYW1lKSBncm91cHNbaW5kZXhdLm5hbWUgPSBuZXdOYW1lO1xuICAgICAgICB9IGVsc2UgaWYgKGluZGV4ID09PSBncm91cHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgLy8gQ3JlYXRpb246IEZpbmQgZmlyc3QgYXZhaWxhYmxlIGdyb3VwIGluZGV4ICgwLi4zMSlcbiAgICAgICAgICAgICBjb25zdCB1c2VkSW5kaWNlcyA9IG5ldyBTZXQoZ3JvdXBzLm1hcCgoZzogYW55KSA9PiBnLmluZGV4KSk7XG4gICAgICAgICAgICAgLy8gVXN1YWxseSAwIGlzIERlZmF1bHQuXG4gICAgICAgICAgICAgaWYgKCF1c2VkSW5kaWNlcy5oYXMoMCkpIHVzZWRJbmRpY2VzLmFkZCgwKTsgLy8gVHJlYXQgMCBhcyB1c2VkIHVzdWFsbHlcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICBsZXQgbmV4dEdyb3VwSW5kZXggPSAxO1xuICAgICAgICAgICAgIHdoaWxlICh1c2VkSW5kaWNlcy5oYXMobmV4dEdyb3VwSW5kZXgpKSB7XG4gICAgICAgICAgICAgICAgIG5leHRHcm91cEluZGV4Kys7XG4gICAgICAgICAgICAgfVxuICAgICAgICAgICAgIFxuICAgICAgICAgICAgIGlmIChuZXh0R3JvdXBJbmRleCA+IDMxKSB7XG4gICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignTWF4IGNvbGxpc2lvbiBncm91cHMgcmVhY2hlZCAoMzIpLicpO1xuICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgZ3JvdXBzLnB1c2goe1xuICAgICAgICAgICAgICAgICBpbmRleDogbmV4dEdyb3VwSW5kZXgsXG4gICAgICAgICAgICAgICAgIG5hbWU6IG5ld05hbWUgfHwgYEdyb3VwICR7bmV4dEdyb3VwSW5kZXh9YFxuICAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcGh5c2ljcy5jb2xsaXNpb25Hcm91cHMgPSBncm91cHM7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAnc2V0LWNvbmZpZycsICdwcm9qZWN0JywgJ3BoeXNpY3MnLCBwaHlzaWNzKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRTb3J0aW5nTGF5ZXJQcm9wZXJ0eShwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgLy8gcGF0aDogc29ydGluZ0xheWVycy4wIG9yIHNvcnRpbmdMYXllcnMuMC5uYW1lXG4gICAgICAgIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuICAgICAgICBjb25zdCBpbmRleFN0ciA9IHBhcnRzWzFdO1xuICAgICAgICBpZiAoIWluZGV4U3RyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gcGFyc2VJbnQoaW5kZXhTdHIpO1xuICAgICAgICBpZiAoaXNOYU4oaW5kZXgpKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgY29uZmlnID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJvamVjdCcsICdxdWVyeS1jb25maWcnLCAncHJvamVjdCcpO1xuICAgICAgICBjb25zdCBzb3J0aW5nSW5mbyA9IGNvbmZpZ1snc29ydGluZy1sYXllciddIHx8IHsgbGF5ZXJzOiBbXSwgaW5jcmVhc2VJZDogMCB9O1xuICAgICAgICBjb25zdCBsYXllcnMgPSBzb3J0aW5nSW5mby5sYXllcnMgfHwgW107XG5cbiAgICAgICAgLy8gRGV0ZXJtaW5lIHdoYXQgd2UgYXJlIHNldHRpbmdcbiAgICAgICAgbGV0IHBhdGNoRGF0YTogYW55ID0ge307XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcGF0Y2hEYXRhID0geyBuYW1lOiB2YWx1ZSB9O1xuICAgICAgICAgICAgIGVsc2UgcGF0Y2hEYXRhID0gdmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAocGFydHMubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICAgY29uc3QgZmllbGQgPSBwYXJ0c1syXTtcbiAgICAgICAgICAgICBwYXRjaERhdGFbZmllbGRdID0gdmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5kZXggPCBsYXllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgLy8gTW9kaWZpY2F0aW9uXG4gICAgICAgICAgICAgbGF5ZXJzW2luZGV4XSA9IHsgLi4ubGF5ZXJzW2luZGV4XSwgLi4ucGF0Y2hEYXRhIH07XG4gICAgICAgIH0gZWxzZSBpZiAoaW5kZXggPT09IGxheWVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAvLyBDcmVhdGlvblxuICAgICAgICAgICAgIGNvbnN0IG5ld0lkID0gKHNvcnRpbmdJbmZvLmluY3JlYXNlSWQgfHwgMCkgKyAxO1xuICAgICAgICAgICAgIHNvcnRpbmdJbmZvLmluY3JlYXNlSWQgPSBuZXdJZDtcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICBsZXQgbmV3VmFsdWUgPSBwYXRjaERhdGEudmFsdWU7XG4gICAgICAgICAgICAgaWYgKG5ld1ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgY29uc3QgbWF4VmFsID0gbGF5ZXJzLnJlZHVjZSgobWF4OiBudW1iZXIsIGw6IGFueSkgPT4gKGwudmFsdWUgIT09IHVuZGVmaW5lZCAmJiBsLnZhbHVlID4gbWF4KSA/IGwudmFsdWUgOiBtYXgsIC0xKTtcbiAgICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBtYXhWYWwgKyAxO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICBjb25zdCBuZXdMYXllciA9IHtcbiAgICAgICAgICAgICAgICAgaWQ6IG5ld0lkLFxuICAgICAgICAgICAgICAgICBuYW1lOiBwYXRjaERhdGEubmFtZSB8fCBgTGF5ZXIgJHtuZXdJZH1gLFxuICAgICAgICAgICAgICAgICB2YWx1ZTogbmV3VmFsdWVcbiAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgIGxheWVycy5wdXNoKG5ld0xheWVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgc29ydGluZ0luZm8ubGF5ZXJzID0gbGF5ZXJzO1xuICAgICAgICAvLyBVcGRhdGUgdGhlIGZ1bGwgc29ydGluZy1sYXllciBvYmplY3QgdG8gZW5zdXJlIGluY3JlYXNlSWQgYW5kIHNldC1jb25maWcgc3luY1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3NldC1jb25maWcnLCAncHJvamVjdCcsICdzb3J0aW5nLWxheWVyJywgc29ydGluZ0luZm8pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldExheWVyUHJvcGVydHkocGF0aDogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIC8vIHBhcnNpbmcgcGF0aDogY3VzdG9tTGF5ZXJzLjAubmFtZSBvciBjdXN0b21MYXllcnMuMFxuICAgICAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcbiAgICAgICAgY29uc3QgaW5kZXhTdHIgPSBwYXJ0c1sxXTtcbiAgICAgICAgaWYgKCFpbmRleFN0cikgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBpbmRleCA9IHBhcnNlSW50KGluZGV4U3RyKTtcbiAgICAgICAgaWYgKGlzTmFOKGluZGV4KSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBcbiAgICAgICAgbGV0IG5ld05hbWUgPSBcIlwiO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgbmV3TmFtZSA9IHZhbHVlO1xuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLm5hbWUpIG5ld05hbWUgPSB2YWx1ZS5uYW1lO1xuXG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAnc2V0LWNvbmZpZycsICdwcm9qZWN0JywgYGxheWVyLiR7aW5kZXh9YCwgeyBuYW1lOiBuZXdOYW1lLCB2YWx1ZTogMSA8PCAoaW5kZXggKyAxKSB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBidWlsZFByb3BlcnRpZXMoZGF0YTogYW55KTogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSA9IHt9O1xuXG4gICAgICAgIHJlc3VsdFsnc29ydGluZ0xheWVycyddID0ge1xuICAgICAgICAgICAgdmFsdWU6IGRhdGEgJiYgZGF0YVsnc29ydGluZy1sYXllciddICYmIGRhdGFbJ3NvcnRpbmctbGF5ZXInXS5sYXllcnMgPyB0aGlzLmJ1aWxkU29ydGluZ0xheWVyUHJvcGVydGllcyhkYXRhWydzb3J0aW5nLWxheWVyJ10ubGF5ZXJzKSA6IFtdLFxuICAgICAgICAgICAgZXh0ZW5kczogW10sXG4gICAgICAgICAgICB0eXBlOiAnU29ydGluZ0xheWVySXRlbScsXG4gICAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgICAgdG9vbHRpcDogJ1NvcnRpbmcgbGF5ZXJzIGZvciBzcHJpdGVzJ1xuICAgICAgICB9O1xuXG4gICAgICAgIHJlc3VsdFsnY3VzdG9tTGF5ZXJzJ10gPSB7XG4gICAgICAgICAgICB2YWx1ZTogZGF0YSAmJiBkYXRhLmxheWVyID8gdGhpcy5idWlsZExheWVyUHJvcGVydGllcyhkYXRhLmxheWVyKSA6IFtdLFxuICAgICAgICAgICAgZXh0ZW5kczogW10sXG4gICAgICAgICAgICB0eXBlOiAnTGF5ZXJJdGVtJyxcbiAgICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgICB0b29sdGlwOiAnVXNlciBkZWZpbmVkIHJlbmRlcmluZyBsYXllcnMnXG4gICAgICAgIH07XG5cbiAgICAgICAgcmVzdWx0WydwaHlzaWNzJ10gPSB7XG4gICAgICAgICAgICB2YWx1ZTogZGF0YSAmJiBkYXRhLnBoeXNpY3MgPyB0aGlzLmJ1aWxkUGh5c2ljc1Byb3BlcnRpZXMoZGF0YS5waHlzaWNzKSA6IHt9LFxuICAgICAgICAgICAgdHlwZTogJ1BoeXNpY3NTZXR0aW5ncydcbiAgICAgICAgfTtcblxuICAgICAgICByZXN1bHRbJ2dlbmVyYWwnXSA9IHtcbiAgICAgICAgICAgIHZhbHVlOiBkYXRhICYmIGRhdGEuZ2VuZXJhbCA/IHRoaXMuYnVpbGRHZW5lcmFsUHJvcGVydGllcyhkYXRhLmdlbmVyYWwpIDoge30sXG4gICAgICAgICAgICB0eXBlOiAnR2VuZXJhbFNldHRpbmdzJ1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkR2VuZXJhbFByb3BlcnRpZXMoZ2VuZXJhbDogYW55KTogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSA9IHt9O1xuICAgICAgICBcbiAgICAgICAgcmVzdWx0WydkZXNpZ25SZXNvbHV0aW9uJ10gPSB7XG4gICAgICAgICAgICB2YWx1ZTogeyB3aWR0aDogZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uPy53aWR0aCA/PyAxMjgwLCBoZWlnaHQ6IGdlbmVyYWwuZGVzaWduUmVzb2x1dGlvbj8uaGVpZ2h0ID8/IDcyMCB9LFxuICAgICAgICAgICAgdHlwZTogJ2NjLlNpemUnLFxuICAgICAgICAgICAgZXh0ZW5kczogWydjYy5WYWx1ZVR5cGUnXVxuICAgICAgICB9O1xuICAgICAgICByZXN1bHRbJ2ZpdFdpZHRoJ10gPSB7IHZhbHVlOiBnZW5lcmFsLmRlc2lnblJlc29sdXRpb24/LmZpdFdpZHRoID8/IGZhbHNlLCB0eXBlOiAnQm9vbGVhbicgfTtcbiAgICAgICAgcmVzdWx0WydmaXRIZWlnaHQnXSA9IHsgdmFsdWU6IGdlbmVyYWwuZGVzaWduUmVzb2x1dGlvbj8uZml0SGVpZ2h0ID8/IGZhbHNlLCB0eXBlOiAnQm9vbGVhbicgfTtcblxuICAgICAgICByZXN1bHRbJ2Rvd25sb2FkTWF4Q29uY3VycmVuY3knXSA9IHsgdmFsdWU6IGdlbmVyYWwuZG93bmxvYWRNYXhDb25jdXJyZW5jeSA/PyAxNSwgdHlwZTogJ0ludGVnZXInLCBtaW46IDEgfTtcbiAgICAgICAgcmVzdWx0WydoaWdoUXVhbGl0eSddID0geyB2YWx1ZTogZ2VuZXJhbC5oaWdoUXVhbGl0eSA/PyBmYWxzZSwgdHlwZTogJ0Jvb2xlYW4nIH07XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkUGh5c2ljc1Byb3BlcnRpZXMocGh5c2ljczogYW55KTogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSA9IHt9O1xuICAgICAgICBcbiAgICAgICAgLy8gU2ltcGxlIHByb3BzXG4gICAgICAgIGNvbnN0IHByb3BzID0gW1xuICAgICAgICAgICAgeyBrZXk6ICdhbGxvd1NsZWVwJywgdHlwZTogJ0Jvb2xlYW4nIH0sXG4gICAgICAgICAgICB7IGtleTogJ2F1dG9TaW11bGF0aW9uJywgdHlwZTogJ0Jvb2xlYW4nIH0sXG4gICAgICAgICAgICB7IGtleTogJ3NsZWVwVGhyZXNob2xkJywgdHlwZTogJ0Zsb2F0JyB9LFxuICAgICAgICAgICAgeyBrZXk6ICdmaXhlZFRpbWVTdGVwJywgdHlwZTogJ0Zsb2F0Jywgb3B0aW9uczogeyBtaW46IDAgfSB9LFxuICAgICAgICAgICAgeyBrZXk6ICdtYXhTdWJTdGVwcycsIHR5cGU6ICdJbnRlZ2VyJywgb3B0aW9uczogeyBtaW46IDEgfSB9LFxuICAgICAgICBdO1xuXG4gICAgICAgIGZvciAoY29uc3QgcCBvZiBwcm9wcykge1xuICAgICAgICAgICAgaWYgKHAua2V5IGluIHBoeXNpY3MpIHtcbiAgICAgICAgICAgICAgICAgcmVzdWx0W3Aua2V5XSA9IHsgdmFsdWU6IHBoeXNpY3NbcC5rZXldLCB0eXBlOiBwLnR5cGUsIC4uLnAub3B0aW9ucyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAocGh5c2ljcy5ncmF2aXR5KSB7XG4gICAgICAgICAgICByZXN1bHRbJ2dyYXZpdHknXSA9IHsgdmFsdWU6IHBoeXNpY3MuZ3Jhdml0eSwgdHlwZTogJ2NjLlZlYzMnLCBleHRlbmRzOiBbJ2NjLlZhbHVlVHlwZScgXSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0WydkZWZhdWx0TWF0ZXJpYWwnXSA9IHsgXG4gICAgICAgICAgICB2YWx1ZTogcGh5c2ljcy5kZWZhdWx0TWF0ZXJpYWwgPyB7IHV1aWQ6IHBoeXNpY3MuZGVmYXVsdE1hdGVyaWFsIH0gOiBudWxsLFxuICAgICAgICAgICAgdHlwZTogJ2NjLlBoeXNpY3NNYXRlcmlhbCcsIFxuICAgICAgICAgICAgZXh0ZW5kczogWydjYy5PYmplY3QnXSBcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDb2xsaXNpb24gR3JvdXBzXG4gICAgICAgIGNvbnN0IGdyb3VwcyA9IHBoeXNpY3MuY29sbGlzaW9uR3JvdXBzIHx8IFtdO1xuICAgICAgICByZXN1bHRbJ2NvbGxpc2lvbkdyb3VwcyddID0ge1xuICAgICAgICAgICAgIHZhbHVlOiBncm91cHMubWFwKChnOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgICAgICBpbmRleDogeyB2YWx1ZTogZy5pbmRleCwgdHlwZTogJ0ludGVnZXInLCByZWFkb25seTogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB2YWx1ZTogZy5uYW1lLCB0eXBlOiAnU3RyaW5nJyB9XG4gICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgIHR5cGU6ICdDb2xsaXNpb25Hcm91cEl0ZW0nXG4gICAgICAgICAgICAgfSkpLFxuICAgICAgICAgICAgIHR5cGU6ICdDb2xsaXNpb25Hcm91cEl0ZW0nLFxuICAgICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgICAgZWxlbWVudFR5cGVEYXRhOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ0NvbGxpc2lvbkdyb3VwSXRlbScsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHsgdmFsdWU6IDAsIHR5cGU6ICdJbnRlZ2VyJywgcmVhZG9ubHk6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB2YWx1ZTogJycsIHR5cGU6ICdTdHJpbmcnIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENvbGxpc2lvbiBNYXRyaXhcbiAgICAgICAgY29uc3QgYml0bWFza0xpc3Q6IHsgbmFtZTogc3RyaW5nLCB2YWx1ZTogbnVtYmVyIH1bXSA9IFtdO1xuICAgICAgICAvLyBEZWZhdWx0IGdyb3VwIDBcbiAgICAgICAgY29uc3QgZGVmYXVsdEdyb3VwID0gZ3JvdXBzLmZpbmQoKGc6IGFueSkgPT4gZy5pbmRleCA9PT0gMCk7XG4gICAgICAgIGJpdG1hc2tMaXN0LnB1c2goeyBuYW1lOiBkZWZhdWx0R3JvdXAgPyBkZWZhdWx0R3JvdXAubmFtZSA6ICdERUZBVUxUJywgdmFsdWU6IDEgPDwgMCB9KTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgZyBvZiBncm91cHMpIHtcbiAgICAgICAgICAgIGlmIChnLmluZGV4ICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgIGJpdG1hc2tMaXN0LnB1c2goeyBuYW1lOiBnLm5hbWUsIHZhbHVlOiAxIDw8IGcuaW5kZXggfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYXRyaXhPYmogPSBwaHlzaWNzLmNvbGxpc2lvbk1hdHJpeCB8fCB7fTtcbiAgICAgICAgY29uc3QgbWF0cml4QXJyID0gW107XG4gICAgICAgIC8vIENhbGN1bGF0ZSBtYXggaW5kZXggdG8gZGlzcGxheVxuICAgICAgICBjb25zdCBpbmRpY2VzID0gWzAsIC4uLmdyb3Vwcy5tYXAoKGc6IGFueSkgPT4gZy5pbmRleCksIC4uLk9iamVjdC5rZXlzKG1hdHJpeE9iaikubWFwKGsgPT4gcGFyc2VJbnQoaykpXTtcbiAgICAgICAgY29uc3QgbWF4SW5kZXggPSBNYXRoLm1heCguLi5pbmRpY2VzKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IG1heEluZGV4OyBpKyspIHtcbiAgICAgICAgICAgIG1hdHJpeEFyci5wdXNoKHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogbWF0cml4T2JqW2ldIHx8IDAsXG4gICAgICAgICAgICAgICAgdHlwZTogJ0JpdE1hc2snLFxuICAgICAgICAgICAgICAgIGJpdG1hc2tMaXN0OiBiaXRtYXNrTGlzdFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHRbJ2NvbGxpc2lvbk1hdHJpeCddID0ge1xuICAgICAgICAgICAgdmFsdWU6IG1hdHJpeEFycixcbiAgICAgICAgICAgIHR5cGU6ICdCaXRNYXNrJyxcbiAgICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgICBlbGVtZW50VHlwZURhdGE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnQml0TWFzaycsXG4gICAgICAgICAgICAgICAgdmFsdWU6IDAsXG4gICAgICAgICAgICAgICAgYml0bWFza0xpc3Q6IGJpdG1hc2tMaXN0XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkU29ydGluZ0xheWVyUHJvcGVydGllcyhsYXllcnM6IEFycmF5PHsgaWQ6IG51bWJlciwgbmFtZTogc3RyaW5nLCB2YWx1ZTogbnVtYmVyIH0+KTogQXJyYXk8SVByb3BlcnR5VmFsdWVUeXBlPiB7XG4gICAgICAgIHJldHVybiBsYXllcnMubWFwKGxheWVyID0+ICh7XG4gICAgICAgICAgICBleHRlbmRzOiBbXSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgaWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGxheWVyLmlkLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSW50ZWdlcicsXG4gICAgICAgICAgICAgICAgICAgIHJlYWRvbmx5OiB0cnVlXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBuYW1lOiB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBsYXllci5uYW1lLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnU3RyaW5nJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGxheWVyLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSW50ZWdlcidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHlwZTogJ1NvcnRpbmdMYXllckl0ZW0nXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkTGF5ZXJQcm9wZXJ0aWVzKGxheWVyczogQXJyYXk8eyBuYW1lOiBzdHJpbmcsIHZhbHVlOiBudW1iZXIgfT4pOiBBcnJheTxJUHJvcGVydHlWYWx1ZVR5cGU+IHtcbiAgICAgICAgIHJldHVybiBsYXllcnMubWFwKGxheWVyID0+ICh7XG4gICAgICAgICAgICBleHRlbmRzOiBbXSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgbmFtZToge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogbGF5ZXIubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ1N0cmluZydcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBsYXllci52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0ludGVnZXInLFxuICAgICAgICAgICAgICAgICAgICByZWFkb25seTogdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0eXBlOiAnTGF5ZXJJdGVtJ1xuICAgICAgICB9KSk7XG4gICAgfVxufVxuIl19