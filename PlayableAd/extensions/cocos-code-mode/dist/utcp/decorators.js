"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
exports.utcpTool = utcpTool;
class ToolRegistry {
    static register(options) {
        this.tools.set(options.tool.name, options);
    }
    static getTools() {
        return Array.from(this.tools.values());
    }
}
exports.ToolRegistry = ToolRegistry;
ToolRegistry.tools = new Map();
function utcpTool(name, description, inputs, outputs, httpMethod, tags = []) {
    return function (target, propertyKey, descriptor) {
        if (!descriptor)
            return;
        ToolRegistry.register({
            method: descriptor.value,
            target,
            tool: {
                name,
                description,
                inputs,
                outputs,
                tags,
                tool_call_template: {
                    call_template_type: "http",
                    http_method: httpMethod,
                    request_body_format: "json",
                    url: `/tools/${name}`,
                    content_type: "application/json"
                },
            }
        });
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS91dGNwL2RlY29yYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBcUJBLDRCQXVCQztBQW5DRCxNQUFhLFlBQVk7SUFHckIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFxQjtRQUNqQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsTUFBTSxDQUFDLFFBQVE7UUFDWCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7O0FBVEwsb0NBVUM7QUFUa0Isa0JBQUssR0FBOEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQVdoRSxTQUFnQixRQUFRLENBQUMsSUFBWSxFQUFFLFdBQW1CLEVBQUUsTUFBa0IsRUFBRSxPQUFtQixFQUFFLFVBQXVELEVBQUUsT0FBaUIsRUFBRTtJQUM3SyxPQUFPLFVBQVUsTUFBVyxFQUFFLFdBQW1CLEVBQUUsVUFBK0I7UUFDOUUsSUFBSSxDQUFDLFVBQVU7WUFBRSxPQUFPO1FBRXhCLFlBQVksQ0FBQyxRQUFRLENBQUM7WUFDbEIsTUFBTSxFQUFFLFVBQVUsQ0FBQyxLQUFLO1lBQ3hCLE1BQU07WUFDTixJQUFJLEVBQUU7Z0JBQ0YsSUFBSTtnQkFDSixXQUFXO2dCQUNYLE1BQU07Z0JBQ04sT0FBTztnQkFDUCxJQUFJO2dCQUNKLGtCQUFrQixFQUFFO29CQUNoQixrQkFBa0IsRUFBRSxNQUFNO29CQUMxQixXQUFXLEVBQUUsVUFBVTtvQkFDdkIsbUJBQW1CLEVBQUUsTUFBTTtvQkFDM0IsR0FBRyxFQUFFLFVBQVUsSUFBSSxFQUFFO29CQUNyQixZQUFZLEVBQUUsa0JBQWtCO2lCQUNmO2FBQ3hCO1NBQ0osQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxDQUFDO0FBQ04sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEh0dHBDYWxsVGVtcGxhdGUgfSBmcm9tICdAdXRjcC9odHRwJztcbmltcG9ydCB7IEpzb25TY2hlbWEsIFRvb2wgfSBmcm9tICdAdXRjcC9zZGsnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRvb2xNZXRhZGF0YSB7XG4gICAgbWV0aG9kOiBGdW5jdGlvbjtcbiAgICB0YXJnZXQ6IGFueTtcbiAgICB0b29sOiBUb29sO1xufVxuXG5leHBvcnQgY2xhc3MgVG9vbFJlZ2lzdHJ5IHtcbiAgICBwcml2YXRlIHN0YXRpYyB0b29sczogTWFwPHN0cmluZywgVG9vbE1ldGFkYXRhPiA9IG5ldyBNYXAoKTtcblxuICAgIHN0YXRpYyByZWdpc3RlcihvcHRpb25zOiBUb29sTWV0YWRhdGEpIHtcbiAgICAgICAgdGhpcy50b29scy5zZXQob3B0aW9ucy50b29sLm5hbWUsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXRUb29scygpIHtcbiAgICAgICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy50b29scy52YWx1ZXMoKSk7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXRjcFRvb2wobmFtZTogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nLCBpbnB1dHM6IEpzb25TY2hlbWEsIG91dHB1dHM6IEpzb25TY2hlbWEsIGh0dHBNZXRob2Q6ICdHRVQnIHwgJ1BPU1QnIHwgJ1BVVCcgfCAnREVMRVRFJyB8ICdQQVRDSCcsIHRhZ3M6IHN0cmluZ1tdID0gW10pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldDogYW55LCBwcm9wZXJ0eUtleTogc3RyaW5nLCBkZXNjcmlwdG9yPzogUHJvcGVydHlEZXNjcmlwdG9yKSB7XG4gICAgICAgIGlmICghZGVzY3JpcHRvcikgcmV0dXJuO1xuXG4gICAgICAgIFRvb2xSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgICAgICAgICBtZXRob2Q6IGRlc2NyaXB0b3IudmFsdWUsXG4gICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICB0b29sOiB7XG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICBpbnB1dHMsXG4gICAgICAgICAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgICAgICAgICB0YWdzLFxuICAgICAgICAgICAgICAgIHRvb2xfY2FsbF90ZW1wbGF0ZToge1xuICAgICAgICAgICAgICAgICAgICBjYWxsX3RlbXBsYXRlX3R5cGU6IFwiaHR0cFwiLFxuICAgICAgICAgICAgICAgICAgICBodHRwX21ldGhvZDogaHR0cE1ldGhvZCxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdF9ib2R5X2Zvcm1hdDogXCJqc29uXCIsXG4gICAgICAgICAgICAgICAgICAgIHVybDogYC90b29scy8ke25hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudF90eXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICAgICAgICAgIH0gYXMgSHR0cENhbGxUZW1wbGF0ZSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcbn1cbiJdfQ==