"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GltfImporter = void 0;
const model_base_importer_1 = require("./model-base-importer");
class GltfImporter extends model_base_importer_1.ModelBaseImporter {
    constructor() {
        super(...arguments);
        this.name = 'gltf';
    }
    addSpecificUserData(userData, container) {
        // GLTF specific properties if any
    }
}
exports.GltfImporter = GltfImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2x0Zi1pbXBvcnRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NvdXJjZS91dGNwL3V0aWxzL2Fzc2V0LWltcG9ydGVycy9nbHRmLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtEQUEwRDtBQUcxRCxNQUFhLFlBQWEsU0FBUSx1Q0FBaUI7SUFBbkQ7O1FBQ0ksU0FBSSxHQUFHLE1BQU0sQ0FBQztJQUtsQixDQUFDO0lBSGEsbUJBQW1CLENBQUMsUUFBYSxFQUFFLFNBQXVDO1FBQ2hGLGtDQUFrQztJQUN0QyxDQUFDO0NBQ0o7QUFORCxvQ0FNQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE1vZGVsQmFzZUltcG9ydGVyIH0gZnJvbSAnLi9tb2RlbC1iYXNlLWltcG9ydGVyJztcbmltcG9ydCB7IElQcm9wZXJ0eSB9IGZyb20gJ0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9zY2VuZS9AdHlwZXMvcHVibGljJztcblxuZXhwb3J0IGNsYXNzIEdsdGZJbXBvcnRlciBleHRlbmRzIE1vZGVsQmFzZUltcG9ydGVyIHtcbiAgICBuYW1lID0gJ2dsdGYnO1xuXG4gICAgcHJvdGVjdGVkIGFkZFNwZWNpZmljVXNlckRhdGEodXNlckRhdGE6IGFueSwgY29udGFpbmVyOiB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eSB9KTogdm9pZCB7XG4gICAgICAgIC8vIEdMVEYgc3BlY2lmaWMgcHJvcGVydGllcyBpZiBhbnlcbiAgICB9XG59XG4iXX0=