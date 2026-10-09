"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialImporter = void 0;
const base_importer_1 = require("./base-importer");
class MaterialImporter extends base_importer_1.BaseAssetImporter {
    constructor() {
        super(...arguments);
        this.name = 'material';
    }
    async getProperties(assetInfo) {
        var _a;
        const materialDump = await Editor.Message.request('scene', 'query-material', assetInfo.uuid);
        if (!materialDump) {
            throw new Error('Material dump not found');
        }
        const propertyContainer = {};
        // Get Effect Info
        const collator = new Intl.Collator(undefined, { numeric: true });
        const effects = Object.values(await Editor.Message.request('scene', 'query-all-effects'))
            .filter((effect) => !effect.hideInEditor)
            .sort((a, b) => collator.compare(a.name, b.name));
        let effectName = (_a = materialDump.effect) !== null && _a !== void 0 ? _a : 'builtin-standard';
        propertyContainer['effect'] = {
            value: effectName,
            type: 'Enum',
            userData: { enumName: 'MaterialEffectAssetName' },
            enumList: effects.map((effect) => ({ name: effect.name.replace('../', ''), value: effect.name })),
            visible: true,
            readonly: false
        };
        if (materialDump.data) {
            const techniqueOptions = materialDump.data.map((t, i) => ({ name: t.name || i.toString(), value: i }));
            propertyContainer['technique'] = {
                value: materialDump.technique,
                type: 'Enum',
                enumList: techniqueOptions,
                visible: true,
                readonly: false
            };
            const currentTechniqueIndex = materialDump.technique || 0;
            const currentTechnique = materialDump.data[currentTechniqueIndex];
            if (currentTechnique && currentTechnique.passes) {
                const passes = [];
                function checkDefineVisibility(defines, defineMap) {
                    for (const def of defines) {
                        if (def.startsWith('!')) {
                            if (defineMap[def.substring(1)]) {
                                return false;
                            }
                        }
                        else {
                            if (!defineMap[def]) {
                                return false;
                            }
                        }
                    }
                    return true;
                }
                currentTechnique.passes.forEach((pass, passIndex) => {
                    const passProps = {};
                    // Create a map of defines for quick lookup
                    const defineMap = {};
                    if (pass.defines) {
                        // Prepare define map
                        pass.defines.forEach((def) => {
                            defineMap[def.name] = def.value;
                        });
                        // Process defines
                        pass.defines.forEach((def) => {
                            // Transform define type based on logic
                            let type = def.type;
                            let enumList = def.enumList;
                            switch (def.type) {
                                case 'Number':
                                    type = 'Enum';
                                    enumList = [];
                                    if (def.range && def.range.length >= 2) {
                                        for (let i = def.range[0]; i <= def.range[1]; i++) {
                                            enumList.push({ name: `Variant${i}`, value: i });
                                        }
                                    }
                                    break;
                                case 'String':
                                    type = 'Enum';
                                    enumList = [];
                                    if (def.options) {
                                        enumList = def.options.map((str) => ({ name: str, value: str }));
                                    }
                                    break;
                                case 'Enum':
                                    break;
                                default:
                                    type = 'Boolean';
                                    break;
                            }
                            const defProp = {
                                type: type,
                                extends: [],
                                value: def.value,
                                tooltip: def.tooltip,
                                enumList: enumList,
                                visible: checkDefineVisibility(def.defines || [], defineMap)
                            };
                            passProps[def.name] = defProp;
                        });
                    }
                    // Process properties
                    if (pass.props) {
                        pass.props.forEach((prop) => {
                            // Inject extends: ['cc.ValueType'] for known value types to prevent custom class generation
                            let extendsData = prop.extends || [];
                            if (['Vec2', 'Vec3', 'Vec4', 'Color', 'Rect', 'Size', 'Quat', 'Mat3', 'Mat4'].includes(prop.type)) {
                                if (!extendsData.includes('cc.ValueType')) {
                                    extendsData = [...extendsData, 'cc.ValueType'];
                                }
                            }
                            const valProp = Object.assign(Object.assign({}, prop), { displayName: prop.displayName || prop.name, visible: checkDefineVisibility(prop.defines || [], defineMap), extends: extendsData });
                            passProps[prop.name] = valProp;
                        });
                    }
                    const passHasProps = Object.keys(passProps).length > 0;
                    passProps['phase'] = {
                        extends: [],
                        type: 'String',
                        value: pass.phase || '',
                        visible: true,
                        readonly: true
                    };
                    passes.push({
                        extends: ['cc.MaterialPass'],
                        value: passProps,
                        type: `cc.MaterialPass${passHasProps ? passIndex : ''}`
                    });
                });
                const passesProp = {
                    value: passes,
                    type: 'cc.MaterialPasses',
                    visible: true
                };
                propertyContainer['passes'] = passesProp;
            }
        }
        return propertyContainer;
    }
    async setProperty(assetInfo, path, value) {
        // 1. Get the current material dump
        const materialDump = await Editor.Message.request('scene', 'query-material', assetInfo.uuid);
        if (!materialDump) {
            return false;
        }
        let handled = false;
        // 2. Handle simple root properties
        if (path === 'effectAsset' || path === 'effect') {
            const effects = await Editor.Message.request('scene', 'query-all-effects');
            if (value && value.name) {
                value = value.name;
            }
            if (typeof value === 'object' && 'uuid' in value) {
                value = value.uuid;
            }
            if (effects[value]) {
                value = effects[value].name;
                handled = true;
            }
            else {
                const effect = effects.find((eff) => eff.name === value);
                if (effect) {
                    value = effect.name;
                    handled = true;
                }
                else {
                    // Effect not found
                    throw new Error(`Effect '${value}' not found`);
                }
            }
        }
        else if (path === 'technique') {
            materialDump.technique = value;
            handled = true;
        }
        else {
            // 3. Handle data/props traversal
            const techniqueIndex = materialDump.technique || 0;
            const technique = materialDump.data[techniqueIndex];
            if (technique && technique.passes) {
                const parts = path.split('.');
                let targetPassIndices = [];
                let propPathParts = [];
                // Check for explicit pass path "passes.0.propName..."
                if (parts[0] === 'passes' && !isNaN(parseInt(parts[1]))) {
                    targetPassIndices = [parseInt(parts[1])];
                    propPathParts = parts.slice(2);
                }
                else {
                    // Implicit: Search all passes in current technique
                    targetPassIndices = technique.passes.map((_, i) => i);
                    propPathParts = parts;
                }
                if (propPathParts.length > 0) {
                    const propName = propPathParts[0];
                    const subProps = propPathParts.slice(1);
                    const setDeepProperty = (target, pathParts, val) => {
                        let current = target;
                        // Navigate to the parent of the target property
                        for (let i = 0; i < pathParts.length - 1; i++) {
                            const key = pathParts[i];
                            // 1. Try to access key directly
                            if (current[key] !== undefined) {
                                current = current[key];
                                continue;
                            }
                            // 2. Try to drill into .value (if current is a wrapper)
                            if (current.value && typeof current.value === 'object' && current.value[key] !== undefined) {
                                current = current.value[key];
                                continue;
                            }
                            // 3. Special case for arrays where we might be accessing by index but current is a wrapper
                            if (current.value && Array.isArray(current.value) && current.value[key] !== undefined) {
                                current = current.value[key];
                                continue;
                            }
                            // Path not found
                            return false;
                        }
                        const lastKey = pathParts[pathParts.length - 1];
                        // Helper to set on the final object
                        const setOnObject = (obj) => {
                            if (obj[lastKey] === undefined)
                                return false;
                            const targetProp = obj[lastKey];
                            // Check if the target is a Property Wrapper (Object with .value)
                            // We avoid Arrays or nulls
                            if (targetProp && typeof targetProp === 'object' && !Array.isArray(targetProp) && 'value' in targetProp) {
                                targetProp.value = val;
                            }
                            else {
                                // It's a raw value (primitive or struct without wrapper)
                                obj[lastKey] = val;
                            }
                            return true;
                        };
                        // 1. Try direct set
                        if (setOnObject(current))
                            return true;
                        // 2. Try set on .value (if wrapper)
                        if (current.value && typeof current.value === 'object') {
                            if (setOnObject(current.value))
                                return true;
                        }
                        return false;
                    };
                    targetPassIndices.forEach(passIndex => {
                        const pass = technique.passes[passIndex];
                        if (!pass)
                            return;
                        // 1. Search in props (Array)
                        if (pass.props) {
                            const prop = pass.props.find((p) => p.name === propName);
                            if (prop) {
                                if (subProps.length === 0) {
                                    if (typeof value === 'string' && prop.type &&
                                        (prop.type.toLowerCase().includes('texture') || prop.type.toLowerCase().includes('sampler'))) {
                                        prop.value = { uuid: value };
                                    }
                                    else {
                                        prop.value = value;
                                    }
                                    handled = true;
                                }
                                else {
                                    // Validate if prop.value is object for deep set
                                    if (prop.value && typeof prop.value === 'object') {
                                        if (setDeepProperty(prop, subProps, value)) {
                                            handled = true;
                                        }
                                    }
                                }
                            }
                        }
                        // 2. Search in defines (Array)
                        if (pass.defines) {
                            const define = pass.defines.find((d) => d.name === propName);
                            if (define) {
                                if (subProps.length === 0) {
                                    define.value = value;
                                    handled = true;
                                }
                            }
                        }
                        // 3. Search in states (Object)
                        if (pass.states && pass.states.value) {
                            // Check direct state property (e.g., "priority", "primitive")
                            if (pass.states.value[propName]) {
                                const stateProp = pass.states.value[propName];
                                if (subProps.length === 0) {
                                    stateProp.value = value;
                                    handled = true;
                                }
                                else {
                                    if (stateProp.value && typeof stateProp.value === 'object') {
                                        if (setDeepProperty(stateProp, subProps, value)) {
                                            handled = true;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
        // 4. Apply changes
        if (handled) {
            await Editor.Message.request('scene', 'apply-material', assetInfo.uuid, materialDump);
            Editor.Message.broadcast('material-inspector:change-dump');
            return true;
        }
        return false;
    }
}
exports.MaterialImporter = MaterialImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0ZXJpYWwtaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zb3VyY2UvdXRjcC91dGlscy9hc3NldC1pbXBvcnRlcnMvbWF0ZXJpYWwtaW1wb3J0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbURBQW9EO0FBSXBELE1BQWEsZ0JBQWlCLFNBQVEsaUNBQWlCO0lBQXZEOztRQUNJLFNBQUksR0FBRyxVQUFVLENBQUM7SUErVnRCLENBQUM7SUE3VkcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxTQUFjOztRQUM5QixNQUFNLFlBQVksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFN0YsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBRUQsTUFBTSxpQkFBaUIsR0FBaUMsRUFBRSxDQUFDO1FBRTNELGtCQUFrQjtRQUNsQixNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDakUsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO2FBQ3BGLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBRSxNQUFjLENBQUMsWUFBWSxDQUFDO2FBQ2pELElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUUsQ0FBUyxDQUFDLElBQUksRUFBRyxDQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztR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b0JBQ0wsQ0FBQyxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7UUFDTCxDQUFDO1FBRUQsbUJBQW1CO1FBQ25CLElBQUksT0FBTyxFQUFFLENBQUM7WUFDVCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ3RGLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7WUFDM0QsT0FBTyxJQUFJLENBQUM7UUFDakIsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7Q0FDSjtBQWhXRCw0Q0FnV0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQXNzZXRJbXBvcnRlciB9IGZyb20gJy4vYmFzZS1pbXBvcnRlcic7XG5pbXBvcnQgeyBJQXNzZXRJbmZvIH0gZnJvbSAnQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL2Fzc2V0LWRiL0B0eXBlcy9wdWJsaWMnO1xuaW1wb3J0IHsgSVByb3BlcnR5LCBJUHJvcGVydHlWYWx1ZVR5cGUgfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvc2NlbmUvQHR5cGVzL3B1YmxpYyc7XG5cbmV4cG9ydCBjbGFzcyBNYXRlcmlhbEltcG9ydGVyIGV4dGVuZHMgQmFzZUFzc2V0SW1wb3J0ZXIge1xuICAgIG5hbWUgPSAnbWF0ZXJpYWwnO1xuXG4gICAgYXN5bmMgZ2V0UHJvcGVydGllcyhhc3NldEluZm86IGFueSk6IFByb21pc2U8eyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfT4ge1xuICAgICAgICBjb25zdCBtYXRlcmlhbER1bXAgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1tYXRlcmlhbCcsIGFzc2V0SW5mby51dWlkKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghbWF0ZXJpYWxEdW1wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01hdGVyaWFsIGR1bXAgbm90IGZvdW5kJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcm9wZXJ0eUNvbnRhaW5lcjogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHkgfSA9IHt9O1xuXG4gICAgICAgIC8vIEdldCBFZmZlY3QgSW5mb1xuICAgICAgICBjb25zdCBjb2xsYXRvciA9IG5ldyBJbnRsLkNvbGxhdG9yKHVuZGVmaW5lZCwgeyBudW1lcmljOiB0cnVlIH0pO1xuICAgICAgICBjb25zdCBlZmZlY3RzID0gT2JqZWN0LnZhbHVlcyhhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1hbGwtZWZmZWN0cycpKVxuICAgICAgICAgICAgLmZpbHRlcigoZWZmZWN0KSA9PiAhKGVmZmVjdCBhcyBhbnkpLmhpZGVJbkVkaXRvcilcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBjb2xsYXRvci5jb21wYXJlKChhIGFzIGFueSkubmFtZSwgKGIgYXMgYW55KS5uYW1lKSk7XG5cbiAgICAgICAgbGV0IGVmZmVjdE5hbWUgPSBtYXRlcmlhbER1bXAuZWZmZWN0ID8/ICdidWlsdGluLXN0YW5kYXJkJztcblxuICAgICAgICBwcm9wZXJ0eUNvbnRhaW5lclsnZWZmZWN0J10gPSB7XG4gICAgICAgICAgICB2YWx1ZTogZWZmZWN0TmFtZSxcbiAgICAgICAgICAgIHR5cGU6ICdFbnVtJyxcbiAgICAgICAgICAgIHVzZXJEYXRhOiB7IGVudW1OYW1lOiAnTWF0ZXJpYWxFZmZlY3RBc3NldE5hbWUnIH0sXG4gICAgICAgICAgICBlbnVtTGlzdDogZWZmZWN0cy5tYXAoKGVmZmVjdDogYW55KSA9PiAoeyBuYW1lOiBlZmZlY3QubmFtZS5yZXBsYWNlKCcuLi8nLCAnJyksIHZhbHVlOiBlZmZlY3QubmFtZSB9KSksXG4gICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxuICAgICAgICAgICAgcmVhZG9ubHk6IGZhbHNlXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG1hdGVyaWFsRHVtcC5kYXRhKSB7XG4gICAgICAgICAgICBjb25zdCB0ZWNobmlxdWVPcHRpb25zID0gbWF0ZXJpYWxEdW1wLmRhdGEubWFwKCh0OiBhbnksIGk6IG51bWJlcikgPT4gKHsgbmFtZTogdC5uYW1lIHx8IGkudG9TdHJpbmcoKSwgdmFsdWU6IGkgfSkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBwcm9wZXJ0eUNvbnRhaW5lclsndGVjaG5pcXVlJ10gPSB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IG1hdGVyaWFsRHVtcC50ZWNobmlxdWUsXG4gICAgICAgICAgICAgICAgdHlwZTogJ0VudW0nLFxuICAgICAgICAgICAgICAgIGVudW1MaXN0OiB0ZWNobmlxdWVPcHRpb25zLFxuICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsXG4gICAgICAgICAgICAgICAgcmVhZG9ubHk6IGZhbHNlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50VGVjaG5pcXVlSW5kZXggPSBtYXRlcmlhbER1bXAudGVjaG5pcXVlIHx8IDA7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50VGVjaG5pcXVlID0gbWF0ZXJpYWxEdW1wLmRhdGFbY3VycmVudFRlY2huaXF1ZUluZGV4XTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGN1cnJlbnRUZWNobmlxdWUgJiYgY3VycmVudFRlY2huaXF1ZS5wYXNzZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXNzZXM6IGFueVtdID0gW107XG5cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBjaGVja0RlZmluZVZpc2liaWxpdHkoZGVmaW5lczogYW55W10sIGRlZmluZU1hcDogeyBba2V5OiBzdHJpbmddOiBhbnkgfSk6IGJvb2xlYW4ge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGRlZiBvZiBkZWZpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVmLnN0YXJ0c1dpdGgoJyEnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZWZpbmVNYXBbZGVmLnN1YnN0cmluZygxKV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkZWZpbmVNYXBbZGVmXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGN1cnJlbnRUZWNobmlxdWUucGFzc2VzLmZvckVhY2goKHBhc3M6IGFueSwgcGFzc0luZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFzc1Byb3BzOiB7IFtrZXk6c3RyaW5nXTogYW55IH0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBhIG1hcCBvZiBkZWZpbmVzIGZvciBxdWljayBsb29rdXBcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVmaW5lTWFwOiB7IFtrZXk6IHN0cmluZ106IGFueSB9ID0ge307XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAocGFzcy5kZWZpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQcmVwYXJlIGRlZmluZSBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhc3MuZGVmaW5lcy5mb3JFYWNoKChkZWY6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluZU1hcFtkZWYubmFtZV0gPSBkZWYudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUHJvY2VzcyBkZWZpbmVzXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXNzLmRlZmluZXMuZm9yRWFjaCgoZGVmOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUcmFuc2Zvcm0gZGVmaW5lIHR5cGUgYmFzZWQgb24gbG9naWNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdHlwZSA9IGRlZi50eXBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbnVtTGlzdCA9IGRlZi5lbnVtTGlzdDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZGVmLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnTnVtYmVyJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUgPSAnRW51bSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtTGlzdCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlZi5yYW5nZSAmJiBkZWYucmFuZ2UubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gZGVmLnJhbmdlWzBdOyBpIDw9IGRlZi5yYW5nZVsxXTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW1MaXN0LnB1c2goeyBuYW1lOiBgVmFyaWFudCR7aX1gLCB2YWx1ZTogaSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnU3RyaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUgPSAnRW51bSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtTGlzdCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlZi5vcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bUxpc3QgPSBkZWYub3B0aW9ucy5tYXAoKHN0cjogc3RyaW5nKSA9PiAoeyBuYW1lOiBzdHIsIHZhbHVlOiBzdHIgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ0VudW0nOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlID0gJ0Jvb2xlYW4nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVmUHJvcCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0ZW5kczogW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBkZWYudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvb2x0aXA6IGRlZi50b29sdGlwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtTGlzdDogZW51bUxpc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGU6IGNoZWNrRGVmaW5lVmlzaWJpbGl0eShkZWYuZGVmaW5lcyB8fCBbXSwgZGVmaW5lTWFwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFzc1Byb3BzW2RlZi5uYW1lXSA9IGRlZlByb3A7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByb2Nlc3MgcHJvcGVydGllc1xuICAgICAgICAgICAgICAgICAgICBpZiAocGFzcy5wcm9wcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFzcy5wcm9wcy5mb3JFYWNoKChwcm9wOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJbmplY3QgZXh0ZW5kczogWydjYy5WYWx1ZVR5cGUnXSBmb3Iga25vd24gdmFsdWUgdHlwZXMgdG8gcHJldmVudCBjdXN0b20gY2xhc3MgZ2VuZXJhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBleHRlbmRzRGF0YSA9IHByb3AuZXh0ZW5kcyB8fCBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoWydWZWMyJywgJ1ZlYzMnLCAnVmVjNCcsICdDb2xvcicsICdSZWN0JywgJ1NpemUnLCAnUXVhdCcsICdNYXQzJywgJ01hdDQnXS5pbmNsdWRlcyhwcm9wLnR5cGUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXh0ZW5kc0RhdGEuaW5jbHVkZXMoJ2NjLlZhbHVlVHlwZScpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHRlbmRzRGF0YSA9IFsuLi5leHRlbmRzRGF0YSwgJ2NjLlZhbHVlVHlwZSddO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsUHJvcCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucHJvcCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheU5hbWU6IHByb3AuZGlzcGxheU5hbWUgfHwgcHJvcC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiBjaGVja0RlZmluZVZpc2liaWxpdHkocHJvcC5kZWZpbmVzIHx8IFtdLCBkZWZpbmVNYXApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHRlbmRzOiBleHRlbmRzRGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFzc1Byb3BzW3Byb3AubmFtZV0gPSB2YWxQcm9wO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXNzSGFzUHJvcHMgPSBPYmplY3Qua2V5cyhwYXNzUHJvcHMpLmxlbmd0aCA+IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgcGFzc1Byb3BzWydwaGFzZSddID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXh0ZW5kczogW10sXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBwYXNzLnBoYXNlIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYWRvbmx5OiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgcGFzc2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZXh0ZW5kczogWydjYy5NYXRlcmlhbFBhc3MnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBwYXNzUHJvcHMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBgY2MuTWF0ZXJpYWxQYXNzJHtwYXNzSGFzUHJvcHMgPyBwYXNzSW5kZXggOiAnJ31gXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IHBhc3Nlc1Byb3A6IGFueSA9IHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHBhc3NlcyxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NjLk1hdGVyaWFsUGFzc2VzJyxcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgcHJvcGVydHlDb250YWluZXJbJ3Bhc3NlcyddID0gcGFzc2VzUHJvcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9wZXJ0eUNvbnRhaW5lcjtcbiAgICB9XG5cbiAgICBhc3luYyBzZXRQcm9wZXJ0eShhc3NldEluZm86IElBc3NldEluZm8sIHBhdGg6IHN0cmluZywgdmFsdWU6IGFueSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICAvLyAxLiBHZXQgdGhlIGN1cnJlbnQgbWF0ZXJpYWwgZHVtcFxuICAgICAgICBjb25zdCBtYXRlcmlhbER1bXAgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1tYXRlcmlhbCcsIGFzc2V0SW5mby51dWlkKTtcbiAgICAgICAgaWYgKCFtYXRlcmlhbER1bXApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBoYW5kbGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gMi4gSGFuZGxlIHNpbXBsZSByb290IHByb3BlcnRpZXNcbiAgICAgICAgaWYgKHBhdGggPT09ICdlZmZlY3RBc3NldCcgfHwgcGF0aCA9PT0gJ2VmZmVjdCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGVmZmVjdHMgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1hbGwtZWZmZWN0cycpO1xuICAgICAgICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLm5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLm5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAndXVpZCcgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnV1aWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZWZmZWN0c1t2YWx1ZV0pIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGVmZmVjdHNbdmFsdWVdLm5hbWU7XG4gICAgICAgICAgICAgICAgaGFuZGxlZCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVmZmVjdCA9IGVmZmVjdHMuZmluZCgoZWZmOiBhbnkpID0+IGVmZi5uYW1lID09PSB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGVmZmVjdCkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGVmZmVjdC5uYW1lO1xuICAgICAgICAgICAgICAgICAgICBoYW5kbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBFZmZlY3Qgbm90IGZvdW5kXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRWZmZWN0ICcke3ZhbHVlfScgbm90IGZvdW5kYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHBhdGggPT09ICd0ZWNobmlxdWUnKSB7XG4gICAgICAgICAgICBtYXRlcmlhbER1bXAudGVjaG5pcXVlID0gdmFsdWU7XG4gICAgICAgICAgICBoYW5kbGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIDMuIEhhbmRsZSBkYXRhL3Byb3BzIHRyYXZlcnNhbFxuICAgICAgICAgICAgY29uc3QgdGVjaG5pcXVlSW5kZXggPSBtYXRlcmlhbER1bXAudGVjaG5pcXVlIHx8IDA7XG4gICAgICAgICAgICBjb25zdCB0ZWNobmlxdWUgPSBtYXRlcmlhbER1bXAuZGF0YVt0ZWNobmlxdWVJbmRleF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0ZWNobmlxdWUgJiYgdGVjaG5pcXVlLnBhc3Nlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgIGxldCB0YXJnZXRQYXNzSW5kaWNlczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgICAgICAgICBsZXQgcHJvcFBhdGhQYXJ0czogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGZvciBleHBsaWNpdCBwYXNzIHBhdGggXCJwYXNzZXMuMC5wcm9wTmFtZS4uLlwiXG4gICAgICAgICAgICAgICAgaWYgKHBhcnRzWzBdID09PSAncGFzc2VzJyAmJiAhaXNOYU4ocGFyc2VJbnQocGFydHNbMV0pKSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRQYXNzSW5kaWNlcyA9IFtwYXJzZUludChwYXJ0c1sxXSldO1xuICAgICAgICAgICAgICAgICAgICBwcm9wUGF0aFBhcnRzID0gcGFydHMuc2xpY2UoMik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSW1wbGljaXQ6IFNlYXJjaCBhbGwgcGFzc2VzIGluIGN1cnJlbnQgdGVjaG5pcXVlXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFBhc3NJbmRpY2VzID0gdGVjaG5pcXVlLnBhc3Nlcy5tYXAoKF86IGFueSwgaTogbnVtYmVyKSA9PiBpKTtcbiAgICAgICAgICAgICAgICAgICAgcHJvcFBhdGhQYXJ0cyA9IHBhcnRzO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwcm9wUGF0aFBhcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJvcE5hbWUgPSBwcm9wUGF0aFBhcnRzWzBdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJQcm9wcyA9IHByb3BQYXRoUGFydHMuc2xpY2UoMSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2V0RGVlcFByb3BlcnR5ID0gKHRhcmdldDogYW55LCBwYXRoUGFydHM6IHN0cmluZ1tdLCB2YWw6IGFueSk6IGJvb2xlYW4gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnQgPSB0YXJnZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5hdmlnYXRlIHRvIHRoZSBwYXJlbnQgb2YgdGhlIHRhcmdldCBwcm9wZXJ0eVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoUGFydHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gcGF0aFBhcnRzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDEuIFRyeSB0byBhY2Nlc3Mga2V5IGRpcmVjdGx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAyLiBUcnkgdG8gZHJpbGwgaW50byAudmFsdWUgKGlmIGN1cnJlbnQgaXMgYSB3cmFwcGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50LnZhbHVlICYmIHR5cGVvZiBjdXJyZW50LnZhbHVlID09PSAnb2JqZWN0JyAmJiBjdXJyZW50LnZhbHVlW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC52YWx1ZVtrZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAzLiBTcGVjaWFsIGNhc2UgZm9yIGFycmF5cyB3aGVyZSB3ZSBtaWdodCBiZSBhY2Nlc3NpbmcgYnkgaW5kZXggYnV0IGN1cnJlbnQgaXMgYSB3cmFwcGVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQudmFsdWUgJiYgQXJyYXkuaXNBcnJheShjdXJyZW50LnZhbHVlKSAmJiBjdXJyZW50LnZhbHVlW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC52YWx1ZVtrZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXRoIG5vdCBmb3VuZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFzdEtleSA9IHBhdGhQYXJ0c1twYXRoUGFydHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhlbHBlciB0byBzZXQgb24gdGhlIGZpbmFsIG9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2V0T25PYmplY3QgPSAob2JqOiBhbnkpOiBib29sZWFuID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9ialtsYXN0S2V5XSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UHJvcCA9IG9ialtsYXN0S2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSB0YXJnZXQgaXMgYSBQcm9wZXJ0eSBXcmFwcGVyIChPYmplY3Qgd2l0aCAudmFsdWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIGF2b2lkIEFycmF5cyBvciBudWxsc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0UHJvcCAmJiB0eXBlb2YgdGFyZ2V0UHJvcCA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkodGFyZ2V0UHJvcCkgJiYgJ3ZhbHVlJyBpbiB0YXJnZXRQcm9wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRQcm9wLnZhbHVlID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSXQncyBhIHJhdyB2YWx1ZSAocHJpbWl0aXZlIG9yIHN0cnVjdCB3aXRob3V0IHdyYXBwZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmpbbGFzdEtleV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAxLiBUcnkgZGlyZWN0IHNldFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNldE9uT2JqZWN0KGN1cnJlbnQpKSByZXR1cm4gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gMi4gVHJ5IHNldCBvbiAudmFsdWUgKGlmIHdyYXBwZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudC52YWx1ZSAmJiB0eXBlb2YgY3VycmVudC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2V0T25PYmplY3QoY3VycmVudC52YWx1ZSkpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH07XG5cblxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRQYXNzSW5kaWNlcy5mb3JFYWNoKHBhc3NJbmRleCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXNzID0gdGVjaG5pcXVlLnBhc3Nlc1twYXNzSW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXNzKSByZXR1cm47XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDEuIFNlYXJjaCBpbiBwcm9wcyAoQXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFzcy5wcm9wcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb3AgPSBwYXNzLnByb3BzLmZpbmQoKHA6IGFueSkgPT4gcC5uYW1lID09PSBwcm9wTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1YlByb3BzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgcHJvcC50eXBlICYmIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChwcm9wLnR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndGV4dHVyZScpIHx8IHByb3AudHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzYW1wbGVyJykpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcC52YWx1ZSA9IHsgdXVpZDogdmFsdWUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcC52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBpZiBwcm9wLnZhbHVlIGlzIG9iamVjdCBmb3IgZGVlcCBzZXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wLnZhbHVlICYmIHR5cGVvZiBwcm9wLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXREZWVwUHJvcGVydHkocHJvcCwgc3ViUHJvcHMsIHZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDIuIFNlYXJjaCBpbiBkZWZpbmVzIChBcnJheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXNzLmRlZmluZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWZpbmUgPSBwYXNzLmRlZmluZXMuZmluZCgoZDogYW55KSA9PiBkLm5hbWUgPT09IHByb3BOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVmaW5lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdWJQcm9wcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluZS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDMuIFNlYXJjaCBpbiBzdGF0ZXMgKE9iamVjdClcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXNzLnN0YXRlcyAmJiBwYXNzLnN0YXRlcy52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBkaXJlY3Qgc3RhdGUgcHJvcGVydHkgKGUuZy4sIFwicHJpb3JpdHlcIiwgXCJwcmltaXRpdmVcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3Muc3RhdGVzLnZhbHVlW3Byb3BOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVQcm9wID0gcGFzcy5zdGF0ZXMudmFsdWVbcHJvcE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1YlByb3BzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZVByb3AudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdGVQcm9wLnZhbHVlICYmIHR5cGVvZiBzdGF0ZVByb3AudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2V0RGVlcFByb3BlcnR5KHN0YXRlUHJvcCwgc3ViUHJvcHMsIHZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gNC4gQXBwbHkgY2hhbmdlc1xuICAgICAgICBpZiAoaGFuZGxlZCkge1xuICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2FwcGx5LW1hdGVyaWFsJywgYXNzZXRJbmZvLnV1aWQsIG1hdGVyaWFsRHVtcCk7XG4gICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UuYnJvYWRjYXN0KCdtYXRlcmlhbC1pbnNwZWN0b3I6Y2hhbmdlLWR1bXAnKTtcbiAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cbiJdfQ==