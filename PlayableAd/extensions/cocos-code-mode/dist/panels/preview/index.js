"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const templateRaw = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/preview/index.html'), 'utf-8');
const styleRaw = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/preview/index.css'), 'utf-8');
module.exports = Editor.Panel.define({
    template: templateRaw,
    style: styleRaw,
    $: {
        container: '#preview-container',
    },
    listeners: {},
    methods: {
        async generatePreview(uuid, width = 512, height = 512, jpegQuality = 80) {
            try {
                const info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
                if (!info)
                    throw new Error("Asset info not found");
                let previewType = '';
                let queryMethod = '';
                switch (info.importer) {
                    case 'prefab':
                    case 'fbx':
                    case 'gltf':
                    case 'gltf-skeleton':
                        previewType = 'scene:prefab-preview';
                        queryMethod = 'query-prefab-preview-data';
                        break;
                    case 'material':
                        previewType = 'scene:material-preview';
                        queryMethod = 'query-material-preview-data';
                        break;
                    case 'gltf-mesh':
                    case 'mesh':
                        previewType = 'scene:mesh-preview';
                        queryMethod = 'query-mesh-preview-data';
                        break;
                    case 'spine':
                        previewType = 'scene:spine-preview';
                        queryMethod = 'query-spine-preview-data';
                        break;
                    default:
                        previewType = 'scene:mini-preview';
                        queryMethod = 'query-scene-preview-data';
                        break;
                }
                // @ts-ignore
                const GLPreview = Editor._Module.require('PreviewExtends').default;
                const glPreview = new GLPreview(previewType, queryMethod);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                await glPreview.init({ width, height });
                await glPreview.initGL(canvas, { width, height });
                await glPreview.resizeGL(width, height);
                // Set Target
                const call = async (func, ...args) => {
                    return await Editor.Message.request('scene', 'call-preview-function', previewType, func, ...args);
                };
                if (info.importer === 'prefab' || info.importer === 'scene' || info.importer === 'fbx' || info.importer === 'gltf') {
                    await call('setPrefab', uuid);
                }
                else if (info.importer === 'material') {
                    // Match Inspector implementation
                    await call('resetCamera');
                    await call('setLightEnable', true);
                    await call('setPrimitive', 'sphere');
                    await Editor.Message.request('scene', 'preview-material', uuid);
                }
                else if (info.importer === 'gltf-mesh') {
                    await call('setModel', uuid);
                }
                else if (info.importer === 'spine') {
                    await call('setSpine', uuid);
                }
                else {
                    await call('setScene', uuid);
                }
                // Draw
                const data = await glPreview.queryPreviewData({ width, height });
                glPreview.drawGL(data);
                const dataURL = canvas.toDataURL('image/jpeg', jpegQuality);
                return dataURL.replace(/^data:image\/\w+;base64,/, '');
            }
            catch (error) {
                console.error(`[Preview] Error:`, error);
                throw new Error(`Generaton failed: ${error.message}`);
            }
        },
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL3ByZXZpZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwyQkFBa0M7QUFDbEMsK0JBQTRCO0FBRTVCLE1BQU0sV0FBVyxHQUFHLElBQUEsaUJBQVksRUFBQyxJQUFBLFdBQUksRUFBQyxTQUFTLEVBQUUsNkNBQTZDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMxRyxNQUFNLFFBQVEsR0FBRyxJQUFBLGlCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLHlDQUF5QyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFFbkcsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNqQyxRQUFRLEVBQUUsV0FBVztJQUNyQixLQUFLLEVBQUUsUUFBUTtJQUNmLENBQUMsRUFBRTtRQUNDLFNBQVMsRUFBRSxvQkFBb0I7S0FDbEM7SUFFRCxTQUFTLEVBQUUsRUFDVjtJQUVELE9BQU8sRUFBRTtRQUNMLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBWSxFQUFFLFFBQWdCLEdBQUcsRUFBRSxTQUFpQixHQUFHLEVBQUUsY0FBc0IsRUFBRTtZQUNuRyxJQUFJLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2hGLElBQUksQ0FBQyxJQUFJO29CQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztnQkFFbkQsSUFBSSxXQUFXLEdBQUcsRUFBRSxDQUFDO2dCQUNyQixJQUFJLFdBQVcsR0FBRyxFQUFFLENBQUM7Z0JBRXJCLFFBQVEsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUNwQixLQUFLLFFBQVEsQ0FBQztvQkFDZCxLQUFL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TUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO3FCQUFNLENBQUM7b0JBQ0gsTUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNsQyxDQUFDO2dCQUVELE9BQU87Z0JBQ1AsTUFBTSxJQUFJLEdBQUcsTUFBTSxTQUFTLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztnQkFFakUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFFdkIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBRTVELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUUzRCxDQUFDO1lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztnQkFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDekMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDMUQsQ0FBQztRQUNMLENBQUM7S0FDSjtDQUNHLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcblxuY29uc3QgdGVtcGxhdGVSYXcgPSByZWFkRmlsZVN5bmMoam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zdGF0aWMvdGVtcGxhdGUvcHJldmlldy9pbmRleC5odG1sJyksICd1dGYtOCcpO1xuY29uc3Qgc3R5bGVSYXcgPSByZWFkRmlsZVN5bmMoam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zdGF0aWMvc3R5bGUvcHJldmlldy9pbmRleC5jc3MnKSwgJ3V0Zi04Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRWRpdG9yLlBhbmVsLmRlZmluZSh7XG4gICAgdGVtcGxhdGU6IHRlbXBsYXRlUmF3LFxuICAgIHN0eWxlOiBzdHlsZVJhdyxcbiAgICAkOiB7XG4gICAgICAgIGNvbnRhaW5lcjogJyNwcmV2aWV3LWNvbnRhaW5lcicsXG4gICAgfSxcbiAgICBcbiAgICBsaXN0ZW5lcnM6IHtcbiAgICB9LFxuICAgIFxuICAgIG1ldGhvZHM6IHtcbiAgICAgICAgYXN5bmMgZ2VuZXJhdGVQcmV2aWV3KHV1aWQ6IHN0cmluZywgd2lkdGg6IG51bWJlciA9IDUxMiwgaGVpZ2h0OiBudW1iZXIgPSA1MTIsIGpwZWdRdWFsaXR5OiBudW1iZXIgPSA4MCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFpbmZvKSB0aHJvdyBuZXcgRXJyb3IoXCJBc3NldCBpbmZvIG5vdCBmb3VuZFwiKTtcbiAgICBcbiAgICAgICAgICAgICAgICBsZXQgcHJldmlld1R5cGUgPSAnJztcbiAgICAgICAgICAgICAgICBsZXQgcXVlcnlNZXRob2QgPSAnJztcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGluZm8uaW1wb3J0ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAncHJlZmFiJzpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZmJ4JzpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZ2x0Zic6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2dsdGYtc2tlbGV0b24nOlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlld1R5cGUgPSAnc2NlbmU6cHJlZmFiLXByZXZpZXcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgcXVlcnlNZXRob2QgPSAncXVlcnktcHJlZmFiLXByZXZpZXctZGF0YSc7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbWF0ZXJpYWwnOlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlld1R5cGUgPSAnc2NlbmU6bWF0ZXJpYWwtcHJldmlldyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVyeU1ldGhvZCA9ICdxdWVyeS1tYXRlcmlhbC1wcmV2aWV3LWRhdGEnO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2dsdGYtbWVzaCc6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ21lc2gnOlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlld1R5cGUgPSAnc2NlbmU6bWVzaC1wcmV2aWV3JztcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5TWV0aG9kID0gJ3F1ZXJ5LW1lc2gtcHJldmlldy1kYXRhJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdzcGluZSc6XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2aWV3VHlwZSA9ICdzY2VuZTpzcGluZS1wcmV2aWV3JztcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5TWV0aG9kID0gJ3F1ZXJ5LXNwaW5lLXByZXZpZXctZGF0YSc7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpZXdUeXBlID0gJ3NjZW5lOm1pbmktcHJldmlldyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVyeU1ldGhvZCA9ICdxdWVyeS1zY2VuZS1wcmV2aWV3LWRhdGEnO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICBjb25zdCBHTFByZXZpZXcgPSBFZGl0b3IuX01vZHVsZS5yZXF1aXJlKCdQcmV2aWV3RXh0ZW5kcycpLmRlZmF1bHQ7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2xQcmV2aWV3ID0gbmV3IEdMUHJldmlldyhwcmV2aWV3VHlwZSwgcXVlcnlNZXRob2QpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICAgICAgICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgICAgICAgICAgIGNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgYXdhaXQgZ2xQcmV2aWV3LmluaXQoeyB3aWR0aCwgaGVpZ2h0IH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IGdsUHJldmlldy5pbml0R0woY2FudmFzLCB7IHdpZHRoLCBoZWlnaHQgfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgZ2xQcmV2aWV3LnJlc2l6ZUdMKHdpZHRoLCBoZWlnaHQpO1xuICAgIFxuICAgICAgICAgICAgICAgIC8vIFNldCBUYXJnZXRcbiAgICAgICAgICAgICAgICBjb25zdCBjYWxsID0gYXN5bmMgKGZ1bmM6IHN0cmluZywgLi4uYXJnczogYW55W10pID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjYWxsLXByZXZpZXctZnVuY3Rpb24nLCBwcmV2aWV3VHlwZSwgZnVuYywgLi4uYXJncyk7IFxuICAgICAgICAgICAgICAgIH07XG4gICAgXG4gICAgICAgICAgICAgICAgaWYgKGluZm8uaW1wb3J0ZXIgPT09ICdwcmVmYWInIHx8IGluZm8uaW1wb3J0ZXIgPT09ICdzY2VuZScgfHwgaW5mby5pbXBvcnRlciA9PT0gJ2ZieCcgfHwgaW5mby5pbXBvcnRlciA9PT0gJ2dsdGYnKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGNhbGwoJ3NldFByZWZhYicsIHV1aWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5mby5pbXBvcnRlciA9PT0gJ21hdGVyaWFsJykge1xuICAgICAgICAgICAgICAgICAgICAvLyBNYXRjaCBJbnNwZWN0b3IgaW1wbGVtZW50YXRpb25cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2FsbCgncmVzZXRDYW1lcmEnKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2FsbCgnc2V0TGlnaHRFbmFibGUnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2FsbCgnc2V0UHJpbWl0aXZlJywgJ3NwaGVyZScpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdwcmV2aWV3LW1hdGVyaWFsJywgdXVpZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpbmZvLmltcG9ydGVyID09PSAnZ2x0Zi1tZXNoJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBjYWxsKCdzZXRNb2RlbCcsIHV1aWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5mby5pbXBvcnRlciA9PT0gJ3NwaW5lJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBjYWxsKCdzZXRTcGluZScsIHV1aWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICBhd2FpdCBjYWxsKCdzZXRTY2VuZScsIHV1aWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICBcbiAgICAgICAgICAgICAgICAvLyBEcmF3XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGdsUHJldmlldy5xdWVyeVByZXZpZXdEYXRhKHsgd2lkdGgsIGhlaWdodCB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBnbFByZXZpZXcuZHJhd0dMKGRhdGEpO1xuICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFVUkwgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9qcGVnJywganBlZ1F1YWxpdHkpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFVUkwucmVwbGFjZSgvXmRhdGE6aW1hZ2VcXC9cXHcrO2Jhc2U2NCwvLCAnJyk7XG4gICAgXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW1ByZXZpZXddIEVycm9yOmAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEdlbmVyYXRvbiBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICB9XG59IGFzIGFueSk7XG4iXX0=