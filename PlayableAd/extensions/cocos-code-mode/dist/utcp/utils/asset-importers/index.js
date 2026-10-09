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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllImporters = registerAllImporters;
const importer_manager_1 = require("./importer-manager");
const material_importer_1 = require("./material-importer");
const texture_importer_1 = require("./texture-importer");
const script_importer_1 = require("./script-importer");
const physics_material_importer_1 = require("./physics-material-importer");
const fbx_importer_1 = require("./fbx-importer");
const gltf_importer_1 = require("./gltf-importer");
const directory_importer_1 = require("./directory-importer");
const auto_atlas_importer_1 = require("./auto-atlas-importer");
const prefab_importer_1 = require("./prefab-importer");
const image_importer_1 = require("./image-importer");
const sprite_frame_importer_1 = require("./sprite-frame-importer");
const texture_cube_importer_1 = require("./texture-cube-importer");
const erp_texture_cube_importer_1 = require("./erp-texture-cube-importer");
const render_texture_importer_1 = require("./render-texture-importer");
const project_settings_importer_1 = require("./project-settings-importer");
__exportStar(require("./base-importer"), exports);
__exportStar(require("./importer-manager"), exports);
__exportStar(require("./material-importer"), exports);
__exportStar(require("./texture-importer"), exports);
__exportStar(require("./script-importer"), exports);
__exportStar(require("./physics-material-importer"), exports);
__exportStar(require("./fbx-importer"), exports);
__exportStar(require("./gltf-importer"), exports);
__exportStar(require("./directory-importer"), exports);
__exportStar(require("./auto-atlas-importer"), exports);
__exportStar(require("./prefab-importer"), exports);
__exportStar(require("./image-importer"), exports);
__exportStar(require("./sprite-frame-importer"), exports);
__exportStar(require("./texture-cube-importer"), exports);
__exportStar(require("./erp-texture-cube-importer"), exports);
__exportStar(require("./render-texture-importer"), exports);
__exportStar(require("./project-settings-importer"), exports);
function registerAllImporters() {
    const manager = importer_manager_1.ImporterManager.getInstance();
    // Project Settings
    manager.registerImporter(new project_settings_importer_1.ProjectSettingsImporter());
    // Material
    manager.registerImporter(new material_importer_1.MaterialImporter());
    // Scripts
    manager.registerImporter(new script_importer_1.ScriptImporter()); // typescript
    // Prefab
    manager.registerImporter(new prefab_importer_1.PrefabImporter());
    // Textures & Images
    manager.registerImporter(new image_importer_1.ImageImporter());
    manager.registerImporter(new texture_importer_1.TextureImporter());
    manager.registerImporter(new sprite_frame_importer_1.SpriteFrameImporter());
    manager.registerImporter(new texture_cube_importer_1.TextureCubeImporter());
    manager.registerImporter(new erp_texture_cube_importer_1.ErpTextureCubeImporter());
    manager.registerImporter(new render_texture_importer_1.RenderTextureImporter());
    // Other
    manager.registerImporter(new physics_material_importer_1.PhysicsMaterialImporter());
    manager.registerImporter(new fbx_importer_1.FbxImporter());
    manager.registerImporter(new gltf_importer_1.GltfImporter());
    manager.registerImporter(new directory_importer_1.DirectoryImporter());
    manager.registerImporter(new auto_atlas_importer_1.AutoAtlasImporter());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zb3VyY2UvdXRjcC91dGlscy9hc3NldC1pbXBvcnRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQW1DQSxvREE2QkM7QUFoRUQseURBQXFEO0FBQ3JELDJEQUF1RDtBQUN2RCx5REFBcUQ7QUFDckQsdURBQW1EO0FBQ25ELDJFQUFzRTtBQUN0RSxpREFBNkM7QUFDN0MsbURBQStDO0FBQy9DLDZEQUF5RDtBQUN6RCwrREFBMEQ7QUFDMUQsdURBQW1EO0FBQ25ELHFEQUFpRDtBQUNqRCxtRUFBOEQ7QUFDOUQsbUVBQThEO0FBQzlELDJFQUFxRTtBQUNyRSx1RUFBa0U7QUFDbEUsMkVBQXNFO0FBRXRFLGtEQUFnQztBQUNoQyxxREFBbUM7QUFDbkMsc0RBQW9DO0FBQ3BDLHFEQUFtQztBQUNuQyxvREFBa0M7QUFDbEMsOERBQTRDO0FBQzVDLGlEQUErQjtBQUMvQixrREFBZ0M7QUFDaEMsdURBQXFDO0FBQ3JDLHdEQUFzQztBQUN0QyxvREFBa0M7QUFDbEMsbURBQWlDO0FBQ2pDLDBEQUF3QztBQUN4QywwREFBd0M7QUFDeEMsOERBQTRDO0FBQzVDLDREQUEwQztBQUMxQyw4REFBNEM7QUFFNUMsU0FBZ0Isb0JBQW9CO0lBQ2hDLE1BQU0sT0FBTyxHQUFHLGtDQUFlLENBQUMsV0FBVyxFQUFFLENBQUM7SUFFOUMsbUJBQW1CO0lBQ25CLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLG1EQUF1QixFQUFFLENBQUMsQ0FBQztJQUV4RCxXQUFXO0lBQ1gsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksb0NBQWdCLEVBQUUsQ0FBQyxDQUFDO0lBRWpELFVBQVU7SUFDVixPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxnQ0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWE7SUFFN0QsU0FBUztJQUNULE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLGdDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBRS9DLG9CQUFvQjtJQUNwQixPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSw4QkFBYSxFQUFFLENBQUMsQ0FBQztJQUM5QyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxrQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNoRCxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSwyQ0FBbUIsRUFBRSxDQUFDLENBQUM7SUFDcEQsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksMkNBQW1CLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLGtEQUFzQixFQUFFLENBQUMsQ0FBQztJQUN2RCxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSwrQ0FBcUIsRUFBRSxDQUFDLENBQUM7SUFFdEQsUUFBUTtJQUNSLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLG1EQUF1QixFQUFFLENBQUMsQ0FBQztJQUN4RCxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSwwQkFBVyxFQUFFLENBQUMsQ0FBQztJQUM1QyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSw0QkFBWSxFQUFFLENBQUMsQ0FBQztJQUM3QyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxzQ0FBaUIsRUFBRSxDQUFDLENBQUM7SUFDbEQsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksdUNBQWlCLEVBQUUsQ0FBQyxDQUFDO0FBQ3RELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbXBvcnRlck1hbmFnZXIgfSBmcm9tICcuL2ltcG9ydGVyLW1hbmFnZXInO1xuaW1wb3J0IHsgTWF0ZXJpYWxJbXBvcnRlciB9IGZyb20gJy4vbWF0ZXJpYWwtaW1wb3J0ZXInO1xuaW1wb3J0IHsgVGV4dHVyZUltcG9ydGVyIH0gZnJvbSAnLi90ZXh0dXJlLWltcG9ydGVyJztcbmltcG9ydCB7IFNjcmlwdEltcG9ydGVyIH0gZnJvbSAnLi9zY3JpcHQtaW1wb3J0ZXInO1xuaW1wb3J0IHsgUGh5c2ljc01hdGVyaWFsSW1wb3J0ZXIgfSBmcm9tICcuL3BoeXNpY3MtbWF0ZXJpYWwtaW1wb3J0ZXInO1xuaW1wb3J0IHsgRmJ4SW1wb3J0ZXIgfSBmcm9tICcuL2ZieC1pbXBvcnRlcic7XG5pbXBvcnQgeyBHbHRmSW1wb3J0ZXIgfSBmcm9tICcuL2dsdGYtaW1wb3J0ZXInO1xuaW1wb3J0IHsgRGlyZWN0b3J5SW1wb3J0ZXIgfSBmcm9tICcuL2RpcmVjdG9yeS1pbXBvcnRlcic7XG5pbXBvcnQgeyBBdXRvQXRsYXNJbXBvcnRlciB9IGZyb20gJy4vYXV0by1hdGxhcy1pbXBvcnRlcic7XG5pbXBvcnQgeyBQcmVmYWJJbXBvcnRlciB9IGZyb20gJy4vcHJlZmFiLWltcG9ydGVyJztcbmltcG9ydCB7IEltYWdlSW1wb3J0ZXIgfSBmcm9tICcuL2ltYWdlLWltcG9ydGVyJztcbmltcG9ydCB7IFNwcml0ZUZyYW1lSW1wb3J0ZXIgfSBmcm9tICcuL3Nwcml0ZS1mcmFtZS1pbXBvcnRlcic7XG5pbXBvcnQgeyBUZXh0dXJlQ3ViZUltcG9ydGVyIH0gZnJvbSAnLi90ZXh0dXJlLWN1YmUtaW1wb3J0ZXInO1xuaW1wb3J0IHsgRXJwVGV4dHVyZUN1YmVJbXBvcnRlciB9IGZyb20gJy4vZXJwLXRleHR1cmUtY3ViZS1pbXBvcnRlcic7XG5pbXBvcnQgeyBSZW5kZXJUZXh0dXJlSW1wb3J0ZXIgfSBmcm9tICcuL3JlbmRlci10ZXh0dXJlLWltcG9ydGVyJztcbmltcG9ydCB7IFByb2plY3RTZXR0aW5nc0ltcG9ydGVyIH0gZnJvbSAnLi9wcm9qZWN0LXNldHRpbmdzLWltcG9ydGVyJztcblxuZXhwb3J0ICogZnJvbSAnLi9iYXNlLWltcG9ydGVyJztcbmV4cG9ydCAqIGZyb20gJy4vaW1wb3J0ZXItbWFuYWdlcic7XG5leHBvcnQgKiBmcm9tICcuL21hdGVyaWFsLWltcG9ydGVyJztcbmV4cG9ydCAqIGZyb20gJy4vdGV4dHVyZS1pbXBvcnRlcic7XG5leHBvcnQgKiBmcm9tICcuL3NjcmlwdC1pbXBvcnRlcic7XG5leHBvcnQgKiBmcm9tICcuL3BoeXNpY3MtbWF0ZXJpYWwtaW1wb3J0ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9mYngtaW1wb3J0ZXInO1xuZXhwb3J0ICogZnJvbSAnLi9nbHRmLWltcG9ydGVyJztcbmV4cG9ydCAqIGZyb20gJy4vZGlyZWN0b3J5LWltcG9ydGVyJztcbmV4cG9ydCAqIGZyb20gJy4vYXV0by1hdGxhcy1pbXBvcnRlcic7XG5leHBvcnQgKiBmcm9tICcuL3ByZWZhYi1pbXBvcnRlcic7XG5leHBvcnQgKiBmcm9tICcuL2ltYWdlLWltcG9ydGVyJztcbmV4cG9ydCAqIGZyb20gJy4vc3ByaXRlLWZyYW1lLWltcG9ydGVyJztcbmV4cG9ydCAqIGZyb20gJy4vdGV4dHVyZS1jdWJlLWltcG9ydGVyJztcbmV4cG9ydCAqIGZyb20gJy4vZXJwLXRleHR1cmUtY3ViZS1pbXBvcnRlcic7XG5leHBvcnQgKiBmcm9tICcuL3JlbmRlci10ZXh0dXJlLWltcG9ydGVyJztcbmV4cG9ydCAqIGZyb20gJy4vcHJvamVjdC1zZXR0aW5ncy1pbXBvcnRlcic7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckFsbEltcG9ydGVycygpIHtcbiAgICBjb25zdCBtYW5hZ2VyID0gSW1wb3J0ZXJNYW5hZ2VyLmdldEluc3RhbmNlKCk7XG4gICAgXG4gICAgLy8gUHJvamVjdCBTZXR0aW5nc1xuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgUHJvamVjdFNldHRpbmdzSW1wb3J0ZXIoKSk7XG5cbiAgICAvLyBNYXRlcmlhbFxuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgTWF0ZXJpYWxJbXBvcnRlcigpKTtcbiAgICBcbiAgICAvLyBTY3JpcHRzXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBTY3JpcHRJbXBvcnRlcigpKTsgLy8gdHlwZXNjcmlwdFxuXG4gICAgLy8gUHJlZmFiXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBQcmVmYWJJbXBvcnRlcigpKTtcbiAgICBcbiAgICAvLyBUZXh0dXJlcyAmIEltYWdlc1xuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgSW1hZ2VJbXBvcnRlcigpKTtcbiAgICBtYW5hZ2VyLnJlZ2lzdGVySW1wb3J0ZXIobmV3IFRleHR1cmVJbXBvcnRlcigpKTtcbiAgICBtYW5hZ2VyLnJlZ2lzdGVySW1wb3J0ZXIobmV3IFNwcml0ZUZyYW1lSW1wb3J0ZXIoKSk7XG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBUZXh0dXJlQ3ViZUltcG9ydGVyKCkpO1xuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgRXJwVGV4dHVyZUN1YmVJbXBvcnRlcigpKTtcbiAgICBtYW5hZ2VyLnJlZ2lzdGVySW1wb3J0ZXIobmV3IFJlbmRlclRleHR1cmVJbXBvcnRlcigpKTtcbiAgICBcbiAgICAvLyBPdGhlclxuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgUGh5c2ljc01hdGVyaWFsSW1wb3J0ZXIoKSk7XG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBGYnhJbXBvcnRlcigpKTtcbiAgICBtYW5hZ2VyLnJlZ2lzdGVySW1wb3J0ZXIobmV3IEdsdGZJbXBvcnRlcigpKTtcbiAgICBtYW5hZ2VyLnJlZ2lzdGVySW1wb3J0ZXIobmV3IERpcmVjdG9yeUltcG9ydGVyKCkpO1xuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgQXV0b0F0bGFzSW1wb3J0ZXIoKSk7XG59XG4iXX0=