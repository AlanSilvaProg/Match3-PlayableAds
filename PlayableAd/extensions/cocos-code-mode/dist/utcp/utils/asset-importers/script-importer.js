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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptImporter = void 0;
const base_importer_1 = require("./base-importer");
const fs = __importStar(require("fs"));
class ScriptImporter extends base_importer_1.BaseAssetImporter {
    constructor() {
        super(...arguments);
        this.name = 'typescript';
    }
    async getProperties(assetInfo) {
        const filePath = assetInfo.file;
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error(`File not found for asset ${assetInfo.uuid}`);
        }
        try {
            // Limit to 400 lines or 20000 chars, similar to engine inspector
            const content = fs.readFileSync(filePath, 'utf-8');
            const MAX_CHARS = 20000;
            const MAX_LINES = 400;
            let truncated = false;
            let finalContent = content;
            if (finalContent.length > MAX_CHARS) {
                finalContent = finalContent.substring(0, MAX_CHARS);
                truncated = true;
            }
            const lines = finalContent.split('\n');
            if (lines.length > MAX_LINES) {
                finalContent = lines.slice(0, MAX_LINES).join('\n');
                truncated = true;
            }
            if (truncated) {
                finalContent += '\n... (truncated)';
            }
            return this.parseUserData(finalContent, this.name);
        }
        catch (e) {
            return {
                error: {
                    type: 'String',
                    value: 'Failed to read script file: ' + e,
                    displayName: 'Error',
                    readonly: true
                }
            };
        }
    }
    parseUserData(content, language) {
        return {
            content: {
                value: content,
                type: 'String',
                displayName: 'Content',
                readonly: true
            },
            language: {
                value: language,
                type: 'String',
                displayName: 'Language',
                readonly: true
            }
        };
    }
}
exports.ScriptImporter = ScriptImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0LWltcG9ydGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc291cmNlL3V0Y3AvdXRpbHMvYXNzZXQtaW1wb3J0ZXJzL3NjcmlwdC1pbXBvcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxtREFBb0Q7QUFHcEQsdUNBQXlCO0FBRXpCLE1BQWEsY0FBZSxTQUFRLGlDQUFpQjtJQUFyRDs7UUFDSSxTQUFJLEdBQUcsWUFBWSxDQUFDO0lBNkR4QixDQUFDO0lBM0RHLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBcUI7UUFDckMsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQztRQUNoQyxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFFRCxJQUFJLENBQUM7WUFDRCxpRUFBaUU7WUFDakUsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDbkQsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ3hCLE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQztZQUV0QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDdEIsSUFBSSxZQUFZLEdBQUcsT0FBTyxDQUFDO1lBRTNCLElBQUksWUFBWSxDQUFDLE1BQU0sR0FBRyxTQUFTLEVBQUUsQ0FBQztnQkFDbEMsWUFBWSxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUNwRCxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ3JCLENBQUM7WUFFRCxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3ZDLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxTQUFTLEVBQUUsQ0FBQztnQkFDM0IsWUFBWSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDcEQsU0FBUyxHQUFHLElBQUksQ0FBQztZQUNyQixDQUFDO1lBRUQsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDWixZQUFZLElBQUksbUJBQW1CLENBQUM7WUFDeEMsQ0FBQztZQUVELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1QsT0FBTztnQkFDSCxLQUFLLEVBQUU7b0JBQ0gsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsS0FBSyxFQUFFLDhCQUE4QixHQUFHLENBQUM7b0JBQ3pDLFdBQVcsRUFBRSxPQUFPO29CQUNwQixRQUFRLEVBQUUsSUFBSTtpQkFDakI7YUFDSixDQUFDO1FBQ04sQ0FBQztJQUNMLENBQUM7SUFFTSxhQUFhLENBQUMsT0FBZSxFQUFFLFFBQWdCO1FBQ2xELE9BQU87WUFDSCxPQUFPLEVBQUU7Z0JBQ0wsS0FBSyxFQUFFLE9BQU87Z0JBQ2QsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsV0FBVyxFQUFFLFNBQVM7Z0JBQ3RCLFFBQVEsRUFBRSxJQUFJO2FBQ2pCO1lBQ0QsUUFBUSxFQUFFO2dCQUNOLEtBQUssRUFBRSxRQUFRO2dCQUNmLElBQUksRUFBRSxRQUFRO2dCQUNkLFdBQVcsRUFBRSxVQUFVO2dCQUN2QixRQUFRLEVBQUUsSUFBSTthQUNqQjtTQUNKLENBQUM7SUFDTixDQUFDO0NBQ0o7QUE5REQsd0NBOERDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFzc2V0SW1wb3J0ZXIgfSBmcm9tICcuL2Jhc2UtaW1wb3J0ZXInO1xuaW1wb3J0IHsgSUFzc2V0SW5mbyB9IGZyb20gJ0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9hc3NldC1kYi9AdHlwZXMvcHVibGljJztcbmltcG9ydCB7IElQcm9wZXJ0eSwgSVByb3BlcnR5VmFsdWVUeXBlIH0gZnJvbSAnQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL3NjZW5lL0B0eXBlcy9wdWJsaWMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuXG5leHBvcnQgY2xhc3MgU2NyaXB0SW1wb3J0ZXIgZXh0ZW5kcyBCYXNlQXNzZXRJbXBvcnRlciB7XG4gICAgbmFtZSA9ICd0eXBlc2NyaXB0JztcblxuICAgIGFzeW5jIGdldFByb3BlcnRpZXMoYXNzZXRJbmZvOiBJQXNzZXRJbmZvKTogUHJvbWlzZTx7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9PiB7XG4gICAgICAgIGNvbnN0IGZpbGVQYXRoID0gYXNzZXRJbmZvLmZpbGU7XG4gICAgICAgIGlmICghZmlsZVBhdGggfHwgIWZzLmV4aXN0c1N5bmMoZmlsZVBhdGgpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZpbGUgbm90IGZvdW5kIGZvciBhc3NldCAke2Fzc2V0SW5mby51dWlkfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIExpbWl0IHRvIDQwMCBsaW5lcyBvciAyMDAwMCBjaGFycywgc2ltaWxhciB0byBlbmdpbmUgaW5zcGVjdG9yXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgICAgIGNvbnN0IE1BWF9DSEFSUyA9IDIwMDAwO1xuICAgICAgICAgICAgY29uc3QgTUFYX0xJTkVTID0gNDAwO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgdHJ1bmNhdGVkID0gZmFsc2U7XG4gICAgICAgICAgICBsZXQgZmluYWxDb250ZW50ID0gY29udGVudDtcblxuICAgICAgICAgICAgaWYgKGZpbmFsQ29udGVudC5sZW5ndGggPiBNQVhfQ0hBUlMpIHtcbiAgICAgICAgICAgICAgICBmaW5hbENvbnRlbnQgPSBmaW5hbENvbnRlbnQuc3Vic3RyaW5nKDAsIE1BWF9DSEFSUyk7XG4gICAgICAgICAgICAgICAgdHJ1bmNhdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBmaW5hbENvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA+IE1BWF9MSU5FUykge1xuICAgICAgICAgICAgICAgIGZpbmFsQ29udGVudCA9IGxpbmVzLnNsaWNlKDAsIE1BWF9MSU5FUykuam9pbignXFxuJyk7XG4gICAgICAgICAgICAgICAgdHJ1bmNhdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRydW5jYXRlZCkge1xuICAgICAgICAgICAgICAgIGZpbmFsQ29udGVudCArPSAnXFxuLi4uICh0cnVuY2F0ZWQpJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VVc2VyRGF0YShmaW5hbENvbnRlbnQsIHRoaXMubmFtZSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZXJyb3I6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ1N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiAnRmFpbGVkIHRvIHJlYWQgc2NyaXB0IGZpbGU6ICcgKyBlLFxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5TmFtZTogJ0Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgcmVhZG9ubHk6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHBhcnNlVXNlckRhdGEoY29udGVudDogc3RyaW5nLCBsYW5ndWFnZTogc3RyaW5nKTogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHkgfSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgdHlwZTogJ1N0cmluZycsXG4gICAgICAgICAgICAgICAgZGlzcGxheU5hbWU6ICdDb250ZW50JyxcbiAgICAgICAgICAgICAgICByZWFkb25seTogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxhbmd1YWdlOiB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IGxhbmd1YWdlLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdTdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRpc3BsYXlOYW1lOiAnTGFuZ3VhZ2UnLFxuICAgICAgICAgICAgICAgIHJlYWRvbmx5OiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxufVxuIl19