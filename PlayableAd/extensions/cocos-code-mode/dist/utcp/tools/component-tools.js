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
exports.ComponentTools = void 0;
const package_json_1 = __importDefault(require("../../../package.json"));
const decorators_1 = require("../decorators");
const schemas_1 = require("../schemas");
class ComponentTools {
    async nodeGetAvailableComponentTypes(args) {
        const allComponents = await Editor.Message.request('scene', 'query-components');
        if (!Array.isArray(allComponents)) {
            throw new Error('Failed to retrieve component types');
        }
        const lowerFilter = args.filter ? args.filter.toLowerCase() : null;
        const filtered = allComponents.filter((comp) => {
            let matchesFilter = true;
            if (lowerFilter) {
                matchesFilter = comp.type && comp.type.toLowerCase().includes(lowerFilter);
            }
            if (!args.includeInternal) {
                matchesFilter = matchesFilter && comp.assetUuid && comp.assetUuid.length > 0;
            }
            return matchesFilter;
        });
        const names = filtered.map((comp) => comp.name).filter((name) => typeof name === 'string');
        return { componentTypes: names };
    }
    async nodeComponentsGet(args) {
        var _a, _b, _c;
        const node = await Editor.Message.request('scene', 'query-node', args.reference.id);
        if (!node) {
            throw new Error(`Node ${args.reference.id} not found`);
        }
        const components = node.__comps__ || [];
        const foundComponents = [];
        for (const comp of components) {
            const compUuid = (_b = (_a = comp.value) === null || _a === void 0 ? void 0 : _a.uuid) === null || _b === void 0 ? void 0 : _b.value;
            if (!args.componentType || ((_c = comp.type) === null || _c === void 0 ? void 0 : _c.includes(args.componentType))) {
                foundComponents.push({ id: compUuid, type: comp.type });
            }
        }
        if (foundComponents.length > 0) {
            return { references: foundComponents };
        }
        throw new Error(`Components of type ${args.componentType} not found on node ${args.reference.id}`);
    }
    async nodeComponentRemove(args) {
        try {
            const component = await Editor.Message.request('scene', 'query-component', args.reference.id);
            if (component === null || component === undefined) {
                throw new Error(`Component ${args.reference.id} not found`);
            }
            await Editor.Message.request('scene', 'remove-component', {
                uuid: args.reference.id
            });
            await Editor.Message.request('scene', 'snapshot');
            return { success: true };
        }
        catch (error) {
            throw new Error(`Failed to remove component ${args.reference.id}. Reason: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
        }
    }
    async nodeComponentAdd(args) {
        const node = await Editor.Message.request('scene', 'query-node', args.reference.id);
        if (!node) {
            throw new Error(`Node ${args.reference.id} not found`);
        }
        const beforeComponents = node.__comps__ ? node.__comps__.map((c) => { var _a, _b, _c; return ((_b = (_a = c.value) === null || _a === void 0 ? void 0 : _a.uuid) === null || _b === void 0 ? void 0 : _b.value) || ((_c = c.value) === null || _c === void 0 ? void 0 : _c.uuid) || c.uuid; }) : [];
        const existingUuids = new Set(beforeComponents);
        await Editor.Message.request('scene', 'execute-scene-script', { name: package_json_1.default.name, method: 'startCatchLogging', args: [] });
        await Editor.Message.request('scene', 'create-component', {
            uuid: args.reference.id,
            component: args.componentType
        });
        const nodeAfter = await Editor.Message.request('scene', 'query-node', args.reference.id);
        const afterComponents = nodeAfter.__comps__ ?
            nodeAfter.__comps__.map((c) => { var _a, _b; return { id: (_b = (_a = c.value) === null || _a === void 0 ? void 0 : _a.uuid) === null || _b === void 0 ? void 0 : _b.value, type: c.type }; }) : [];
        const caughtLogs = await Editor.Message.request('scene', 'execute-scene-script', { name: package_json_1.default.name, method: 'stopCatchLogging', args: [] });
        const newComponentRef = afterComponents.find(ref => !existingUuids.has(ref.id));
        if (newComponentRef) {
            await Editor.Message.request('scene', 'snapshot');
            return { reference: { id: newComponentRef.id, type: newComponentRef.type } };
        }
        throw new Error("Failed to add component. Captured logs: " + caughtLogs.join('\n'));
    }
}
exports.ComponentTools = ComponentTools;
__decorate([
    (0, decorators_1.utcpTool)('nodeGetAvailableComponentTypes', 'Get list of globally available component types (class names) at the moment.', {
        type: 'object',
        properties: {
            includeInternal: { type: 'boolean', default: false, description: 'Whether to include internal engine components.' },
            filter: { type: 'string', description: 'Optional filter string to match component types or categories (case-insensitive substring match).' }
        },
        required: ['includeInternal']
    }, { type: 'object', properties: { componentTypes: { type: 'array', items: { type: 'string' } } }, required: ['componentTypes'] }, "GET", ['scene', 'node', 'component', 'types', 'inspection'])
], ComponentTools.prototype, "nodeGetAvailableComponentTypes", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeComponentsGet', 'Get components of specific type on a node. If componentType is not provided, returns all components on the node.', {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema,
            componentType: { type: 'string' }
        },
        required: ['reference']
    }, { type: 'object', properties: { references: { type: 'array', items: schemas_1.InstanceReferenceSchema } }, required: ['references'] }, "GET", ['scene', 'node', 'component', 'get', 'inspection'])
], ComponentTools.prototype, "nodeComponentsGet", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeComponentRemove', 'Remove referenced component from node it is attached to.', { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, schemas_1.SuccessIndicatorSchema, "POST", ['scene', 'node', 'component', 'remove', 'delete'])
], ComponentTools.prototype, "nodeComponentRemove", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeComponentAdd', 'Add a component to a referenced node, returns reference to the new component', {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema,
            componentType: { type: 'string' }
        },
        required: ['reference', 'componentType']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['scene', 'node', 'component', 'add'])
], ComponentTools.prototype, "nodeComponentAdd", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL3V0Y3AvdG9vbHMvY29tcG9uZW50LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLHlFQUFnRDtBQUNoRCw4Q0FBeUM7QUFDekMsd0NBQW9IO0FBRXBILE1BQWEsY0FBYztJQWVqQixBQUFOLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxJQUFtRDtRQUNwRixNQUFNLGFBQWEsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBRWhGLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO1FBQzFELENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDbkUsTUFBTSxRQUFRLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO1lBQ2hELElBQUksYUFBYSxHQUFHLElBQUksQ0FBQztZQUN6QixJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNkLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQy9FLENBQUM7WUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUN4QixhQUFhLEdBQUcsYUFBYSxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBQ2pGLENBQUM7WUFDRCxPQUFPLGFBQWEsQ0FBQztRQUN6QixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLE9BQU8sSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDO1FBRXJHLE9BQU8sRUFBRSxjQUFjLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDckMsQ0FBQztJQWVLLEFBQU4sS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQStEOztRQUNuRixNQUFNLElBQUksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDUixNQUFNLElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzNELENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQztRQUN4QyxNQUFNLGVBQWUsR0FBeUIsRUFBRSxDQUFDO1FBQ2pELEtBQUssTUFBTSxJQUFJLElBQUksVUFBVSxFQUFFLENBQUM7WUFDNUIsTUFBTSxRQUFRLEdBQUcsTUFBQSxNQUFDLElBQUksQ0FBQyxLQUFhLDBDQUFFLElBQUksMENBQUUsS0FBSyxDQUFDO1lBQ2xELElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxLQUFJLE1BQUEsSUFBSSxDQUFDLElBQUksMENBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQSxFQUFFLENBQUM7Z0JBQ2pFLGVBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUM1RCxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM3QixPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxDQUFDO1FBQzNDLENBQUM7UUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixJQUFJLENBQUMsYUFBYSxzQkFBc0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZHLENBQUM7SUFRSyxBQUFOLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxJQUF1QztRQUM3RCxJQUFJLENBQUM7WUFDRCxNQUFNLFNBQVMsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzlGLElBQUksU0FBUyxLQUFLLElBQUksSUFBSSxTQUFTLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ2hELE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUVELE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFFO2dCQUN0RCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2FBQzFCLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRWxELE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDN0IsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLGFBQWEsQ0FBQSxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsT0FBTyxLQUFJLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDM0csQ0FBQztJQUNMLENBQUM7SUFlSyxBQUFOLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxJQUE4RDtRQUNqRixNQUFNLElBQUksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDUixNQUFNLElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzNELENBQUM7UUFFRCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUUsbUJBQUMsT0FBQSxDQUFBLE1BQUEsTUFBQSxDQUFDLENBQUMsS0FBSywwQ0FBRSxJQUFJLDBDQUFFLEtBQUssTUFBSSxNQUFBLENBQUMsQ0FBQyxLQUFLLDBDQUFFLElBQUksQ0FBQSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUEsRUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUMvSCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRWhELE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUN4RCxFQUFFLElBQUksRUFBRSxzQkFBVyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFdkUsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUU7WUFDdEQsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUN2QixTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWE7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxTQUFTLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekYsTUFBTSxlQUFlLEdBQXlCLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUMvRCxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLGVBQUcsT0FBTyxFQUFFLEVBQUUsRUFBRSxNQUFBLE1BQUEsQ0FBQyxDQUFDLEtBQUssMENBQUUsSUFBSSwwQ0FBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFFcEcsTUFBTSxVQUFVLEdBQWEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsc0JBQXNCLEVBQ3JGLEVBQUUsSUFBSSxFQUFFLHNCQUFXLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUV0RSxNQUFNLGVBQWUsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRWhGLElBQUksZUFBZSxFQUFFLENBQUM7WUFDbEIsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFFbEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxlQUFlLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztRQUNqRixDQUFDO1FBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQywwQ0FBMEMsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDeEYsQ0FBQztDQUNKO0FBbEpELHdDQWtKQztBQW5JUztJQWJMLElBQUEscUJBQVEsRUFDTCxnQ0FBZ0MsRUFDaEMsNkVBQTZFLEVBQzdFO1FBQ0ksSUFBSSxFQUFFLFFBQVE7UUFDZCxVQUFVLEVBQUU7WUFDUixlQUFlLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLGdEQUFnRCxFQUFFO1lBQ25ILE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG1HQUFtRyxFQUFFO1NBQy9JO1FBQ0QsUUFBUSxFQUFFLENBQUMsaUJBQWlCLENBQUM7S0FDaEMsRUFDRCxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEVBQUUsY0FBYyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQ2hNO29FQXVCQTtBQWVLO0lBYkwsSUFBQSxxQkFBUSxFQUNMLG1CQUFtQixFQUNuQixrSEFBa0gsRUFDbEg7UUFDSSxJQUFJLEVBQUUsUUFBUTtRQUNkLFVBQVUsRUFBRTtZQUNSLFNBQVMsRUFBRSxpQ0FBdUI7WUFDbEMsYUFBYSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtTQUNwQztRQUNELFFBQVEsRUFBRSxDQUFDLFdBQVcsQ0FBQztLQUMxQixFQUNELEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsRUFBRSxVQUFVLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxpQ0FBdUIsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsWUFBWSxDQUFDLENBQzNMO3VEQXFCQTtBQVFLO0lBTkwsSUFBQSxxQkFBUSxFQUNMLHFCQUFxQixFQUNyQiwwREFBMEQsRUFDMUQsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLFNBQVMsRUFBRSxpQ0FBdUIsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQy9GLGdDQUFzQixFQUFFLE1BQU0sRUFBRyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FDdEY7eURBa0JBO0FBZUs7SUFiTCxJQUFBLHFCQUFRLEVBQ0wsa0JBQWtCLEVBQ2xCLDhFQUE4RSxFQUM5RTtRQUNJLElBQUksRUFBRSxRQUFRO1FBQ2QsVUFBVSxFQUFFO1lBQ1IsU0FBUyxFQUFFLGlDQUF1QjtZQUNsQyxhQUFhLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO1NBQ3BDO1FBQ0QsUUFBUSxFQUFFLENBQUMsV0FBVyxFQUFFLGVBQWUsQ0FBQztLQUMzQyxFQUNELEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsRUFBRSxTQUFTLEVBQUUsaUNBQXVCLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUNsSjtzREFrQ0EiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vLi4vLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCB7IHV0Y3BUb29sIH0gZnJvbSAnLi4vZGVjb3JhdG9ycyc7XG5pbXBvcnQgeyBTdWNjZXNzSW5kaWNhdG9yU2NoZW1hLCBJU3VjY2Vzc0luZGljYXRvciwgSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsIElJbnN0YW5jZVJlZmVyZW5jZSB9IGZyb20gJy4uL3NjaGVtYXMnO1xuXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50VG9vbHMge1xuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnbm9kZUdldEF2YWlsYWJsZUNvbXBvbmVudFR5cGVzJyxcbiAgICAgICAgJ0dldCBsaXN0IG9mIGdsb2JhbGx5IGF2YWlsYWJsZSBjb21wb25lbnQgdHlwZXMgKGNsYXNzIG5hbWVzKSBhdCB0aGUgbW9tZW50LicsXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVJbnRlcm5hbDogeyB0eXBlOiAnYm9vbGVhbicsIGRlZmF1bHQ6IGZhbHNlLCBkZXNjcmlwdGlvbjogJ1doZXRoZXIgdG8gaW5jbHVkZSBpbnRlcm5hbCBlbmdpbmUgY29tcG9uZW50cy4nIH0sXG4gICAgICAgICAgICAgICAgZmlsdGVyOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ09wdGlvbmFsIGZpbHRlciBzdHJpbmcgdG8gbWF0Y2ggY29tcG9uZW50IHR5cGVzIG9yIGNhdGVnb3JpZXMgKGNhc2UtaW5zZW5zaXRpdmUgc3Vic3RyaW5nIG1hdGNoKS4nIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZDogWydpbmNsdWRlSW50ZXJuYWwnXVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IGNvbXBvbmVudFR5cGVzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSB9LCByZXF1aXJlZDogWydjb21wb25lbnRUeXBlcyddIH0sIFwiR0VUXCIsICBbJ3NjZW5lJywgJ25vZGUnLCAnY29tcG9uZW50JywgJ3R5cGVzJywgJ2luc3BlY3Rpb24nXVxuICAgIClcbiAgICBhc3luYyBub2RlR2V0QXZhaWxhYmxlQ29tcG9uZW50VHlwZXMoYXJnczogeyBpbmNsdWRlSW50ZXJuYWw6IGJvb2xlYW4sIGZpbHRlcj86IHN0cmluZyB9KTogUHJvbWlzZTx7IGNvbXBvbmVudFR5cGVzOiBzdHJpbmdbXSB9PiB7XG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHMgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jb21wb25lbnRzJyk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoYWxsQ29tcG9uZW50cykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJldHJpZXZlIGNvbXBvbmVudCB0eXBlcycpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbG93ZXJGaWx0ZXIgPSBhcmdzLmZpbHRlciA/IGFyZ3MuZmlsdGVyLnRvTG93ZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICBjb25zdCBmaWx0ZXJlZCA9IGFsbENvbXBvbmVudHMuZmlsdGVyKChjb21wOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGxldCBtYXRjaGVzRmlsdGVyID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChsb3dlckZpbHRlcikge1xuICAgICAgICAgICAgICAgIG1hdGNoZXNGaWx0ZXIgPSBjb21wLnR5cGUgJiYgY29tcC50eXBlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXJGaWx0ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFhcmdzLmluY2x1ZGVJbnRlcm5hbCkge1xuICAgICAgICAgICAgICAgIG1hdGNoZXNGaWx0ZXIgPSBtYXRjaGVzRmlsdGVyICYmIGNvbXAuYXNzZXRVdWlkICYmIGNvbXAuYXNzZXRVdWlkLmxlbmd0aCA+IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hlc0ZpbHRlcjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgbmFtZXMgPSBmaWx0ZXJlZC5tYXAoKGNvbXA6IGFueSkgPT4gY29tcC5uYW1lKS5maWx0ZXIoKG5hbWU6IGFueSkgPT4gdHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKTtcblxuICAgICAgICByZXR1cm4geyBjb21wb25lbnRUeXBlczogbmFtZXMgfTtcbiAgICB9XG5cbiAgICBAdXRjcFRvb2woXG4gICAgICAgICdub2RlQ29tcG9uZW50c0dldCcsXG4gICAgICAgICdHZXQgY29tcG9uZW50cyBvZiBzcGVjaWZpYyB0eXBlIG9uIGEgbm9kZS4gSWYgY29tcG9uZW50VHlwZSBpcyBub3QgcHJvdmlkZWQsIHJldHVybnMgYWxsIGNvbXBvbmVudHMgb24gdGhlIG5vZGUuJyxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiB7IHR5cGU6ICdzdHJpbmcnIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZDogWydyZWZlcmVuY2UnXVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZXM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hIH0gfSwgcmVxdWlyZWQ6IFsncmVmZXJlbmNlcyddIH0sIFwiR0VUXCIsICBbJ3NjZW5lJywgJ25vZGUnLCAnY29tcG9uZW50JywgJ2dldCcsICdpbnNwZWN0aW9uJ11cbiAgICApXG4gICAgYXN5bmMgbm9kZUNvbXBvbmVudHNHZXQoYXJnczogeyByZWZlcmVuY2U6IElJbnN0YW5jZVJlZmVyZW5jZSwgY29tcG9uZW50VHlwZT86IHN0cmluZyB9KTogUHJvbWlzZTx7IHJlZmVyZW5jZXM6IElJbnN0YW5jZVJlZmVyZW5jZVtdIH0+IHtcbiAgICAgICAgY29uc3Qgbm9kZSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBhcmdzLnJlZmVyZW5jZS5pZCk7XG4gICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlICR7YXJncy5yZWZlcmVuY2UuaWR9IG5vdCBmb3VuZGApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IG5vZGUuX19jb21wc19fIHx8IFtdO1xuICAgICAgICBjb25zdCBmb3VuZENvbXBvbmVudHM6IElJbnN0YW5jZVJlZmVyZW5jZVtdID0gW107XG4gICAgICAgIGZvciAoY29uc3QgY29tcCBvZiBjb21wb25lbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wVXVpZCA9IChjb21wLnZhbHVlIGFzIGFueSk/LnV1aWQ/LnZhbHVlO1xuICAgICAgICAgICAgaWYgKCFhcmdzLmNvbXBvbmVudFR5cGUgfHwgY29tcC50eXBlPy5pbmNsdWRlcyhhcmdzLmNvbXBvbmVudFR5cGUpKSB7XG4gICAgICAgICAgICAgICAgZm91bmRDb21wb25lbnRzLnB1c2goeyBpZDogY29tcFV1aWQsIHR5cGU6IGNvbXAudHlwZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmb3VuZENvbXBvbmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgcmVmZXJlbmNlczogZm91bmRDb21wb25lbnRzIH07XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudHMgb2YgdHlwZSAke2FyZ3MuY29tcG9uZW50VHlwZX0gbm90IGZvdW5kIG9uIG5vZGUgJHthcmdzLnJlZmVyZW5jZS5pZH1gKTtcbiAgICB9XG5cbiAgICBAdXRjcFRvb2woXG4gICAgICAgICdub2RlQ29tcG9uZW50UmVtb3ZlJyxcbiAgICAgICAgJ1JlbW92ZSByZWZlcmVuY2VkIGNvbXBvbmVudCBmcm9tIG5vZGUgaXQgaXMgYXR0YWNoZWQgdG8uJyxcbiAgICAgICAgeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyByZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hIH0sIHJlcXVpcmVkOiBbJ3JlZmVyZW5jZSddIH0sXG4gICAgICAgIFN1Y2Nlc3NJbmRpY2F0b3JTY2hlbWEsIFwiUE9TVFwiLCAgWydzY2VuZScsICdub2RlJywgJ2NvbXBvbmVudCcsICdyZW1vdmUnLCAnZGVsZXRlJ11cbiAgICApXG4gICAgYXN5bmMgbm9kZUNvbXBvbmVudFJlbW92ZShhcmdzOiB7IHJlZmVyZW5jZTogSUluc3RhbmNlUmVmZXJlbmNlIH0pOiBQcm9taXNlPElTdWNjZXNzSW5kaWNhdG9yPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jb21wb25lbnQnLCBhcmdzLnJlZmVyZW5jZS5pZCk7XG4gICAgICAgICAgICBpZiAoY29tcG9uZW50ID09PSBudWxsIHx8IGNvbXBvbmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnQgJHthcmdzLnJlZmVyZW5jZS5pZH0gbm90IGZvdW5kYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgdXVpZDogYXJncy5yZWZlcmVuY2UuaWRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHJlbW92ZSBjb21wb25lbnQgJHthcmdzLnJlZmVyZW5jZS5pZH0uIFJlYXNvbjogJHtlcnJvcj8ubWVzc2FnZSB8fCBlcnJvcn1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIEB1dGNwVG9vbChcbiAgICAgICAgJ25vZGVDb21wb25lbnRBZGQnLFxuICAgICAgICAnQWRkIGEgY29tcG9uZW50IHRvIGEgcmVmZXJlbmNlZCBub2RlLCByZXR1cm5zIHJlZmVyZW5jZSB0byB0aGUgbmV3IGNvbXBvbmVudCcsXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogeyB0eXBlOiAnc3RyaW5nJyB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJywgJ2NvbXBvbmVudFR5cGUnXVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEgfSwgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJ10gfSwgXCJQT1NUXCIsICBbJ3NjZW5lJywgJ25vZGUnLCAnY29tcG9uZW50JywgJ2FkZCddXG4gICAgKVxuICAgIGFzeW5jIG5vZGVDb21wb25lbnRBZGQoYXJnczogeyByZWZlcmVuY2U6IElJbnN0YW5jZVJlZmVyZW5jZSwgY29tcG9uZW50VHlwZTogc3RyaW5nIH0pOiBQcm9taXNlPHsgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UgfT4ge1xuICAgICAgICBjb25zdCBub2RlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIGFyZ3MucmVmZXJlbmNlLmlkKTtcbiAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJHthcmdzLnJlZmVyZW5jZS5pZH0gbm90IGZvdW5kYCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBiZWZvcmVDb21wb25lbnRzID0gbm9kZS5fX2NvbXBzX18gPyBub2RlLl9fY29tcHNfXy5tYXAoKGM6IGFueSkgPT4gYy52YWx1ZT8udXVpZD8udmFsdWUgfHwgYy52YWx1ZT8udXVpZCB8fCBjLnV1aWQpIDogW107XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nVXVpZHMgPSBuZXcgU2V0KGJlZm9yZUNvbXBvbmVudHMpO1xuXG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0JywgXG4gICAgICAgICAgICB7IG5hbWU6IHBhY2thZ2VKU09OLm5hbWUsIG1ldGhvZDogJ3N0YXJ0Q2F0Y2hMb2dnaW5nJywgYXJnczogW10gfSk7XG5cbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgIHV1aWQ6IGFyZ3MucmVmZXJlbmNlLmlkLFxuICAgICAgICAgICAgY29tcG9uZW50OiBhcmdzLmNvbXBvbmVudFR5cGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgbm9kZUFmdGVyID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIGFyZ3MucmVmZXJlbmNlLmlkKTtcbiAgICAgICAgY29uc3QgYWZ0ZXJDb21wb25lbnRzOiBJSW5zdGFuY2VSZWZlcmVuY2VbXSA9IG5vZGVBZnRlci5fX2NvbXBzX18gPyBcbiAgICAgICAgICAgIG5vZGVBZnRlci5fX2NvbXBzX18ubWFwKChjOiBhbnkpID0+IHsgcmV0dXJuIHsgaWQ6IGMudmFsdWU/LnV1aWQ/LnZhbHVlLCB0eXBlOiBjLnR5cGUgfSB9KSA6IFtdO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2F1Z2h0TG9nczogc3RyaW5nW10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIFxuICAgICAgICAgICAgeyBuYW1lOiBwYWNrYWdlSlNPTi5uYW1lLCBtZXRob2Q6ICdzdG9wQ2F0Y2hMb2dnaW5nJywgYXJnczogW10gfSk7XG5cbiAgICAgICAgY29uc3QgbmV3Q29tcG9uZW50UmVmID0gYWZ0ZXJDb21wb25lbnRzLmZpbmQocmVmID0+ICFleGlzdGluZ1V1aWRzLmhhcyhyZWYuaWQpKTtcblxuICAgICAgICBpZiAobmV3Q29tcG9uZW50UmVmKSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xuXG4gICAgICAgICAgICByZXR1cm4geyByZWZlcmVuY2U6IHsgaWQ6IG5ld0NvbXBvbmVudFJlZi5pZCwgdHlwZTogbmV3Q29tcG9uZW50UmVmLnR5cGUgfSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIHRvIGFkZCBjb21wb25lbnQuIENhcHR1cmVkIGxvZ3M6IFwiICsgY2F1Z2h0TG9ncy5qb2luKCdcXG4nKSk7XG4gICAgfVxufSJdfQ==