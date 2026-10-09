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
exports.EditorTools = void 0;
const package_json_1 = __importDefault(require("../../../package.json"));
const decorators_1 = require("../decorators");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const schemas_1 = require("../schemas");
class EditorTools {
    async editorOperate(args) {
        switch (args.operation) {
            case 'save_scene_or_prefab':
                await Editor.Message.request('scene', 'save-scene');
                return { success: true };
            case 'close_scene_or_prefab':
                await Editor.Message.request('scene', 'close-scene');
                return { success: true };
            case 'play_preview':
                await Editor.Message.request('scene', 'editor-preview-set-play', true);
                return { success: true };
            case 'pause':
                await Editor.Message.request('scene', 'editor-preview-call-method', 'pause', true);
                return { success: true };
            case 'step':
                await Editor.Message.request('scene', 'editor-preview-call-method', 'step');
                return { success: true };
            case 'stop':
                await Editor.Message.request('scene', 'editor-preview-set-play', false);
                return { success: true };
            case 'refresh':
                await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets');
                return { success: true };
            default:
                throw new Error(`Unknown operation: ${args.operation}`);
        }
    }
    async editorGetLogs(args) {
        const projectPath = Editor.Project.path;
        const logPath = path.join(projectPath, 'temp', 'logs', 'project.log');
        if (args.showStack === undefined) {
            args.showStack = false;
        }
        if (!fs.existsSync(logPath)) {
            throw new Error(`Log file not found at ${logPath}`);
        }
        const entries = [];
        const fd = fs.openSync(logPath, 'r');
        try {
            const stats = fs.fstatSync(fd);
            const fileSize = stats.size;
            const bufferSize = 10 * 1024; // 10KB chunks
            const buffer = Buffer.alloc(bufferSize);
            let position = fileSize;
            let leftover = '';
            let accumulatedBody = ''; // Text belonging to the current (bottom-most) entry being parsed
            const regex = /^(\d{1,2}-\d{1,2}-\d{4}\s\d{2}:\d{2}:\d{2}\s-\s(?:log|warn|error|info):\s)/;
            const timestampRegex = /^\d{1,2}-\d{1,2}-\d{4}\s\d{2}:\d{2}:\d{2}\s-\s/;
            let lastContent = null;
            let lastCount = 0;
            while (position > 0 && entries.length < args.count) {
                const readSize = Math.min(bufferSize, position);
                const readPos = position - readSize;
                fs.readSync(fd, buffer, 0, readSize, readPos);
                position -= readSize;
                const chunk = buffer.toString('utf-8', 0, readSize);
                const combined = chunk + leftover;
                // Split by newline
                const lines = combined.split(/\r?\n/);
                if (position > 0) {
                    leftover = lines.shift() || '';
                }
                else {
                    leftover = ''; // Process all
                }
                // Process lines in reverse (bottom to top of the chunk)
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i];
                    // Check if this line is a Header (Start of Entry)
                    if (regex.test(line)) {
                        let entry = line;
                        if (args.showStack && accumulatedBody.length > 0) {
                            entry += '\n' + accumulatedBody;
                        }
                        const cleaned = entry.replace(timestampRegex, '');
                        if (cleaned === lastContent) {
                            lastCount++;
                            entries[entries.length - 1] = `(${lastCount}) ${cleaned}`;
                        }
                        else {
                            if (entries.length >= args.count) {
                                // Found a new group but we already have enough
                                position = 0; // Stop reading file loop
                                break; // Stop lines loop
                            }
                            lastContent = cleaned;
                            lastCount = 1;
                            entries.push(cleaned);
                        }
                        accumulatedBody = ''; // Reset for the next entry (upwards)
                    }
                    else {
                        // This identifies as body text (or empty line) belonging to the entry "above" it
                        if (args.showStack && accumulatedBody.length > 0) {
                            accumulatedBody = line + '\n' + accumulatedBody;
                        }
                        else {
                            accumulatedBody = line;
                        }
                    }
                }
            }
        }
        finally {
            fs.closeSync(fd);
        }
        // We pushed entries in reverse order (newest first).
        if (args.order === 'oldest-to-newest') {
            return { logLines: entries.reverse() };
        }
        return { logLines: entries };
    }
    async editorGetScenePreview(args) {
        var _a, _b, _c, _d;
        const result = await Editor.Message.request('scene', 'execute-scene-script', {
            name: package_json_1.default.name,
            method: 'captureScreenshot',
            args: [(_a = args.imageSize) !== null && _a !== void 0 ? _a : { width: 512, height: 512 }, (_b = args.jpegQuality) !== null && _b !== void 0 ? _b : 80, args.cameraPosition, args.targetPosition, (_c = args.orthographic) !== null && _c !== void 0 ? _c : false, (_d = args.orthographicSize) !== null && _d !== void 0 ? _d : 10]
        });
        return { type: 'image', data: result, mimeType: 'image/jpeg' };
    }
}
exports.EditorTools = EditorTools;
__decorate([
    (0, decorators_1.utcpTool)('editorOperate', 'Common editor operations for scene and prefab view, game preview controls and asset database refresh', {
        type: 'object',
        properties: {
            operation: { type: 'string', enum: ['save_scene_or_prefab', 'close_scene_or_prefab', 'play_preview', 'pause', 'step', 'stop', 'refresh'] }
        },
        required: ['operation']
    }, schemas_1.SuccessIndicatorSchema, "POST", ['operation', 'editor', 'scene', 'prefab', 'preview', 'asset', 'refresh'])
], EditorTools.prototype, "editorOperate", null);
__decorate([
    (0, decorators_1.utcpTool)('editorGetLogs', 'Get last N editor log entries', {
        type: 'object',
        properties: {
            count: { type: 'number', description: 'Number of log entries to retrieve', default: 10 },
            showStack: { type: 'boolean', description: 'Return full stack trace for each log entry' },
            order: { type: 'string', enum: ['newest-to-oldest', 'oldest-to-newest'], description: 'Order of logs', default: 'newest-to-oldest' }
        },
        required: ['count', 'order']
    }, { type: 'object', properties: { logLines: { type: 'array', items: { type: 'string' } } }, required: ['logLines'] }, "GET", ['editor', 'logs', 'debug', 'info'])
], EditorTools.prototype, "editorGetLogs", null);
__decorate([
    (0, decorators_1.utcpTool)('editorGetScenePreview', 'Returns preview image of scene view. IMPORTANT: To visualize the image, you must return the result of this function DIRECTLY as the final value of your code, do NOT wrap it in an object.', {
        type: 'object',
        properties: {
            imageSize: { type: 'object', properties: { width: { type: 'number', default: 512 }, height: { type: 'number', default: 512 } }, nullable: true },
            jpegQuality: { type: 'integer', minimum: 40, maximum: 100, default: 80 },
            cameraPosition: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }, required: ['x', 'y', 'z'], description: 'Camera world position' },
            targetPosition: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }, required: ['x', 'y', 'z'], description: 'Point the camera looks at' },
            orthographic: { type: 'boolean', default: false, description: 'Whether to use orthographic projection' },
            orthographicSize: { type: 'number', default: 10, description: 'Orthographic size (only applies if orthographic is true)' }
        },
        required: ['cameraPosition', 'targetPosition']
    }, schemas_1.Base64ImageSchema, "GET", ['scene', 'screenshot', 'preview', 'inspection', 'image'])
], EditorTools.prototype, "editorGetScenePreview", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL3V0Y3AvdG9vbHMvZWRpdG9yLXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHlFQUFnRDtBQUNoRCw4Q0FBeUM7QUFDekMsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3Qix3Q0FBd0c7QUFFeEcsTUFBYSxXQUFXO0lBY2QsQUFBTixLQUFLLENBQUMsYUFBYSxDQUFDLElBQTJCO1FBQzNDLFFBQVEsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3JCLEtBQUssc0JBQXNCO2dCQUN2QixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFDcEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUM3QixLQUFLLHVCQUF1QjtnQkFDeEIsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7Z0JBQ3JELE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7WUFDN0IsS0FBSyxjQUFjO2dCQUNmLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHlCQUF5QixFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO1lBQzdCLEtBQUssT0FBTztnQkFDUixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ25GLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7WUFDN0IsS0FBSyxNQUFNO2dCQUNOLE1BQU0sTUFBTSxD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LEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxXQUFXLEVBQUUsdUJBQXVCLEVBQUM7WUFDdkwsY0FBYyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsV0FBVyxFQUFFLDJCQUEyQixFQUFDO1lBQzNMLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsd0NBQXdDLEVBQUM7WUFDdkcsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLDBEQUEwRCxFQUFDO1NBQzVIO1FBQ0QsUUFBUSxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsZ0JBQWdCLENBQUM7S0FDakQsRUFDRCwyQkFBaUIsRUFBRSxLQUFLLEVBQUUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQ3RGO3dEQWlCQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYWNrYWdlSlNPTiBmcm9tICcuLi8uLi8uLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IHsgdXRjcFRvb2wgfSBmcm9tICcuLi9kZWNvcmF0b3JzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBCYXNlNjRJbWFnZVNjaGVtYSwgSUJhc2U2NEltYWdlLCBJU3VjY2Vzc0luZGljYXRvciwgU3VjY2Vzc0luZGljYXRvclNjaGVtYSB9IGZyb20gJy4uL3NjaGVtYXMnO1xuXG5leHBvcnQgY2xhc3MgRWRpdG9yVG9vbHMge1xuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnZWRpdG9yT3BlcmF0ZScsXG4gICAgICAgICdDb21tb24gZWRpdG9yIG9wZXJhdGlvbnMgZm9yIHNjZW5lIGFuZCBwcmVmYWIgdmlldywgZ2FtZSBwcmV2aWV3IGNvbnRyb2xzIGFuZCBhc3NldCBkYXRhYmFzZSByZWZyZXNoJyxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgb3BlcmF0aW9uOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ3NhdmVfc2NlbmVfb3JfcHJlZmFiJywgJ2Nsb3NlX3NjZW5lX29yX3ByZWZhYicsICdwbGF5X3ByZXZpZXcnLCAncGF1c2UnLCAnc3RlcCcsICdzdG9wJywgJ3JlZnJlc2gnXSB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnb3BlcmF0aW9uJ11cbiAgICAgICAgfSxcbiAgICAgICAgU3VjY2Vzc0luZGljYXRvclNjaGVtYSwgXCJQT1NUXCIsICBbJ29wZXJhdGlvbicsICdlZGl0b3InLCAnc2NlbmUnLCAncHJlZmFiJywgJ3ByZXZpZXcnLCAnYXNzZXQnLCAncmVmcmVzaCddXG4gICAgKVxuICAgIGFzeW5jIGVkaXRvck9wZXJhdGUoYXJnczogeyBvcGVyYXRpb246IHN0cmluZyB9KTogUHJvbWlzZTxJU3VjY2Vzc0luZGljYXRvcj4ge1xuICAgICAgICBzd2l0Y2ggKGFyZ3Mub3BlcmF0aW9uKSB7XG4gICAgICAgICAgICBjYXNlICdzYXZlX3NjZW5lX29yX3ByZWZhYic6XG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2F2ZS1zY2VuZScpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgICAgIGNhc2UgJ2Nsb3NlX3NjZW5lX29yX3ByZWZhYic6XG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY2xvc2Utc2NlbmUnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgICAgICBjYXNlICdwbGF5X3ByZXZpZXcnOlxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2VkaXRvci1wcmV2aWV3LXNldC1wbGF5JywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICAgICAgY2FzZSAncGF1c2UnOlxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2VkaXRvci1wcmV2aWV3LWNhbGwtbWV0aG9kJywgJ3BhdXNlJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICAgICAgY2FzZSAnc3RlcCc6XG4gICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2VkaXRvci1wcmV2aWV3LWNhbGwtbWV0aG9kJywgJ3N0ZXAnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgICAgICBjYXNlICdzdG9wJzpcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdlZGl0b3ItcHJldmlldy1zZXQtcGxheScsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgICAgICBjYXNlICdyZWZyZXNoJzpcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JywgJ2RiOi8vYXNzZXRzJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gb3BlcmF0aW9uOiAke2FyZ3Mub3BlcmF0aW9ufWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgQHV0Y3BUb29sKFxuICAgICAgICAnZWRpdG9yR2V0TG9ncycsXG4gICAgICAgICdHZXQgbGFzdCBOIGVkaXRvciBsb2cgZW50cmllcycsXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIGNvdW50OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ051bWJlciBvZiBsb2cgZW50cmllcyB0byByZXRyaWV2ZScsIGRlZmF1bHQ6IDEwIH0sXG4gICAgICAgICAgICAgICAgc2hvd1N0YWNrOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdSZXR1cm4gZnVsbCBzdGFjayB0cmFjZSBmb3IgZWFjaCBsb2cgZW50cnknIH0sXG4gICAgICAgICAgICAgICAgb3JkZXI6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFsnbmV3ZXN0LXRvLW9sZGVzdCcsICdvbGRlc3QtdG8tbmV3ZXN0J10sIGRlc2NyaXB0aW9uOiAnT3JkZXIgb2YgbG9ncycsIGRlZmF1bHQ6ICduZXdlc3QtdG8tb2xkZXN0JyB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnY291bnQnLCAnb3JkZXInXVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IGxvZ0xpbmVzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSB9LCByZXF1aXJlZDogWydsb2dMaW5lcyddIH0sIFwiR0VUXCIsICBbJ2VkaXRvcicsICdsb2dzJywgJ2RlYnVnJywgJ2luZm8nXVxuICAgIClcbiAgICBhc3luYyBlZGl0b3JHZXRMb2dzKGFyZ3M6IHsgY291bnQ6IG51bWJlciwgc2hvd1N0YWNrOiBib29sZWFuLCBvcmRlcjogJ25ld2VzdC10by1vbGRlc3QnIHwgJ29sZGVzdC10by1uZXdlc3QnIH0pOiBQcm9taXNlPHsgbG9nTGluZXM6IHN0cmluZ1tdIH0+IHtcbiAgICAgICAgY29uc3QgcHJvamVjdFBhdGggPSBFZGl0b3IuUHJvamVjdC5wYXRoO1xuICAgICAgICBjb25zdCBsb2dQYXRoID0gcGF0aC5qb2luKHByb2plY3RQYXRoLCAndGVtcCcsICdsb2dzJywgJ3Byb2plY3QubG9nJyk7XG5cbiAgICAgICAgaWYgKGFyZ3Muc2hvd1N0YWNrID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGFyZ3Muc2hvd1N0YWNrID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobG9nUGF0aCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTG9nIGZpbGUgbm90IGZvdW5kIGF0ICR7bG9nUGF0aH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGVudHJpZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IGZkID0gZnMub3BlblN5bmMobG9nUGF0aCwgJ3InKTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IGZzLmZzdGF0U3luYyhmZCk7XG4gICAgICAgICAgICBjb25zdCBmaWxlU2l6ZSA9IHN0YXRzLnNpemU7XG4gICAgICAgICAgICBjb25zdCBidWZmZXJTaXplID0gMTAgKiAxMDI0OyAvLyAxMEtCIGNodW5rc1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmFsbG9jKGJ1ZmZlclNpemUpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcG9zaXRpb24gPSBmaWxlU2l6ZTtcbiAgICAgICAgICAgIGxldCBsZWZ0b3ZlciA9ICcnO1xuICAgICAgICAgICAgbGV0IGFjY3VtdWxhdGVkQm9keSA9ICcnOyAvLyBUZXh0IGJlbG9uZ2luZyB0byB0aGUgY3VycmVudCAoYm90dG9tLW1vc3QpIGVudHJ5IGJlaW5nIHBhcnNlZFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCByZWdleCA9IC9eKFxcZHsxLDJ9LVxcZHsxLDJ9LVxcZHs0fVxcc1xcZHsyfTpcXGR7Mn06XFxkezJ9XFxzLVxccyg/OmxvZ3x3YXJufGVycm9yfGluZm8pOlxccykvO1xuICAgICAgICAgICAgY29uc3QgdGltZXN0YW1wUmVnZXggPSAvXlxcZHsxLDJ9LVxcZHsxLDJ9LVxcZHs0fVxcc1xcZHsyfTpcXGR7Mn06XFxkezJ9XFxzLVxccy87XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBsYXN0Q29udGVudDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgbGFzdENvdW50ID0gMDtcblxuICAgICAgICAgICAgd2hpbGUgKHBvc2l0aW9uID4gMCAmJiBlbnRyaWVzLmxlbmd0aCA8IGFyZ3MuY291bnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWFkU2l6ZSA9IE1hdGgubWluKGJ1ZmZlclNpemUsIHBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZWFkUG9zID0gcG9zaXRpb24gLSByZWFkU2l6ZTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBmcy5yZWFkU3luYyhmZCwgYnVmZmVyLCAwLCByZWFkU2l6ZSwgcmVhZFBvcyk7XG4gICAgICAgICAgICAgICAgcG9zaXRpb24gLT0gcmVhZFNpemU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBidWZmZXIudG9TdHJpbmcoJ3V0Zi04JywgMCwgcmVhZFNpemUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbWJpbmVkID0gY2h1bmsgKyBsZWZ0b3ZlcjtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBuZXdsaW5lXG4gICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBjb21iaW5lZC5zcGxpdCgvXFxyP1xcbi8pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChwb3NpdGlvbiA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGVmdG92ZXIgPSBsaW5lcy5zaGlmdCgpIHx8ICcnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxlZnRvdmVyID0gJyc7IC8vIFByb2Nlc3MgYWxsXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUHJvY2VzcyBsaW5lcyBpbiByZXZlcnNlIChib3R0b20gdG8gdG9wIG9mIHRoZSBjaHVuaylcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gbGluZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhpcyBsaW5lIGlzIGEgSGVhZGVyIChTdGFydCBvZiBFbnRyeSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZ2V4LnRlc3QobGluZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbnRyeSA9IGxpbmU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5zaG93U3RhY2sgJiYgYWNjdW11bGF0ZWRCb2R5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRyeSArPSAnXFxuJyArIGFjY3VtdWxhdGVkQm9keTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2xlYW5lZCA9IGVudHJ5LnJlcGxhY2UodGltZXN0YW1wUmVnZXgsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsZWFuZWQgPT09IGxhc3RDb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdENvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cmllc1tlbnRyaWVzLmxlbmd0aCAtIDFdID0gYCgke2xhc3RDb3VudH0pICR7Y2xlYW5lZH1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50cmllcy5sZW5ndGggPj0gYXJncy5jb3VudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3VuZCBhIG5ldyBncm91cCBidXQgd2UgYWxyZWFkeSBoYXZlIGVub3VnaFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IDA7IC8vIFN0b3AgcmVhZGluZyBmaWxlIGxvb3BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7IC8vIFN0b3AgbGluZXMgbG9vcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0Q29udGVudCA9IGNsZWFuZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdENvdW50ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRyaWVzLnB1c2goY2xlYW5lZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY3VtdWxhdGVkQm9keSA9ICcnOyAvLyBSZXNldCBmb3IgdGhlIG5leHQgZW50cnkgKHVwd2FyZHMpXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGlkZW50aWZpZXMgYXMgYm9keSB0ZXh0IChvciBlbXB0eSBsaW5lKSBiZWxvbmdpbmcgdG8gdGhlIGVudHJ5IFwiYWJvdmVcIiBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3Muc2hvd1N0YWNrICYmIGFjY3VtdWxhdGVkQm9keS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjdW11bGF0ZWRCb2R5ID0gbGluZSArICdcXG4nICsgYWNjdW11bGF0ZWRCb2R5O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2N1bXVsYXRlZEJvZHkgPSBsaW5lO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBmcy5jbG9zZVN5bmMoZmQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2UgcHVzaGVkIGVudHJpZXMgaW4gcmV2ZXJzZSBvcmRlciAobmV3ZXN0IGZpcnN0KS5cbiAgICAgICAgaWYgKGFyZ3Mub3JkZXIgPT09ICdvbGRlc3QtdG8tbmV3ZXN0Jykge1xuICAgICAgICAgICAgIHJldHVybiB7IGxvZ0xpbmVzOiBlbnRyaWVzLnJldmVyc2UoKSB9O1xuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHsgbG9nTGluZXM6IGVudHJpZXMgfTtcbiAgICB9XG5cbiAgICBAdXRjcFRvb2woXG4gICAgICAgICdlZGl0b3JHZXRTY2VuZVByZXZpZXcnLFxuICAgICAgICAnUmV0dXJucyBwcmV2aWV3IGltYWdlIG9mIHNjZW5lIHZpZXcuIElNUE9SVEFOVDogVG8gdmlzdWFsaXplIHRoZSBpbWFnZSwgeW91IG11c3QgcmV0dXJuIHRoZSByZXN1bHQgb2YgdGhpcyBmdW5jdGlvbiBESVJFQ1RMWSBhcyB0aGUgZmluYWwgdmFsdWUgb2YgeW91ciBjb2RlLCBkbyBOT1Qgd3JhcCBpdCBpbiBhbiBvYmplY3QuJyxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgaW1hZ2VTaXplOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHdpZHRoOiB7IHR5cGU6ICdudW1iZXInLCBkZWZhdWx0OiA1MTIgfSwgaGVpZ2h0OiB7IHR5cGU6ICdudW1iZXInLCBkZWZhdWx0OiA1MTIgfSB9LCBudWxsYWJsZTogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgIGpwZWdRdWFsaXR5OiB7IHR5cGU6ICdpbnRlZ2VyJywgbWluaW11bTogNDAsIG1heGltdW06IDEwMCwgZGVmYXVsdDogODAgfSxcbiAgICAgICAgICAgICAgICBjYW1lcmFQb3NpdGlvbjogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyB4OiB7IHR5cGU6ICdudW1iZXInIH0sIHk6IHsgdHlwZTogJ251bWJlcicgfSwgejogeyB0eXBlOiAnbnVtYmVyJyB9IH0sIHJlcXVpcmVkOiBbJ3gnLCAneScsICd6J10sIGRlc2NyaXB0aW9uOiAnQ2FtZXJhIHdvcmxkIHBvc2l0aW9uJ30sXG4gICAgICAgICAgICAgICAgdGFyZ2V0UG9zaXRpb246IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgeDogeyB0eXBlOiAnbnVtYmVyJyB9LCB5OiB7IHR5cGU6ICdudW1iZXInIH0sIHo6IHsgdHlwZTogJ251bWJlcicgfSB9LCByZXF1aXJlZDogWyd4JywgJ3knLCAneiddLCBkZXNjcmlwdGlvbjogJ1BvaW50IHRoZSBjYW1lcmEgbG9va3MgYXQnfSxcbiAgICAgICAgICAgICAgICBvcnRob2dyYXBoaWM6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZWZhdWx0OiBmYWxzZSwgZGVzY3JpcHRpb246ICdXaGV0aGVyIHRvIHVzZSBvcnRob2dyYXBoaWMgcHJvamVjdGlvbid9LFxuICAgICAgICAgICAgICAgIG9ydGhvZ3JhcGhpY1NpemU6IHsgdHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IDEwLCBkZXNjcmlwdGlvbjogJ09ydGhvZ3JhcGhpYyBzaXplIChvbmx5IGFwcGxpZXMgaWYgb3J0aG9ncmFwaGljIGlzIHRydWUpJ31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZDogWydjYW1lcmFQb3NpdGlvbicsICd0YXJnZXRQb3NpdGlvbiddXG4gICAgICAgIH0sXG4gICAgICAgIEJhc2U2NEltYWdlU2NoZW1hLCBcIkdFVFwiLCBbJ3NjZW5lJywgJ3NjcmVlbnNob3QnLCAncHJldmlldycsICdpbnNwZWN0aW9uJywgJ2ltYWdlJ11cbiAgICApXG4gICAgYXN5bmMgZWRpdG9yR2V0U2NlbmVQcmV2aWV3KGFyZ3M6IHsgXG4gICAgICAgIGltYWdlU2l6ZT86IHsgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIgfSwgXG4gICAgICAgIGpwZWdRdWFsaXR5PzogbnVtYmVyLCBcbiAgICAgICAgY2FtZXJhUG9zaXRpb24/OiB7IHg6IG51bWJlciwgeTogbnVtYmVyLCB6OiBudW1iZXIgfSwgXG4gICAgICAgIHRhcmdldFBvc2l0aW9uPzogeyB4OiBudW1iZXIsIHk6IG51bWJlciwgejogbnVtYmVyIH0sXG4gICAgICAgIG9ydGhvZ3JhcGhpYz86IGJvb2xlYW4sXG4gICAgICAgIG9ydGhvZ3JhcGhpY1NpemU/OiBudW1iZXJcbiAgICB9KTogUHJvbWlzZTxJQmFzZTY0SW1hZ2U+IHtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgIG5hbWU6IHBhY2thZ2VKU09OLm5hbWUsXG4gICAgICAgICAgICBtZXRob2Q6ICdjYXB0dXJlU2NyZWVuc2hvdCcsXG4gICAgICAgICAgICBhcmdzOiBbYXJncy5pbWFnZVNpemUgPz8geyB3aWR0aDogNTEyLCBoZWlnaHQ6IDUxMiB9LCBhcmdzLmpwZWdRdWFsaXR5ID8/IDgwLCBhcmdzLmNhbWVyYVBvc2l0aW9uICwgYXJncy50YXJnZXRQb3NpdGlvbiwgYXJncy5vcnRob2dyYXBoaWMgPz8gZmFsc2UsIGFyZ3Mub3J0aG9ncmFwaGljU2l6ZSA/PyAxMF1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHsgdHlwZTogJ2ltYWdlJywgZGF0YTogcmVzdWx0LCBtaW1lVHlwZTogJ2ltYWdlL2pwZWcnIH07XG4gICAgfVxufVxuIl19