"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const package_json_1 = __importDefault(require("../package.json"));
const utcp_server_1 = require("./utcp/utcp-server");
const config_manager_1 = require("./utcp/config-manager");
let utcpServer = null;
exports.methods = {
    openPanel() {
        Editor.Panel.open(package_json_1.default.name + '.configuration');
    },
    openPreviewPanel() {
        Editor.Panel.open(package_json_1.default.name + '.preview');
    },
    async restartServer(newPort) {
        if (utcpServer) {
            console.log(`[${package_json_1.default.name}] Restarting UTCP Server on port ${newPort}...`);
            utcpServer.stop();
            try {
                const actualPort = await utcpServer.start(newPort);
                console.log(`[${package_json_1.default.name}] UTCP Server restarted on port ${actualPort}`);
                // Используем менеджер конфигурации для обновления порта
                const configManager = (0, config_manager_1.getConfigManager)();
                await configManager.updatePort(actualPort);
            }
            catch (err) {
                console.error(`[${package_json_1.default.name}] Failed to restart UTCP Server:`, err);
            }
        }
    }
};
async function load() {
    // Initialize config manager
    const configManager = (0, config_manager_1.getConfigManager)();
    await configManager.initialize();
    utcpServer = new utcp_server_1.UtcpServerManager();
    let wasConfiguredPort = true;
    // Load port from profile, default to 0 (random free port) if not set
    let port = await Editor.Profile.getConfig(package_json_1.default.name, 'serverPort');
    if (typeof port !== 'number') {
        port = 0;
        wasConfiguredPort = false;
    }
    try {
        const actualPort = await utcpServer.start(port);
        console.log(`[${package_json_1.default.name}] UTCP Server started on port ${actualPort}`);
        // Automatically update the port in the configuration on startup
        await configManager.updatePort(actualPort);
        console.log(`[${package_json_1.default.name}] UTCP config automatically updated with port ${actualPort}`);
    }
    catch (err) {
        console.error(`[${package_json_1.default.name}] Failed to start UTCP Server:`, err);
    }
    if (!wasConfiguredPort) {
        Editor.Panel.open(package_json_1.default.name);
    }
}
function unload() {
    if (utcpServer) {
        console.log(`[${package_json_1.default.name}] Stopping UTCP Server...`);
        utcpServer.stop();
        utcpServer = null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQW9DQSxvQkE2QkM7QUFFRCx3QkFNQztBQXpFRCxtRUFBMEM7QUFDMUMsb0RBQXVEO0FBQ3ZELDBEQUF5RDtBQUV6RCxJQUFJLFVBQVUsR0FBNkIsSUFBSSxDQUFDO0FBR25DLFFBQUEsT0FBTyxHQUE0QztJQUU1RCxTQUFTO1FBQ0wsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsc0JBQVcsQ0FBQyxJQUFJLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRUQsZ0JBQWdCO1FBQ1osTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsc0JBQVcsQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUdELEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBZTtRQUMvQixJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHNCQUFXLENBQUMsSUFBSSxvQ0FBb0MsT0FBTyxLQUFLLENBQUMsQ0FBQztZQUNsRixVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDO2dCQUNELE1BQU0sVUFBVSxHQUFHLE1BQU0sVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbkQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHNCQUFXLENBQUMsSUFBSSxtQ0FBbUMsVUFBVSxFQUFFLENBQUMsQ0FBQztnQkFFakYsd0RBQXdEO2dCQUN4RCxNQUFNLGFBQWEsR0FBRyxJQUFBLGlDQUFnQixHQUFFLENBQUM7Z0JBQ3pDLE1BQU0sYUFBYSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMvQyxDQUFDO1lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztnQkFDWCxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksc0JBQVcsQ0FBQyxJQUFJLGtDQUFrQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQy9FLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztDQUNKLENBQUM7QUFFSyxLQUFLLFVBQVUsSUFBSTtJQUN0Qiw0QkFBNEI7SUFDNUIsTUFBTSxhQUFhLEdBQUcsSUFBQSxpQ0FBZ0IsR0FBRSxDQUFDO0lBQ3pDLE1BQU0sYUFBYSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBRWpDLFVBQVUsR0FBRyxJQUFJLCtCQUFpQixFQUFFLENBQUM7SUFFckMsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUM7SUFDN0IscUVBQXFFO0lBQ3JFLElBQUksSUFBSSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsc0JBQVcsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDMUUsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUMzQixJQUFJLEdBQUcsQ0FBQyxDQUFDO1FBQ1QsaUJBQWlCLEdBQUcsS0FBSyxDQUFDO0lBQzlCLENBQUM7SUFFRCxJQUFJLENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBRyxNQUFNLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHNCQUFXLENBQUMsSUFBSSxpQ0FBaUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUUvRSxnRUFBZ0U7UUFDaEUsTUFBTSxhQUFhLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzNDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxzQkFBVyxDQUFDLElBQUksaURBQWlELFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDbkcsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDWCxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksc0JBQVcsQ0FBQyxJQUFJLGdDQUFnQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUNyQixNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxzQkFBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7QUFDTCxDQUFDO0FBRUQsU0FBZ0IsTUFBTTtJQUNsQixJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHNCQUFXLENBQUMsSUFBSSwyQkFBMkIsQ0FBQyxDQUFDO1FBQzdELFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsQixVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhY2thZ2VKU09OIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgeyBVdGNwU2VydmVyTWFuYWdlciB9IGZyb20gJy4vdXRjcC91dGNwLXNlcnZlcic7XG5pbXBvcnQgeyBnZXRDb25maWdNYW5hZ2VyIH0gZnJvbSAnLi91dGNwL2NvbmZpZy1tYW5hZ2VyJztcblxubGV0IHV0Y3BTZXJ2ZXI6IFV0Y3BTZXJ2ZXJNYW5hZ2VyIHwgbnVsbCA9IG51bGw7XG5cblxuZXhwb3J0IGNvbnN0IG1ldGhvZHM6IHsgW2tleTogc3RyaW5nXTogKC4uLmFueTogYW55KSA9PiBhbnkgfSA9IHtcblxuICAgIG9wZW5QYW5lbCgpIHtcbiAgICAgICAgRWRpdG9yLlBhbmVsLm9wZW4ocGFja2FnZUpTT04ubmFtZSArICcuY29uZmlndXJhdGlvbicpO1xuICAgIH0sXG5cbiAgICBvcGVuUHJldmlld1BhbmVsKCkge1xuICAgICAgICBFZGl0b3IuUGFuZWwub3BlbihwYWNrYWdlSlNPTi5uYW1lICsgJy5wcmV2aWV3Jyk7XG4gICAgfSxcblxuXG4gICAgYXN5bmMgcmVzdGFydFNlcnZlcihuZXdQb3J0OiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHV0Y3BTZXJ2ZXIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtwYWNrYWdlSlNPTi5uYW1lfV0gUmVzdGFydGluZyBVVENQIFNlcnZlciBvbiBwb3J0ICR7bmV3UG9ydH0uLi5gKTtcbiAgICAgICAgICAgIHV0Y3BTZXJ2ZXIuc3RvcCgpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhY3R1YWxQb3J0ID0gYXdhaXQgdXRjcFNlcnZlci5zdGFydChuZXdQb3J0KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgWyR7cGFja2FnZUpTT04ubmFtZX1dIFVUQ1AgU2VydmVyIHJlc3RhcnRlZCBvbiBwb3J0ICR7YWN0dWFsUG9ydH1gKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvCDQvNC10L3QtdC00LbQtdGAINC60L7QvdGE0LjQs9GD0YDQsNGG0LjQuCDQtNC70Y8g0L7QsdC90L7QstC70LXQvdC40Y8g0L/QvtGA0YLQsFxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ01hbmFnZXIgPSBnZXRDb25maWdNYW5hZ2VyKCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgY29uZmlnTWFuYWdlci51cGRhdGVQb3J0KGFjdHVhbFBvcnQpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgWyR7cGFja2FnZUpTT04ubmFtZX1dIEZhaWxlZCB0byByZXN0YXJ0IFVUQ1AgU2VydmVyOmAsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9hZCgpIHtcbiAgICAvLyBJbml0aWFsaXplIGNvbmZpZyBtYW5hZ2VyXG4gICAgY29uc3QgY29uZmlnTWFuYWdlciA9IGdldENvbmZpZ01hbmFnZXIoKTtcbiAgICBhd2FpdCBjb25maWdNYW5hZ2VyLmluaXRpYWxpemUoKTtcbiAgICBcbiAgICB1dGNwU2VydmVyID0gbmV3IFV0Y3BTZXJ2ZXJNYW5hZ2VyKCk7XG5cbiAgICBsZXQgd2FzQ29uZmlndXJlZFBvcnQgPSB0cnVlO1xuICAgIC8vIExvYWQgcG9ydCBmcm9tIHByb2ZpbGUsIGRlZmF1bHQgdG8gMCAocmFuZG9tIGZyZWUgcG9ydCkgaWYgbm90IHNldFxuICAgIGxldCBwb3J0ID0gYXdhaXQgRWRpdG9yLlByb2ZpbGUuZ2V0Q29uZmlnKHBhY2thZ2VKU09OLm5hbWUsICdzZXJ2ZXJQb3J0Jyk7XG4gICAgaWYgKHR5cGVvZiBwb3J0ICE9PSAnbnVtYmVyJykge1xuICAgICAgICBwb3J0ID0gMDtcbiAgICAgICAgd2FzQ29uZmlndXJlZFBvcnQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBhY3R1YWxQb3J0ID0gYXdhaXQgdXRjcFNlcnZlci5zdGFydChwb3J0KTtcbiAgICAgICAgY29uc29sZS5sb2coYFske3BhY2thZ2VKU09OLm5hbWV9XSBVVENQIFNlcnZlciBzdGFydGVkIG9uIHBvcnQgJHthY3R1YWxQb3J0fWApO1xuICAgICAgICBcbiAgICAgICAgLy8gQXV0b21hdGljYWxseSB1cGRhdGUgdGhlIHBvcnQgaW4gdGhlIGNvbmZpZ3VyYXRpb24gb24gc3RhcnR1cFxuICAgICAgICBhd2FpdCBjb25maWdNYW5hZ2VyLnVwZGF0ZVBvcnQoYWN0dWFsUG9ydCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbJHtwYWNrYWdlSlNPTi5uYW1lfV0gVVRDUCBjb25maWcgYXV0b21hdGljYWxseSB1cGRhdGVkIHdpdGggcG9ydCAke2FjdHVhbFBvcnR9YCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFske3BhY2thZ2VKU09OLm5hbWV9XSBGYWlsZWQgdG8gc3RhcnQgVVRDUCBTZXJ2ZXI6YCwgZXJyKTtcbiAgICB9XG5cbiAgICBpZiAoIXdhc0NvbmZpZ3VyZWRQb3J0KSB7XG4gICAgICAgIEVkaXRvci5QYW5lbC5vcGVuKHBhY2thZ2VKU09OLm5hbWUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVubG9hZCgpIHtcbiAgICBpZiAodXRjcFNlcnZlcikge1xuICAgICAgICBjb25zb2xlLmxvZyhgWyR7cGFja2FnZUpTT04ubmFtZX1dIFN0b3BwaW5nIFVUQ1AgU2VydmVyLi4uYCk7XG4gICAgICAgIHV0Y3BTZXJ2ZXIuc3RvcCgpO1xuICAgICAgICB1dGNwU2VydmVyID0gbnVsbDtcbiAgICB9XG59XG4iXX0=