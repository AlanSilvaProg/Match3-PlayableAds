"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FbxImporter = void 0;
const model_base_importer_1 = require("./model-base-importer");
class FbxImporter extends model_base_importer_1.ModelBaseImporter {
    constructor() {
        super(...arguments);
        this.name = 'fbx';
    }
    addSpecificUserData(userData, container) {
        const fbx = userData.fbx || {};
        container.animationBakeRate = {
            value: fbx.animationBakeRate,
            type: 'Enum',
            enumList: [
                { name: 'Auto', value: 0 },
                { name: 'BakeRate24', value: 24 },
                { name: 'BakeRate25', value: 25 },
                { name: 'BakeRate30', value: 30 },
                { name: 'BakeRate60', value: 60 }
            ],
            tooltip: 'Specify the animation bake sample rate in frames per second (fps).'
        };
        container.preferLocalTimeSpan = {
            value: !!fbx.preferLocalTimeSpan,
            type: 'Boolean',
            tooltip: 'When exporting FBX animations, whether prefer to use the time range recorded in FBX file.<br>If one is not preferred, or one is invalid for use, the time range is robustly calculated.<br>Some FBX generators may not export this information.'
        };
        container.smartMaterialEnabled = {
            value: !!fbx.smartMaterialEnabled,
            type: 'Boolean',
            tooltip: 'Convert DCC materials to engine builtin materials which match the internal lighting model.'
        };
        container.legacyFbxImporter = {
            value: !!userData.legacyFbxImporter,
            type: 'Boolean',
        };
    }
}
exports.FbxImporter = FbxImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmJ4LWltcG9ydGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc291cmNlL3V0Y3AvdXRpbHMvYXNzZXQtaW1wb3J0ZXJzL2ZieC1pbXBvcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrREFBMEQ7QUFHMUQsTUFBYSxXQUFZLFNBQVEsdUNBQWlCO0lBQWxEOztRQUNJLFNBQUksR0FBRyxLQUFLLENBQUM7SUFtQ2pCLENBQUM7SUFqQ2EsbUJBQW1CLENBQUMsUUFBYSxFQUFFLFNBQXVDO1FBQ2hGLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDO1FBRS9CLFNBQVMsQ0FBQyxpQkFBaUIsR0FBRztZQUMxQixLQUFLLEVBQUUsR0FBRyxDQUFDLGlCQUFpQjtZQUM1QixJQUFJLEVBQUUsTUFBTTtZQUNaLFFBQVEsRUFBRTtnQkFDTixFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRTtnQkFDMUIsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7Z0JBQ2pDLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFO2dCQUNqQyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRTtnQkFDakMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7YUFDcEM7WUFDRCxPQUFPLEVBQUUsb0VBQW9FO1NBQ2hGLENBQUM7UUFFRixTQUFTLENBQUMsbUJBQW1CLEdBQUc7WUFDNUIsS0FBSyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1lBQ2hDLElBQUksRUFBRSxTQUFTO1lBQ2YsT0FBTyxFQUFFLGlQQUFpUDtTQUM3UCxDQUFDO1FBRUYsU0FBUyxDQUFDLG9CQUFvQixHQUFHO1lBQzVCLEtBQUssRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLG9CQUFvQjtZQUNqQyxJQUFJLEVBQUUsU0FBUztZQUNmLE9BQU8sRUFBRSw0RkFBNEY7U0FDekcsQ0FBQztRQUVGLFNBQVMsQ0FBQyxpQkFBaUIsR0FBRztZQUN6QixLQUFLLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUI7WUFDbkMsSUFBSSxFQUFFLFNBQVM7U0FDbkIsQ0FBQztJQUNOLENBQUM7Q0FDSjtBQXBDRCxrQ0FvQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNb2RlbEJhc2VJbXBvcnRlciB9IGZyb20gJy4vbW9kZWwtYmFzZS1pbXBvcnRlcic7XG5pbXBvcnQgeyBJUHJvcGVydHkgfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvc2NlbmUvQHR5cGVzL3B1YmxpYyc7XG5cbmV4cG9ydCBjbGFzcyBGYnhJbXBvcnRlciBleHRlbmRzIE1vZGVsQmFzZUltcG9ydGVyIHtcbiAgICBuYW1lID0gJ2ZieCc7XG5cbiAgICBwcm90ZWN0ZWQgYWRkU3BlY2lmaWNVc2VyRGF0YSh1c2VyRGF0YTogYW55LCBjb250YWluZXI6IHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5IH0pOiB2b2lkIHtcbiAgICAgICAgY29uc3QgZmJ4ID0gdXNlckRhdGEuZmJ4IHx8IHt9O1xuICAgICAgICBcbiAgICAgICAgY29udGFpbmVyLmFuaW1hdGlvbkJha2VSYXRlID0ge1xuICAgICAgICAgICAgdmFsdWU6IGZieC5hbmltYXRpb25CYWtlUmF0ZSxcbiAgICAgICAgICAgIHR5cGU6ICdFbnVtJyxcbiAgICAgICAgICAgIGVudW1MaXN0OiBbXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQXV0bycsIHZhbHVlOiAwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQmFrZVJhdGUyNCcsIHZhbHVlOiAyNCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0Jha2VSYXRlMjUnLCB2YWx1ZTogMjUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdCYWtlUmF0ZTMwJywgdmFsdWU6IDMwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQmFrZVJhdGU2MCcsIHZhbHVlOiA2MCB9XG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgdG9vbHRpcDogJ1NwZWNpZnkgdGhlIGFuaW1hdGlvbiBiYWtlIHNhbXBsZSByYXRlIGluIGZyYW1lcyBwZXIgc2Vjb25kIChmcHMpLidcbiAgICAgICAgfTtcblxuICAgICAgICBjb250YWluZXIucHJlZmVyTG9jYWxUaW1lU3BhbiA9IHtcbiAgICAgICAgICAgIHZhbHVlOiAhIWZieC5wcmVmZXJMb2NhbFRpbWVTcGFuLFxuICAgICAgICAgICAgdHlwZTogJ0Jvb2xlYW4nLFxuICAgICAgICAgICAgdG9vbHRpcDogJ1doZW4gZXhwb3J0aW5nIEZCWCBhbmltYXRpb25zLCB3aGV0aGVyIHByZWZlciB0byB1c2UgdGhlIHRpbWUgcmFuZ2UgcmVjb3JkZWQgaW4gRkJYIGZpbGUuPGJyPklmIG9uZSBpcyBub3QgcHJlZmVycmVkLCBvciBvbmUgaXMgaW52YWxpZCBmb3IgdXNlLCB0aGUgdGltZSByYW5nZSBpcyByb2J1c3RseSBjYWxjdWxhdGVkLjxicj5Tb21lIEZCWCBnZW5lcmF0b3JzIG1heSBub3QgZXhwb3J0IHRoaXMgaW5mb3JtYXRpb24uJ1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnRhaW5lci5zbWFydE1hdGVyaWFsRW5hYmxlZCA9IHtcbiAgICAgICAgICAgICB2YWx1ZTogISFmYnguc21hcnRNYXRlcmlhbEVuYWJsZWQsXG4gICAgICAgICAgICAgdHlwZTogJ0Jvb2xlYW4nLFxuICAgICAgICAgICAgIHRvb2x0aXA6ICdDb252ZXJ0IERDQyBtYXRlcmlhbHMgdG8gZW5naW5lIGJ1aWx0aW4gbWF0ZXJpYWxzIHdoaWNoIG1hdGNoIHRoZSBpbnRlcm5hbCBsaWdodGluZyBtb2RlbC4nXG4gICAgICAgIH07XG5cbiAgICAgICAgY29udGFpbmVyLmxlZ2FjeUZieEltcG9ydGVyID0ge1xuICAgICAgICAgICAgIHZhbHVlOiAhIXVzZXJEYXRhLmxlZ2FjeUZieEltcG9ydGVyLFxuICAgICAgICAgICAgIHR5cGU6ICdCb29sZWFuJyxcbiAgICAgICAgfTtcbiAgICB9XG59XG4iXX0=