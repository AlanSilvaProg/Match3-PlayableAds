"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetClassInfoTool = void 0;
const decorators_1 = require("../decorators");
const tools_utils_1 = require("../utils/tools-utils");
const schemas_1 = require("../schemas");
class GetClassInfoTool {
    constructor() {
        this._definitions = [];
        this._definedNames = new Set();
        this._commonTypesDefinition = 'interface IExposedAttributes { type?: string, visible?: boolean, multiline?: boolean, min?: number, max?: number, step?: number, unit?: string, radian?: boolean }\n' +
            'function property(options: IExposedAttributes) {}\n' +
            'type InstanceReference<T> = { id: string; type: string };\n' +
            'class Vec2 { x: number; y: number; }\n' +
            'class Vec3 { x: number; y: number; z: number; }\n' +
            'class Vec4 { x: number; y: number; z: number; w: number; }\n' +
            'class Color { r: number; g: number; b: number; a: number; }\n' +
            'class Rect { x: number; y: number; width: number; height: number; }\n' +
            'class Size { width: number; height: number; }\n' +
            'class Quat { x: number; y: number; z: number; w: number; }\n' +
            'class Mat3 { m00: number; m01: number; m02: number;\n' +
            '\tm03: number; m04: number; m05: number;\n' +
            '\tm06: number; m07: number; m08: number; }\n' +
            'class Mat4 { m00: number; m01: number; m02: number; m03: number;\n' +
            '\tm04: number; m05: number; m06: number; m07: number;\n' +
            '\tm08: number; m09: number; m10: number; m11: number;\n' +
            '\tm12: number; m13: number; m14: number; m15: number; }\n' +
            'class Gradient { alphaKeys: Array<{ alpha: number, time: number }>, colorKeys: Array<{ /* always 3 elements: r, g and b values */color: Array<number>, time: number }>, mode: number }';
    }
    async inspectorGetSettingsDefinition(params) {
        switch (params.settingsType) {
            case 'CommonTypes':
                return { definition: this._commonTypesDefinition };
            case 'CurrentSceneGlobals':
                return this.inspectorGetInstanceDefinition({ reference: { id: 'CurrentSceneGlobals' } });
            case 'ProjectSettings':
                return this.inspectorGetInstanceDefinition({ reference: { id: 'ProjectSettings' } });
            default:
                throw new Error(`Unknown settings type: '${params.settingsType}'.`);
        }
    }
    async inspectorGetInstanceDefinition(params) {
        this._definitions = [];
        this._definedNames.clear();
        let props = undefined;
        let className = params.reference.id;
        const instanceInfo = await tools_utils_1.ToolsUtils.inspectInstance(params.reference.id);
        if (instanceInfo) {
            className = instanceInfo.type;
            if (instanceInfo.assetInfo) {
                className += 'Importer';
            }
            if (instanceInfo.props) {
                props = instanceInfo.props;
            }
            this.processClass(className, props);
        }
        else {
            throw new Error(`Class, Instance or special keyword not found: '${params.reference.id}'.`);
        }
        return { definition: this._definitions.join('\n') };
    }
    processClass(className, providedProps, extendsClass) {
        if (this._definedNames.has(className)) {
            return;
        }
        this._definedNames.add(className);
        if (!providedProps)
            return;
        // Don't let AI mess out with UUID
        if ('uuid' in providedProps && this.isProperty(providedProps.uuid)) {
            providedProps.uuid.readonly = true;
        }
        // Collect fields first to potentially hoist nested definitions
        const fields = [];
        for (const propName of Object.keys(providedProps)) {
            const prop = providedProps[propName];
            // Filter out primitive properties which can't be inspected or invisible ones
            if (prop === undefined || prop === null ||
                (this.isProperty(prop) && 'visible' in prop && !prop.visible))
                continue;
            // IProperty Handling (Complex types, Metadata)
            if (this.isProperty(prop)) {
                const p = prop;
                const decoratorParts = [];
                const isArray = !!p.isArray;
                // Determine item definition for Arrays
                let itemDef = p;
                if (isArray) {
                    if (p.elementTypeData) {
                        itemDef = p.elementTypeData;
                    }
                    else if (Array.isArray(p.value) && p.value.length > 0) {
                        // Try to infer from first element
                        itemDef = p.value[0];
                    }
                    else {
                        // Cannot infer structure for empty array without schema
                        // Fallback to basic type handling
                        itemDef = null;
                    }
                }
                // Analyze Identity (based on itemDef if array, or p if single)
                const defToAnalyze = itemDef || p;
                const itemExtends = defToAnalyze.extends || [];
                const rawType = defToAnalyze.type || 'any';
                const isValueType = itemExtends.includes('cc.ValueType');
                const isReference = itemExtends.includes('cc.Object') ||
                    (!isValueType && (rawType === 'Node' || rawType === 'Component' || rawType === 'cc.Node' || rawType === 'cc.Component'));
                let tsType = this.resolveTsType(rawType).replace(/^cc\./, '');
                // Process Enum/BitMask
                const targetList = defToAnalyze.enumList || defToAnalyze.bitmaskList;
                if ((rawType === 'Enum' || rawType === 'BitMask') && targetList) {
                    const cleanClassName = className.replace(/^cc\./, '').replace(/[^a-zA-Z0-9_]/g, '_');
                    if (p.displayName && typeof p.displayName === 'string') {
                        if (p.displayName.startsWith('i18n:')) {
                            p.displayName = Editor.I18n.t(p.displayName.slice(5)); // Remove 'i18n:' prefix
                        }
                        if (p.displayName.trim().length === 0) {
                            p.displayName = propName;
                        }
                    }
                    else {
                        p.displayName = propName.charAt(0).toUpperCase() + propName.slice(1);
                    }
                    let enumName = `${cleanClassName}${p.displayName.replace(/[^a-zA-Z0-9_]/g, '')}${rawType}`;
                    if (defToAnalyze.userData && typeof defToAnalyze.userData === 'object' && 'enumName' in defToAnalyze.userData) {
                        enumName = defToAnalyze.userData['enumName'];
                    }
                    this.generateEnumDefinition(enumName, targetList);
                    tsType = enumName;
                }
                // Process Struct or Standard Type
                else {
                    // Recursion: Only recurse if we have a valid item definition (itemDef)
                    // If isArray is true but itemDef is undefined, we skip recursion (treat as Array<any> or Array<p.type>)
                    if (itemDef && !isReference && !isValueType && !this.isPrimitiveType(rawType) && itemDef.value && typeof itemDef.value === 'object') {
                        let nestedName = tsType;
                        if (!nestedName || nestedName === 'Object' || nestedName === 'any') {
                            const suffix = isArray ? 'Item' : 'Type';
                            nestedName = `${className}${propName.charAt(0).toUpperCase() + propName.slice(1)}${suffix}`;
                        }
                        const extendsForNested = itemDef.extends && itemDef.extends.length > 0 ? itemDef.extends[0].replace(/^cc\./, '') : undefined;
                        this.processClass(nestedName, itemDef.value, extendsForNested !== nestedName ? extendsForNested : undefined);
                        tsType = nestedName;
                    }
                }
                // Wrap reference type
                if (isReference) {
                    if (tsType === 'any')
                        tsType = 'Object';
                    tsType = `InstanceReference<${tsType}>`;
                }
                // Wrap array type
                if (isArray) {
                    tsType = `Array<${tsType}>`;
                }
                // Decorators & Attributes
                let decoratorType = null;
                // Valuable types for decorators is only CCInteger and CCFloat
                if (p.type === 'Integer')
                    decoratorType = 'CCInteger';
                else if (p.type === 'Float' || p.type === 'Number')
                    decoratorType = 'CCFloat';
                if (decoratorType) {
                    decoratorParts.push(isArray ? `type: [${decoratorType}]` : `type: ${decoratorType}`);
                }
                // Attributes that can help AI get more context
                const attrs = ['min', 'max', 'step', 'unit', 'radian', 'multiline'];
                attrs.forEach(attr => {
                    const val = p[attr];
                    if (val !== undefined && val !== null)
                        decoratorParts.push(`${attr}: ${val}`);
                });
                if (p.tooltip) {
                    let tooltip = p.tooltip;
                    if (tooltip.startsWith('i18n:')) {
                        tooltip = Editor.I18n.t(tooltip.slice(5)); // Remove 'i18n:' prefix
                    }
                    if (tooltip.trim().length > 0) {
                        if (tooltip.match(/<br\s*\/?>/i) || tooltip.includes('\n')) {
                            const lines = tooltip.split(/<br\s*\/?>|\n/i).map(l => l.trim()).filter(l => l.length > 0);
                            if (lines.length > 0) {
                                fields.push(`\t/**`);
                                lines.forEach(line => fields.push(`\t * ${line}`));
                                fields.push(`\t */`);
                            }
                        }
                        else {
                            fields.push(`\t/** ${tooltip} */`);
                        }
                    }
                }
                if (decoratorParts.length > 0) {
                    fields.push(`\t@property({ ${decoratorParts.join(', ')} })`);
                }
                const prefix = !!p.readonly ? 'readonly ' : '';
                fields.push(`\t${prefix}${propName}: ${tsType};`);
                continue;
            }
            // Raw Value Handling (Primitives and simple objects)
            if (this.isPrimitive(prop)) {
                fields.push(`\t${propName}: ${typeof prop};`);
                continue;
            }
            // Array Handling
            if (Array.isArray(prop)) {
                if (prop.length === 0) {
                    fields.push(`\t${propName}: Array<any>;`);
                }
                else {
                    const firstItem = prop[0];
                    if (this.isPrimitive(firstItem)) {
                        fields.push(`\t${propName}: Array<${typeof firstItem}>;`);
                    }
                    else if (typeof firstItem === 'object') {
                        // Raw object in array -> Recursion
                        const nestedClassName = `${className}${propName.charAt(0).toUpperCase() + propName.slice(1)}Item`;
                        this.processClass(nestedClassName, firstItem);
                        fields.push(`\t${propName}: Array<${nestedClassName}>;`);
                    }
                    else {
                        fields.push(`\t${propName}: Array<any>;`);
                    }
                }
                continue;
            }
            // Fallback for raw object (struct)
            if (typeof prop === 'object') {
                const cleanClassName = className.replace(/^cc\./, '').replace(/[^a-zA-Z0-9_]/g, '_');
                const nestedClassName = `${cleanClassName}${propName.charAt(0).toUpperCase() + propName.slice(1)}Type`;
                this.processClass(nestedClassName, prop);
                fields.push(`\t${propName}: ${nestedClassName};`);
            }
        }
        const shortName = className.includes('.') ? className.split('.').pop() : className;
        const classDef = [
            `export class ${shortName} ${extendsClass ? `extends ${extendsClass}` : ''} {`,
            ...fields,
            `}`
        ].join('\n');
        this._definitions.push(classDef);
    }
    // Type Guard for IProperty
    isProperty(val) {
        return val && typeof val === 'object' && 'value' in val;
    }
    // Based on info from CCClass
    isPrimitiveType(type) {
        return ['Integer', 'Float', 'Number', 'String', 'Boolean'].includes(type);
    }
    // Check if value is primitive
    isPrimitive(value) {
        return value === null || (typeof value !== "object" && typeof value !== "function");
    }
    // Helper for Enum or BitMask generation
    generateEnumDefinition(name, items) {
        if (this._definedNames.has(name))
            return;
        this._definedNames.add(name);
        const lines = [];
        lines.push(`export enum ${name} {`);
        items.forEach((item) => {
            let cleanName = item.name.replace(/[^a-zA-Z0-9_]/g, '_');
            if (/^[0-9]/.test(cleanName)) {
                cleanName = `_${cleanName}`;
            }
            if (typeof item.value === 'string') {
                lines.push(`\t${cleanName} = '${item.value}',`);
            }
            else {
                lines.push(`\t${cleanName} = ${item.value},`);
            }
        });
        lines.push(`}`);
        this._definitions.unshift(lines.join('\n'));
    }
    resolveTsType(type) {
        switch (type) {
            case 'Integer':
            case 'Float':
            case 'Number':
            case 'Enum': // Enums handled specifically, but fallback for safety
            case 'BitMask':
                return 'number';
            case 'String':
                return 'string';
            case 'Boolean':
                return 'boolean';
            default:
                return type; // e.g. Vec3, Color, Node
        }
    }
}
exports.GetClassInfoTool = GetClassInfoTool;
__decorate([
    (0, decorators_1.utcpTool)("inspectorGetSettingsDefinition", "Generates TypeScript definition for specific settings.", { type: 'object', properties: { settingsType: { type: 'string', enum: ['CommonTypes', 'CurrentSceneGlobals', 'ProjectSettings'] } }, required: ['settingsType'] }, { type: 'object', properties: { definition: { type: 'string' } }, required: ['definition'] }, "GET", ['code', 'typescript', 'inspection', 'definition', 'common', 'types', 'settings', 'scene', 'globals', 'project'])
], GetClassInfoTool.prototype, "inspectorGetSettingsDefinition", null);
__decorate([
    (0, decorators_1.utcpTool)("inspectorGetInstanceDefinition", "Generates TypeScript definition based on properties and descriptions of instance (Node, Component, Asset).", { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, { type: 'object', properties: { definition: { type: 'string' } }, required: ['definition'] }, "GET", ['code', 'typescript', 'inspection', 'definition', 'class', 'info', 'meta', 'instance', 'node', 'component', 'asset', 'data'])
], GetClassInfoTool.prototype, "inspectorGetInstanceDefinition", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC1kZWZlbml0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL3V0Y3AvdG9vbHMvdHlwZXNjcmlwdC1kZWZlbml0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLDhDQUF5QztBQUV6QyxzREFBa0Q7QUFDbEQsd0NBQXlFO0FBRXpFLE1BQWEsZ0JBQWdCO0lBQTdCO1FBRVksaUJBQVksR0FBYSxFQUFFLENBQUM7UUFDNUIsa0JBQWEsR0FBZ0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN2QywyQkFBc0IsR0FDMUIsc0tBQXNLO1lBQ3RLLHFEQUFxRDtZQUNyRCw2REFBNkQ7WUFDN0Qsd0NBQXdDO1lBQ3hDLG1EQUFtRDtZQUNuRCw4REFBOEQ7WUFDOUQsK0RBQStEO1lBQy9ELHVFQUF1RTtZQUN2RSxpREFBaUQ7WUFDakQsOERBQThEO1lBQzlELHVEQUF1RDtZQUN2RCw0Q0FBNEM7WUFDNUMsOENBQThDO1lBQzlDLG9FQUFvRTtZQUNwRSx5REFBeUQ7WUFDekQseURBQXlEO1lBQ3pELDJEQUEyRDtZQUMzRCx3TEFBd0wsQ0FBQztJQW9Uak0sQ0FBQztJQTNTUyxBQUFOLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxNQUFnQztRQUNqRSxRQUFRLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMxQixLQUFLLGFBQWE7Z0JBQ2QsT0FBTyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztZQUN2RCxLQUFLLHFCQUFxQjtnQkFDdEIsT0FBTyxJQUFJLENBQUMsOEJBQThCLENBQUMsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLEVBQUUscUJBQXFCLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDN0YsS0FBSyxpQkFBaUI7Z0JBQ2xCLE9BQU8sSUFBSSxDQUFDLDhCQUE4QixDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLGlCQUFpQixFQUFFLEVB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QUssRUFBRyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQ3hJO3NFQXNCQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHV0Y3BUb29sIH0gZnJvbSAnLi4vZGVjb3JhdG9ycyc7XG5pbXBvcnQgeyBJUHJvcGVydHksIElQcm9wZXJ0eVZhbHVlVHlwZSB9IGZyb20gJ0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9zY2VuZS9AdHlwZXMvcHVibGljJztcbmltcG9ydCB7IFRvb2xzVXRpbHMgfSBmcm9tICcuLi91dGlscy90b29scy11dGlscyc7XG5pbXBvcnQgeyBJSW5zdGFuY2VSZWZlcmVuY2UsIEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hIH0gZnJvbSAnLi4vc2NoZW1hcyc7XG5cbmV4cG9ydCBjbGFzcyBHZXRDbGFzc0luZm9Ub29sIHtcblxuICAgIHByaXZhdGUgX2RlZmluaXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgIHByaXZhdGUgX2RlZmluZWROYW1lczogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG4gICAgcHJpdmF0ZSBfY29tbW9uVHlwZXNEZWZpbml0aW9uOiBzdHJpbmcgPSBcbiAgICAgICAgJ2ludGVyZmFjZSBJRXhwb3NlZEF0dHJpYnV0ZXMgeyB0eXBlPzogc3RyaW5nLCB2aXNpYmxlPzogYm9vbGVhbiwgbXVsdGlsaW5lPzogYm9vbGVhbiwgbWluPzogbnVtYmVyLCBtYXg/OiBudW1iZXIsIHN0ZXA/OiBudW1iZXIsIHVuaXQ/OiBzdHJpbmcsIHJhZGlhbj86IGJvb2xlYW4gfVxcbicgK1xuICAgICAgICAnZnVuY3Rpb24gcHJvcGVydHkob3B0aW9uczogSUV4cG9zZWRBdHRyaWJ1dGVzKSB7fVxcbicgK1xuICAgICAgICAndHlwZSBJbnN0YW5jZVJlZmVyZW5jZTxUPiA9IHsgaWQ6IHN0cmluZzsgdHlwZTogc3RyaW5nIH07XFxuJyArXG4gICAgICAgICdjbGFzcyBWZWMyIHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IH1cXG4nICtcbiAgICAgICAgJ2NsYXNzIFZlYzMgeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyOyB9XFxuJyArXG4gICAgICAgICdjbGFzcyBWZWM0IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlcjsgdzogbnVtYmVyOyB9XFxuJyArXG4gICAgICAgICdjbGFzcyBDb2xvciB7IHI6IG51bWJlcjsgZzogbnVtYmVyOyBiOiBudW1iZXI7IGE6IG51bWJlcjsgfVxcbicgK1xuICAgICAgICAnY2xhc3MgUmVjdCB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlcjsgfVxcbicgK1xuICAgICAgICAnY2xhc3MgU2l6ZSB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyOyB9XFxuJyArXG4gICAgICAgICdjbGFzcyBRdWF0IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlcjsgdzogbnVtYmVyOyB9XFxuJyArXG4gICAgICAgICdjbGFzcyBNYXQzIHsgbTAwOiBudW1iZXI7IG0wMTogbnVtYmVyOyBtMDI6IG51bWJlcjtcXG4nICtcbiAgICAgICAgJ1xcdG0wMzogbnVtYmVyOyBtMDQ6IG51bWJlcjsgbTA1OiBudW1iZXI7XFxuJyArXG4gICAgICAgICdcXHRtMDY6IG51bWJlcjsgbTA3OiBudW1iZXI7IG0wODogbnVtYmVyOyB9XFxuJyArXG4gICAgICAgICdjbGFzcyBNYXQ0IHsgbTAwOiBudW1iZXI7IG0wMTogbnVtYmVyOyBtMDI6IG51bWJlcjsgbTAzOiBudW1iZXI7XFxuJyArXG4gICAgICAgICdcXHRtMDQ6IG51bWJlcjsgbTA1OiBudW1iZXI7IG0wNjogbnVtYmVyOyBtMDc6IG51bWJlcjtcXG4nICtcbiAgICAgICAgJ1xcdG0wODogbnVtYmVyOyBtMDk6IG51bWJlcjsgbTEwOiBudW1iZXI7IG0xMTogbnVtYmVyO1xcbicgK1xuICAgICAgICAnXFx0bTEyOiBudW1iZXI7IG0xMzogbnVtYmVyOyBtMTQ6IG51bWJlcjsgbTE1OiBudW1iZXI7IH1cXG4nICtcbiAgICAgICAgJ2NsYXNzIEdyYWRpZW50IHsgYWxwaGFLZXlzOiBBcnJheTx7IGFscGhhOiBudW1iZXIsIHRpbWU6IG51bWJlciB9PiwgY29sb3JLZXlzOiBBcnJheTx7IC8qIGFsd2F5cyAzIGVsZW1lbnRzOiByLCBnIGFuZCBiIHZhbHVlcyAqL2NvbG9yOiBBcnJheTxudW1iZXI+LCB0aW1lOiBudW1iZXIgfT4sIG1vZGU6IG51bWJlciB9JztcblxuICAgIEB1dGNwVG9vbChcbiAgICAgICAgXCJpbnNwZWN0b3JHZXRTZXR0aW5nc0RlZmluaXRpb25cIixcbiAgICAgICAgXCJHZW5lcmF0ZXMgVHlwZVNjcmlwdCBkZWZpbml0aW9uIGZvciBzcGVjaWZpYyBzZXR0aW5ncy5cIixcbiAgICAgICAgeyB0eXBlOiAnb2JqZWN0JyAsIHByb3BlcnRpZXM6IHsgc2V0dGluZ3NUeXBlOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ0NvbW1vblR5cGVzJywgJ0N1cnJlbnRTY2VuZUdsb2JhbHMnLCAnUHJvamVjdFNldHRpbmdzJ10gfSB9LCByZXF1aXJlZDogWydzZXR0aW5nc1R5cGUnXSB9LFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IGRlZmluaXRpb246IHsgdHlwZTogJ3N0cmluZycgfSB9LCByZXF1aXJlZDogWydkZWZpbml0aW9uJ10gfSwgXG4gICAgICAgIFwiR0VUXCIsICBbJ2NvZGUnLCAndHlwZXNjcmlwdCcsICdpbnNwZWN0aW9uJywgJ2RlZmluaXRpb24nLCAnY29tbW9uJywgJ3R5cGVzJywgJ3NldHRpbmdzJywgJ3NjZW5lJywgJ2dsb2JhbHMnLCAncHJvamVjdCddXG4gICAgKVxuICAgIGFzeW5jIGluc3BlY3RvckdldFNldHRpbmdzRGVmaW5pdGlvbihwYXJhbXM6IHsgc2V0dGluZ3NUeXBlOiBzdHJpbmcgfSk6IFByb21pc2U8eyBkZWZpbml0aW9uOiBzdHJpbmcgfT4ge1xuICAgICAgICBzd2l0Y2ggKHBhcmFtcy5zZXR0aW5nc1R5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ0NvbW1vblR5cGVzJzpcbiAgICAgICAgICAgICAgICByZXR1cm4geyBkZWZpbml0aW9uOiB0aGlzLl9jb21tb25UeXBlc0RlZmluaXRpb24gfTtcbiAgICAgICAgICAgIGNhc2UgJ0N1cnJlbnRTY2VuZUdsb2JhbHMnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmluc3BlY3RvckdldEluc3RhbmNlRGVmaW5pdGlvbih7IHJlZmVyZW5jZTogeyBpZDogJ0N1cnJlbnRTY2VuZUdsb2JhbHMnIH0gfSk7XG4gICAgICAgICAgICBjYXNlICdQcm9qZWN0U2V0dGluZ3MnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmluc3BlY3RvckdldEluc3RhbmNlRGVmaW5pdGlvbih7IHJlZmVyZW5jZTogeyBpZDogJ1Byb2plY3RTZXR0aW5ncycgfSB9KTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHNldHRpbmdzIHR5cGU6ICcke3BhcmFtcy5zZXR0aW5nc1R5cGV9Jy5gKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBAdXRjcFRvb2woXG4gICAgICAgIFwiaW5zcGVjdG9yR2V0SW5zdGFuY2VEZWZpbml0aW9uXCIsXG4gICAgICAgIFwiR2VuZXJhdGVzIFR5cGVTY3JpcHQgZGVmaW5pdGlvbiBiYXNlZCBvbiBwcm9wZXJ0aWVzIGFuZCBkZXNjcmlwdGlvbnMgb2YgaW5zdGFuY2UgKE5vZGUsIENvbXBvbmVudCwgQXNzZXQpLlwiLFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEgfSwgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJ10gfSxcbiAgICAgICAgeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyBkZWZpbml0aW9uOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSwgcmVxdWlyZWQ6IFsnZGVmaW5pdGlvbiddIH0sIFxuICAgICAgICBcIkdFVFwiLCAgWydjb2RlJywgJ3R5cGVzY3JpcHQnLCAnaW5zcGVjdGlvbicsICdkZWZpbml0aW9uJywgJ2NsYXNzJywgJ2luZm8nLCAnbWV0YScsICdpbnN0YW5jZScsICdub2RlJywgJ2NvbXBvbmVudCcsICdhc3NldCcsICdkYXRhJ11cbiAgICApXG4gICAgYXN5bmMgaW5zcGVjdG9yR2V0SW5zdGFuY2VEZWZpbml0aW9uKHBhcmFtczogeyByZWZlcmVuY2U6IElJbnN0YW5jZVJlZmVyZW5jZSB9KTogUHJvbWlzZTx7IGRlZmluaXRpb246IHN0cmluZyB9PiB7XG4gICAgICAgIHRoaXMuX2RlZmluaXRpb25zID0gW107XG4gICAgICAgIHRoaXMuX2RlZmluZWROYW1lcy5jbGVhcigpO1xuXG4gICAgICAgIGxldCBwcm9wczogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IGNsYXNzTmFtZSA9IHBhcmFtcy5yZWZlcmVuY2UuaWQ7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlSW5mbyA9IGF3YWl0IFRvb2xzVXRpbHMuaW5zcGVjdEluc3RhbmNlKHBhcmFtcy5yZWZlcmVuY2UuaWQpO1xuICAgICAgICBpZiAoaW5zdGFuY2VJbmZvKSB7XG4gICAgICAgICAgICBjbGFzc05hbWUgPSBpbnN0YW5jZUluZm8udHlwZTtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZUluZm8uYXNzZXRJbmZvKSB7XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lICs9ICdJbXBvcnRlcic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2VJbmZvLnByb3BzKSB7XG4gICAgICAgICAgICAgICAgcHJvcHMgPSBpbnN0YW5jZUluZm8ucHJvcHM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NDbGFzcyhjbGFzc05hbWUsIHByb3BzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2xhc3MsIEluc3RhbmNlIG9yIHNwZWNpYWwga2V5d29yZCBub3QgZm91bmQ6ICcke3BhcmFtcy5yZWZlcmVuY2UuaWR9Jy5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGRlZmluaXRpb246IHRoaXMuX2RlZmluaXRpb25zLmpvaW4oJ1xcbicpIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBwcm9jZXNzQ2xhc3MoY2xhc3NOYW1lOiBzdHJpbmcsIHByb3ZpZGVkUHJvcHM/OiB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9LCBleHRlbmRzQ2xhc3M/OiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZmluZWROYW1lcy5oYXMoY2xhc3NOYW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGVmaW5lZE5hbWVzLmFkZChjbGFzc05hbWUpO1xuXG4gICAgICAgIGlmICghcHJvdmlkZWRQcm9wcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIERvbid0IGxldCBBSSBtZXNzIG91dCB3aXRoIFVVSURcbiAgICAgICAgaWYgKCd1dWlkJyBpbiBwcm92aWRlZFByb3BzICYmIHRoaXMuaXNQcm9wZXJ0eShwcm92aWRlZFByb3BzLnV1aWQpKSB7XG4gICAgICAgICAgICBwcm92aWRlZFByb3BzLnV1aWQucmVhZG9ubHkgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29sbGVjdCBmaWVsZHMgZmlyc3QgdG8gcG90ZW50aWFsbHkgaG9pc3QgbmVzdGVkIGRlZmluaXRpb25zXG4gICAgICAgIGNvbnN0IGZpZWxkczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IHByb3BOYW1lIG9mIE9iamVjdC5rZXlzKHByb3ZpZGVkUHJvcHMpKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wID0gcHJvdmlkZWRQcm9wc1twcm9wTmFtZV07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpbHRlciBvdXQgcHJpbWl0aXZlIHByb3BlcnRpZXMgd2hpY2ggY2FuJ3QgYmUgaW5zcGVjdGVkIG9yIGludmlzaWJsZSBvbmVzXG4gICAgICAgICAgICBpZiAocHJvcCA9PT0gdW5kZWZpbmVkIHx8IHByb3AgPT09IG51bGwgfHwgXG4gICAgICAgICAgICAgICAgKHRoaXMuaXNQcm9wZXJ0eShwcm9wKSAmJiAndmlzaWJsZScgaW4gcHJvcCAmJiAhcHJvcC52aXNpYmxlKSkgY29udGludWU7XG5cbiAgICAgICAgICAgIC8vIElQcm9wZXJ0eSBIYW5kbGluZyAoQ29tcGxleCB0eXBlcywgTWV0YWRhdGEpXG4gICAgICAgICAgICBpZiAodGhpcy5pc1Byb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcCA9IHByb3AgYXMgSVByb3BlcnR5O1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlY29yYXRvclBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQXJyYXkgPSAhIXAuaXNBcnJheTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgaXRlbSBkZWZpbml0aW9uIGZvciBBcnJheXNcbiAgICAgICAgICAgICAgICBsZXQgaXRlbURlZjogYW55ID0gcDtcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocC5lbGVtZW50VHlwZURhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1EZWYgPSBwLmVsZW1lbnRUeXBlRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHAudmFsdWUpICYmIHAudmFsdWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRyeSB0byBpbmZlciBmcm9tIGZpcnN0IGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtRGVmID0gcC52YWx1ZVswXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENhbm5vdCBpbmZlciBzdHJ1Y3R1cmUgZm9yIGVtcHR5IGFycmF5IHdpdGhvdXQgc2NoZW1hXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjayB0byBiYXNpYyB0eXBlIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtRGVmID0gbnVsbDsgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQW5hbHl6ZSBJZGVudGl0eSAoYmFzZWQgb24gaXRlbURlZiBpZiBhcnJheSwgb3IgcCBpZiBzaW5nbGUpXG4gICAgICAgICAgICAgICAgY29uc3QgZGVmVG9BbmFseXplID0gaXRlbURlZiB8fCBwO1xuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1FeHRlbmRzID0gZGVmVG9BbmFseXplLmV4dGVuZHMgfHwgW107XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3VHlwZSA9IGRlZlRvQW5hbHl6ZS50eXBlIHx8ICdhbnknO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGlzVmFsdWVUeXBlID0gaXRlbUV4dGVuZHMuaW5jbHVkZXMoJ2NjLlZhbHVlVHlwZScpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVmZXJlbmNlID0gaXRlbUV4dGVuZHMuaW5jbHVkZXMoJ2NjLk9iamVjdCcpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKCFpc1ZhbHVlVHlwZSAmJiAocmF3VHlwZSA9PT0gJ05vZGUnIHx8IHJhd1R5cGUgPT09ICdDb21wb25lbnQnIHx8IHJhd1R5cGUgPT09ICdjYy5Ob2RlJyB8fCByYXdUeXBlID09PSAnY2MuQ29tcG9uZW50JykpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCB0c1R5cGUgPSB0aGlzLnJlc29sdmVUc1R5cGUocmF3VHlwZSkucmVwbGFjZSgvXmNjXFwuLywgJycpO1xuXG4gICAgICAgICAgICAgICAgLy8gUHJvY2VzcyBFbnVtL0JpdE1hc2tcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRMaXN0ID0gZGVmVG9BbmFseXplLmVudW1MaXN0IHx8IGRlZlRvQW5hbHl6ZS5iaXRtYXNrTGlzdDtcbiAgICAgICAgICAgICAgICBpZiAoKHJhd1R5cGUgPT09ICdFbnVtJyB8fCByYXdUeXBlID09PSAnQml0TWFzaycpICYmIHRhcmdldExpc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFuQ2xhc3NOYW1lID0gY2xhc3NOYW1lLnJlcGxhY2UoL15jY1xcLi8sICcnKS5yZXBsYWNlKC9bXmEtekEtWjAtOV9dL2csICdfJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgIGlmIChwLmRpc3BsYXlOYW1lICYmIHR5cGVvZiBwLmRpc3BsYXlOYW1lID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHAuZGlzcGxheU5hbWUuc3RhcnRzV2l0aCgnaTE4bjonKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwLmRpc3BsYXlOYW1lID0gRWRpdG9yLkkxOG4udChwLmRpc3BsYXlOYW1lLnNsaWNlKDUpKTsgLy8gUmVtb3ZlICdpMThuOicgcHJlZml4XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocC5kaXNwbGF5TmFtZS50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcC5kaXNwbGF5TmFtZSA9IHByb3BOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHAuZGlzcGxheU5hbWUgPSBwcm9wTmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHByb3BOYW1lLnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICBsZXQgZW51bU5hbWUgPSBgJHtjbGVhbkNsYXNzTmFtZX0ke3AuZGlzcGxheU5hbWUucmVwbGFjZSgvW15hLXpBLVowLTlfXS9nLCAnJyl9JHtyYXdUeXBlfWA7XG5cbiAgICAgICAgICAgICAgICAgICAgIGlmIChkZWZUb0FuYWx5emUudXNlckRhdGEgJiYgdHlwZW9mIGRlZlRvQW5hbHl6ZS51c2VyRGF0YSA9PT0gJ29iamVjdCcgJiYgJ2VudW1OYW1lJyBpbiBkZWZUb0FuYWx5emUudXNlckRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtTmFtZSA9IGRlZlRvQW5hbHl6ZS51c2VyRGF0YVsnZW51bU5hbWUnXTtcbiAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgdGhpcy5nZW5lcmF0ZUVudW1EZWZpbml0aW9uKGVudW1OYW1lLCB0YXJnZXRMaXN0KTtcbiAgICAgICAgICAgICAgICAgICAgIHRzVHlwZSA9IGVudW1OYW1lO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgLy8gUHJvY2VzcyBTdHJ1Y3Qgb3IgU3RhbmRhcmQgVHlwZVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBSZWN1cnNpb246IE9ubHkgcmVjdXJzZSBpZiB3ZSBoYXZlIGEgdmFsaWQgaXRlbSBkZWZpbml0aW9uIChpdGVtRGVmKVxuICAgICAgICAgICAgICAgICAgICAvLyBJZiBpc0FycmF5IGlzIHRydWUgYnV0IGl0ZW1EZWYgaXMgdW5kZWZpbmVkLCB3ZSBza2lwIHJlY3Vyc2lvbiAodHJlYXQgYXMgQXJyYXk8YW55PiBvciBBcnJheTxwLnR5cGU+KVxuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbURlZiAmJiAhaXNSZWZlcmVuY2UgJiYgIWlzVmFsdWVUeXBlICYmICF0aGlzLmlzUHJpbWl0aXZlVHlwZShyYXdUeXBlKSAmJiBpdGVtRGVmLnZhbHVlICYmIHR5cGVvZiBpdGVtRGVmLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBuZXN0ZWROYW1lID0gdHNUeXBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbmVzdGVkTmFtZSB8fCBuZXN0ZWROYW1lID09PSAnT2JqZWN0JyB8fCBuZXN0ZWROYW1lID09PSAnYW55Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWZmaXggPSBpc0FycmF5ID8gJ0l0ZW0nIDogJ1R5cGUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXN0ZWROYW1lID0gYCR7Y2xhc3NOYW1lfSR7cHJvcE5hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBwcm9wTmFtZS5zbGljZSgxKX0ke3N1ZmZpeH1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRlbmRzRm9yTmVzdGVkID0gaXRlbURlZi5leHRlbmRzICYmIGl0ZW1EZWYuZXh0ZW5kcy5sZW5ndGggPiAwID8gaXRlbURlZi5leHRlbmRzWzBdLnJlcGxhY2UoL15jY1xcLi8sICcnKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NDbGFzcyhuZXN0ZWROYW1lLCBpdGVtRGVmLnZhbHVlIGFzIGFueSwgZXh0ZW5kc0Zvck5lc3RlZCAhPT0gbmVzdGVkTmFtZSA/IGV4dGVuZHNGb3JOZXN0ZWQgOiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgIHRzVHlwZSA9IG5lc3RlZE5hbWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JhcCByZWZlcmVuY2UgdHlwZVxuICAgICAgICAgICAgICAgIGlmIChpc1JlZmVyZW5jZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHNUeXBlID09PSAnYW55JykgdHNUeXBlID0gJ09iamVjdCc7XG4gICAgICAgICAgICAgICAgICAgIHRzVHlwZSA9IGBJbnN0YW5jZVJlZmVyZW5jZTwke3RzVHlwZX0+YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JhcCBhcnJheSB0eXBlXG4gICAgICAgICAgICAgICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgIHRzVHlwZSA9IGBBcnJheTwke3RzVHlwZX0+YDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBEZWNvcmF0b3JzICYgQXR0cmlidXRlc1xuICAgICAgICAgICAgICAgIGxldCBkZWNvcmF0b3JUeXBlID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIC8vIFZhbHVhYmxlIHR5cGVzIGZvciBkZWNvcmF0b3JzIGlzIG9ubHkgQ0NJbnRlZ2VyIGFuZCBDQ0Zsb2F0XG4gICAgICAgICAgICAgICAgaWYgKHAudHlwZSA9PT0gJ0ludGVnZXInKSBkZWNvcmF0b3JUeXBlID0gJ0NDSW50ZWdlcic7XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocC50eXBlID09PSAnRmxvYXQnIHx8IHAudHlwZSA9PT0gJ051bWJlcicpIGRlY29yYXRvclR5cGUgPSAnQ0NGbG9hdCc7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKGRlY29yYXRvclR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgIGRlY29yYXRvclBhcnRzLnB1c2goaXNBcnJheSA/IGB0eXBlOiBbJHtkZWNvcmF0b3JUeXBlfV1gIDogYHR5cGU6ICR7ZGVjb3JhdG9yVHlwZX1gKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBBdHRyaWJ1dGVzIHRoYXQgY2FuIGhlbHAgQUkgZ2V0IG1vcmUgY29udGV4dFxuICAgICAgICAgICAgICAgIGNvbnN0IGF0dHJzID0gWydtaW4nLCAnbWF4JywgJ3N0ZXAnLCAndW5pdCcsICdyYWRpYW4nLCAnbXVsdGlsaW5lJ107XG4gICAgICAgICAgICAgICAgYXR0cnMuZm9yRWFjaChhdHRyID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbCA9IChwIGFzIGFueSlbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWwgIT09IHVuZGVmaW5lZCAmJiB2YWwgIT09IG51bGwpIGRlY29yYXRvclBhcnRzLnB1c2goYCR7YXR0cn06ICR7dmFsfWApO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHAudG9vbHRpcCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdG9vbHRpcCA9IHAudG9vbHRpcDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2x0aXAuc3RhcnRzV2l0aCgnaTE4bjonKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbHRpcCA9IEVkaXRvci5JMThuLnQodG9vbHRpcC5zbGljZSg1KSk7IC8vIFJlbW92ZSAnaTE4bjonIHByZWZpeFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAodG9vbHRpcC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2x0aXAubWF0Y2goLzxiclxccypcXC8/Pi9pKSB8fCB0b29sdGlwLmluY2x1ZGVzKCdcXG4nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gdG9vbHRpcC5zcGxpdCgvPGJyXFxzKlxcLz8+fFxcbi9pKS5tYXAobCA9PiBsLnRyaW0oKSkuZmlsdGVyKGwgPT4gbC5sZW5ndGggPiAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGluZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChgXFx0LyoqYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVzLmZvckVhY2gobGluZSA9PiBmaWVsZHMucHVzaChgXFx0ICogJHtsaW5lfWApKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGRzLnB1c2goYFxcdCAqL2ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGRzLnB1c2goYFxcdC8qKiAke3Rvb2x0aXB9ICovYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVjb3JhdG9yUGFydHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChgXFx0QHByb3BlcnR5KHsgJHtkZWNvcmF0b3JQYXJ0cy5qb2luKCcsICcpfSB9KWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9ICEhcC5yZWFkb25seSA/ICdyZWFkb25seSAnIDogJyc7XG4gICAgICAgICAgICAgICAgZmllbGRzLnB1c2goYFxcdCR7cHJlZml4fSR7cHJvcE5hbWV9OiAke3RzVHlwZX07YCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJhdyBWYWx1ZSBIYW5kbGluZyAoUHJpbWl0aXZlcyBhbmQgc2ltcGxlIG9iamVjdHMpXG4gICAgICAgICAgICBpZiAodGhpcy5pc1ByaW1pdGl2ZShwcm9wKSkge1xuICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKGBcXHQke3Byb3BOYW1lfTogJHt0eXBlb2YgcHJvcH07YCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFycmF5IEhhbmRsaW5nXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wKSkge1xuICAgICAgICAgICAgICAgIGlmIChwcm9wLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChgXFx0JHtwcm9wTmFtZX06IEFycmF5PGFueT47YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlyc3RJdGVtID0gcHJvcFswXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNQcmltaXRpdmUoZmlyc3RJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKGBcXHQke3Byb3BOYW1lfTogQXJyYXk8JHt0eXBlb2YgZmlyc3RJdGVtfT47YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGZpcnN0SXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSYXcgb2JqZWN0IGluIGFycmF5IC0+IFJlY3Vyc2lvblxuICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5lc3RlZENsYXNzTmFtZSA9IGAke2NsYXNzTmFtZX0ke3Byb3BOYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcHJvcE5hbWUuc2xpY2UoMSl9SXRlbWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzQ2xhc3MobmVzdGVkQ2xhc3NOYW1lLCBmaXJzdEl0ZW0gYXMgdW5rbm93biBhcyB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChgXFx0JHtwcm9wTmFtZX06IEFycmF5PCR7bmVzdGVkQ2xhc3NOYW1lfT47YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgZmllbGRzLnB1c2goYFxcdCR7cHJvcE5hbWV9OiBBcnJheTxhbnk+O2ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbGJhY2sgZm9yIHJhdyBvYmplY3QgKHN0cnVjdClcbiAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3AgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xlYW5DbGFzc05hbWUgPSBjbGFzc05hbWUucmVwbGFjZSgvXmNjXFwuLywgJycpLnJlcGxhY2UoL1teYS16QS1aMC05X10vZywgJ18nKTtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXN0ZWRDbGFzc05hbWUgPSBgJHtjbGVhbkNsYXNzTmFtZX0ke3Byb3BOYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcHJvcE5hbWUuc2xpY2UoMSl9VHlwZWA7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzQ2xhc3MobmVzdGVkQ2xhc3NOYW1lLCBwcm9wIGFzIHVua25vd24gYXMgeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSk7ICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChgXFx0JHtwcm9wTmFtZX06ICR7bmVzdGVkQ2xhc3NOYW1lfTtgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNob3J0TmFtZSA9IGNsYXNzTmFtZS5pbmNsdWRlcygnLicpID8gY2xhc3NOYW1lLnNwbGl0KCcuJykucG9wKCkhIDogY2xhc3NOYW1lO1xuICAgICAgICBjb25zdCBjbGFzc0RlZiA9IFtcbiAgICAgICAgICAgIGBleHBvcnQgY2xhc3MgJHtzaG9ydE5hbWV9ICR7ZXh0ZW5kc0NsYXNzID8gYGV4dGVuZHMgJHtleHRlbmRzQ2xhc3N9YCA6ICcnfSB7YCxcbiAgICAgICAgICAgIC4uLmZpZWxkcyxcbiAgICAgICAgICAgIGB9YFxuICAgICAgICBdLmpvaW4oJ1xcbicpO1xuXG4gICAgICAgIHRoaXMuX2RlZmluaXRpb25zLnB1c2goY2xhc3NEZWYpO1xuICAgIH1cblxuICAgIC8vIFR5cGUgR3VhcmQgZm9yIElQcm9wZXJ0eVxuICAgIHByaXZhdGUgaXNQcm9wZXJ0eSh2YWw6IGFueSk6IHZhbCBpcyBJUHJvcGVydHkge1xuICAgICAgICAgcmV0dXJuIHZhbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHZhbDtcbiAgICB9XG5cbiAgICAvLyBCYXNlZCBvbiBpbmZvIGZyb20gQ0NDbGFzc1xuICAgIHByaXZhdGUgaXNQcmltaXRpdmVUeXBlKHR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gWydJbnRlZ2VyJywgJ0Zsb2F0JywgJ051bWJlcicsICdTdHJpbmcnLCAnQm9vbGVhbiddLmluY2x1ZGVzKHR5cGUpO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIHZhbHVlIGlzIHByaW1pdGl2ZVxuICAgIHByaXZhdGUgaXNQcmltaXRpdmUodmFsdWU6IHVua25vd24pOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8ICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpO1xuICAgIH1cblxuICAgIC8vIEhlbHBlciBmb3IgRW51bSBvciBCaXRNYXNrIGdlbmVyYXRpb25cbiAgICBwcml2YXRlIGdlbmVyYXRlRW51bURlZmluaXRpb24obmFtZTogc3RyaW5nLCBpdGVtczogYW55W10pIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZmluZWROYW1lcy5oYXMobmFtZSkpIHJldHVybjtcbiAgICAgICAgdGhpcy5fZGVmaW5lZE5hbWVzLmFkZChuYW1lKTtcblxuICAgICAgICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgbGluZXMucHVzaChgZXhwb3J0IGVudW0gJHtuYW1lfSB7YCk7XG4gICAgICAgIGl0ZW1zLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIGxldCBjbGVhbk5hbWUgPSBpdGVtLm5hbWUucmVwbGFjZSgvW15hLXpBLVowLTlfXS9nLCAnXycpO1xuICAgICAgICAgICAgaWYgKC9eWzAtOV0vLnRlc3QoY2xlYW5OYW1lKSkge1xuICAgICAgICAgICAgICAgIGNsZWFuTmFtZSA9IGBfJHtjbGVhbk5hbWV9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtLnZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goYFxcdCR7Y2xlYW5OYW1lfSA9ICcke2l0ZW0udmFsdWV9JyxgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGluZXMucHVzaChgXFx0JHtjbGVhbk5hbWV9ID0gJHtpdGVtLnZhbHVlfSxgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGxpbmVzLnB1c2goYH1gKTtcbiAgICAgICAgdGhpcy5fZGVmaW5pdGlvbnMudW5zaGlmdChsaW5lcy5qb2luKCdcXG4nKSk7XG4gICAgfVxuICAgIFxuICAgIHByaXZhdGUgcmVzb2x2ZVRzVHlwZSh0eXBlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ0ludGVnZXInOlxuICAgICAgICAgICAgY2FzZSAnRmxvYXQnOlxuICAgICAgICAgICAgY2FzZSAnTnVtYmVyJzpcbiAgICAgICAgICAgIGNhc2UgJ0VudW0nOiAvLyBFbnVtcyBoYW5kbGVkIHNwZWNpZmljYWxseSwgYnV0IGZhbGxiYWNrIGZvciBzYWZldHlcbiAgICAgICAgICAgIGNhc2UgJ0JpdE1hc2snOlxuICAgICAgICAgICAgICAgIHJldHVybiAnbnVtYmVyJztcbiAgICAgICAgICAgIGNhc2UgJ1N0cmluZyc6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdzdHJpbmcnO1xuICAgICAgICAgICAgY2FzZSAnQm9vbGVhbic6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdib29sZWFuJztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHR5cGU7IC8vIGUuZy4gVmVjMywgQ29sb3IsIE5vZGVcbiAgICAgICAgfVxuICAgIH1cblxufVxuXG4iXX0=