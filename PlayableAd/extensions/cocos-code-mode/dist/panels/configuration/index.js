"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const package_json_1 = __importDefault(require("../../../package.json"));
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const config_manager_1 = require("../../utcp/config-manager");
module.exports = Editor.Panel.define({
    listeners: {
        show() { console.log('show'); },
        hide() { console.log('hide'); },
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/configuration/index.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/configuration/index.css'), 'utf-8'),
    $: {
        app: '.panel',
        portInput: '#port-input',
        savePortBtn: '#save-port-btn',
        // MCP Integration
        mcpConfigCode: '#mcp-config-code',
        // UTCP Config
        utcpConfigPathInput: '#utcp-config-path',
        utcpConfigPathSaveBtn: '#save-utcp-path-btn',
        bridgeList: '#bridge-container',
        addBridgeBtn: '#add-bridge-btn',
        newTemplateJson: '#new-template-json',
    },
    methods: {
        async loadSettings() {
            const configManager = (0, config_manager_1.getConfigManager)();
            await configManager.initialize();
            // Update UI with config path
            if (this.$.utcpConfigPathInput) {
                this.$.utcpConfigPathInput.value = configManager.getConfigPath();
            }
            // Load Port
            const port = await configManager.getCurrentPort();
            if (this.$.portInput) {
                this.$.portInput.value = port || 0;
            }
            this.updateMcpCodeBlock();
            this.fetchBridgeList();
        },
        async saveSettings() {
            const newPath = this.$.utcpConfigPathInput.value;
            if (newPath) {
                const configManager = (0, config_manager_1.getConfigManager)();
                await configManager.setConfigPath(newPath);
                this.updateMcpCodeBlock();
                this.fetchBridgeList(); // Reload templates from new path
                console.log('Saved UTCP Config Path:', newPath);
            }
        },
        async updatePort() {
            const portVal = this.$.portInput.value;
            const port = parseInt(portVal);
            console.log(`Updating port to: ${port}`);
            // Send message to main process to restart server
            Editor.Message.send(package_json_1.default.name, 'restart-server', port);
        },
        updateMcpCodeBlock() {
            const codeEl = this.$.mcpConfigCode;
            if (!codeEl)
                return;
            const configManager = (0, config_manager_1.getConfigManager)();
            const configPath = configManager.getConfigPath();
            const config = {
                "mcpServers": {
                    "code-mode": {
                        "command": "npx",
                        "args": ["-y", "@utcp/code-mode-mcp"],
                        "env": {
                            "UTCP_CONFIG_FILE": configPath
                        }
                    }
                }
            };
            codeEl.textContent = JSON.stringify(config, null, 2);
        },
        fetchBridgeList() {
            const container = this.$.bridgeList;
            if (!container) {
                console.warn('Bridge Config Container not found');
                return;
            }
            // Clear "Loading..." or previous content
            container.innerHTML = '';
            const configManager = (0, config_manager_1.getConfigManager)();
            const config = configManager.readConfig();
            const templates = config.manual_call_templates || [];
            if (templates.length === 0) {
                container.innerHTML = '<div style="padding:10px; color: #888;">No templates found.</div>';
            }
            else {
                let html = '';
                templates.forEach((t) => {
                    const isCocos = t.name === 'CocosEditor';
                    const delBtn = isCocos
                        ? `` // No delete for Cocos
                        : `<ui-button slot="header" type="danger" class="remove-btn" tooltip="Remove Template">
                             <ui-icon value="del"></ui-icon>
                           </ui-button>`;
                    const headerText = `${t.name} (${t.call_template_type})`;
                    html += `
                    <ui-section class="bridge-item-section" data-name="${t.name}">
                        <div slot="header" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding-right: 10px;">
                            <ui-label>${headerText}</ui-label>
                            ${delBtn}
                        </div>
                        <div class="bridge-item-content">
                             <ui-code language="json" readonly id="code-${t.name}"></ui-code>
                        </div>
                    </ui-section>
                    `;
                });
                container.innerHTML = html;
                // Now populate the code values correctly
                templates.forEach((t) => {
                    const el = container.querySelector(`#code-${t.name}`);
                    if (el)
                        el.textContent = JSON.stringify(t, null, 2);
                });
            }
        },
        addBridgeTemplate() {
            const input = this.$.newTemplateJson;
            if (!input)
                return;
            const content = input.value.trim();
            if (!content)
                return;
            try {
                let newTpl = JSON.parse(content);
                // Validate with @utcp/sdk or simple schema
                if (!newTpl.name || !newTpl.call_template_type) {
                    alert('Invalid template. Must have name and call_template_type.');
                    return;
                }
                const configManager = (0, config_manager_1.getConfigManager)();
                const config = configManager.readConfig();
                // Check duplicates
                if (config.manual_call_templates.find((t) => t.name === newTpl.name)) {
                    alert(`Template ${newTpl.name} already exists.`);
                    return;
                }
                config.manual_call_templates.push(newTpl);
                configManager.writeConfig(config);
                input.value = '';
                this.fetchBridgeList();
            }
            catch (e) {
                alert('Invalid JSON: ' + e.message);
            }
        },
        removeBridge(name) {
            if (name === 'CocosEditor')
                return;
            if (!confirm(`Remove template ${name}?`))
                return;
            const configManager = (0, config_manager_1.getConfigManager)();
            const config = configManager.readConfig();
            if (config.manual_call_templates) {
                config.manual_call_templates = config.manual_call_templates.filter((t) => t.name !== name);
                configManager.writeConfig(config);
                this.fetchBridgeList();
            }
        },
    },
    ready() {
        this.loadSettings();
        // Listeners
        const savePort = this.$.savePortBtn;
        if (savePort)
            savePort.addEventListener('click', () => this.updatePort());
        const savePath = this.$.utcpConfigPathSaveBtn;
        if (savePath)
            savePath.addEventListener('click', () => this.saveSettings());
        const addBtn = this.$.addBridgeBtn;
        if (addBtn)
            addBtn.addEventListener('click', () => this.addBridgeTemplate());
        const list = this.$.bridgeList;
        if (list) {
            list.addEventListener('click', (e) => {
                // Handle delete clicks
                const btn = e.target.closest('.remove-btn');
                if (btn) {
                    // In new structure, btn is inside .bridge-item-content inside ui-section
                    const section = btn.closest('.bridge-item-section');
                    if (section && section.dataset.name) {
                        this.removeBridge(section.dataset.name);
                    }
                }
            });
        }
    },
    beforeClose() { },
    close() { },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL2NvbmZpZ3VyYXRpb24vaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx5RUFBZ0Q7QUFDaEQsdUNBQXdDO0FBQ3hDLCtCQUE0QjtBQUM1Qiw4REFBNkQ7QUFFN0QsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNqQyxTQUFTLEVBQUU7UUFDUCxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0IsSUFBSSxLQUFLLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2xDO0lBQ0QsUUFBUSxFQUFFLElBQUEsdUJBQVksRUFBQyxJQUFBLFdBQUksRUFBQyxTQUFTLEVBQUUsbURBQW1ELENBQUMsRUFBRSxPQUFPLENBQUM7SUFDckcsS0FBSyxFQUFFLElBQUEsdUJBQVksRUFBQyxJQUFBLFdBQUksRUFBQyxTQUFTLEVBQUUsK0NBQStDLENBQUMsRUFBRSxPQUFPLENBQUM7SUFDOUYsQ0FBQyxFQUFFO1FBQ0MsR0FBRyxFQUFFLFFBQVE7UUFDYixTQUFTLEVBQUUsYUFBYTtRQUN4QixXQUFXLEVBQUUsZ0JBQWdCO1FBRTdCLGtCQUFrQjtRQUNsQixhQUFhLEVBQUUsa0JBQWtCO1FBRWpDLGNBQWM7UUFDZCxtQkFBbUIsRUFBRSxtQkFBbUI7UUFDeEMscUJBQXFCLEVBQUUscUJBQXFCO1FBQzVDLFVBQVUsRUFBRSxtQkFBbUI7UUFDL0IsWUFBWSxFQUFFLGlCQUFpQjtRQUMvQixlQUFlLEVBQUUsb0JBQW9CO0tBQ3hDO0lBRUQsT0FBTyxFQUFFO1FBQ0wsS0FBSyxDQUFDLFlBQVk7WUFDZCxNQUFNLGFBQWEsR0FBRyxJQUFBLGlDQUFnQixHQUFFLENBQUM7WUFDekMsTUFBTSxhQUFhLENBQUMs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TUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBMkIsQ0FBQztRQUNsRCxJQUFJLE1BQU07WUFBRSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFFN0UsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUF5QixDQUFDO1FBQzlDLElBQUksSUFBSSxFQUFFLENBQUM7WUFDUCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBTSxFQUFFLEVBQUU7Z0JBQ3RDLHVCQUF1QjtnQkFDdkIsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQzVDLElBQUksR0FBRyxFQUFFLENBQUM7b0JBQ04seUVBQXlFO29CQUN6RSxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7b0JBQ3BELElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7d0JBQ2xDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDNUMsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO0lBQ0wsQ0FBQztJQUNELFdBQVcsS0FBSyxDQUFDO0lBQ2pCLEtBQUssS0FBSyxDQUFDO0NBQ2QsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhY2thZ2VKU09OIGZyb20gJy4uLy4uLy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdmcy1leHRyYSc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBnZXRDb25maWdNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vdXRjcC9jb25maWctbWFuYWdlcic7XG5cbm1vZHVsZS5leHBvcnRzID0gRWRpdG9yLlBhbmVsLmRlZmluZSh7XG4gICAgbGlzdGVuZXJzOiB7XG4gICAgICAgIHNob3coKSB7IGNvbnNvbGUubG9nKCdzaG93Jyk7IH0sXG4gICAgICAgIGhpZGUoKSB7IGNvbnNvbGUubG9nKCdoaWRlJyk7IH0sXG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlL2NvbmZpZ3VyYXRpb24vaW5kZXguaHRtbCcpLCAndXRmLTgnKSxcbiAgICBzdHlsZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3N0eWxlL2NvbmZpZ3VyYXRpb24vaW5kZXguY3NzJyksICd1dGYtOCcpLFxuICAgICQ6IHtcbiAgICAgICAgYXBwOiAnLnBhbmVsJyxcbiAgICAgICAgcG9ydElucHV0OiAnI3BvcnQtaW5wdXQnLFxuICAgICAgICBzYXZlUG9ydEJ0bjogJyNzYXZlLXBvcnQtYnRuJyxcblxuICAgICAgICAvLyBNQ1AgSW50ZWdyYXRpb25cbiAgICAgICAgbWNwQ29uZmlnQ29kZTogJyNtY3AtY29uZmlnLWNvZGUnLFxuICAgICAgICBcbiAgICAgICAgLy8gVVRDUCBDb25maWdcbiAgICAgICAgdXRjcENvbmZpZ1BhdGhJbnB1dDogJyN1dGNwLWNvbmZpZy1wYXRoJyxcbiAgICAgICAgdXRjcENvbmZpZ1BhdGhTYXZlQnRuOiAnI3NhdmUtdXRjcC1wYXRoLWJ0bicsXG4gICAgICAgIGJyaWRnZUxpc3Q6ICcjYnJpZGdlLWNvbnRhaW5lcicsXG4gICAgICAgIGFkZEJyaWRnZUJ0bjogJyNhZGQtYnJpZGdlLWJ0bicsXG4gICAgICAgIG5ld1RlbXBsYXRlSnNvbjogJyNuZXctdGVtcGxhdGUtanNvbicsXG4gICAgfSxcblxuICAgIG1ldGhvZHM6IHtcbiAgICAgICAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnTWFuYWdlciA9IGdldENvbmZpZ01hbmFnZXIoKTtcbiAgICAgICAgICAgIGF3YWl0IGNvbmZpZ01hbmFnZXIuaW5pdGlhbGl6ZSgpO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgVUkgd2l0aCBjb25maWcgcGF0aFxuICAgICAgICAgICAgaWYgKHRoaXMuJC51dGNwQ29uZmlnUGF0aElucHV0KSB7XG4gICAgICAgICAgICAgICAgKHRoaXMuJC51dGNwQ29uZmlnUGF0aElucHV0IGFzIGFueSkudmFsdWUgPSBjb25maWdNYW5hZ2VyLmdldENvbmZpZ1BhdGgoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTG9hZCBQb3J0XG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gYXdhaXQgY29uZmlnTWFuYWdlci5nZXRDdXJyZW50UG9ydCgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuJC5wb3J0SW5wdXQpIHtcbiAgICAgICAgICAgICAgICAodGhpcy4kLnBvcnRJbnB1dCBhcyBhbnkpLnZhbHVlID0gcG9ydCB8fCAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1jcENvZGVCbG9jaygpO1xuICAgICAgICAgICAgdGhpcy5mZXRjaEJyaWRnZUxpc3QoKTtcbiAgICAgICAgfSxcblxuICAgICAgICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gKHRoaXMuJC51dGNwQ29uZmlnUGF0aElucHV0IGFzIGFueSkudmFsdWU7XG4gICAgICAgICAgICBpZiAobmV3UGF0aCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ01hbmFnZXIgPSBnZXRDb25maWdNYW5hZ2VyKCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgY29uZmlnTWFuYWdlci5zZXRDb25maWdQYXRoKG5ld1BhdGgpO1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTWNwQ29kZUJsb2NrKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5mZXRjaEJyaWRnZUxpc3QoKTsgLy8gUmVsb2FkIHRlbXBsYXRlcyBmcm9tIG5ldyBwYXRoXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1NhdmVkIFVUQ1AgQ29uZmlnIFBhdGg6JywgbmV3UGF0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgdXBkYXRlUG9ydCgpIHtcbiAgICAgICAgICAgIGNvbnN0IHBvcnRWYWwgPSAodGhpcy4kLnBvcnRJbnB1dCBhcyBhbnkpLnZhbHVlO1xuICAgICAgICAgICAgY29uc3QgcG9ydCA9IHBhcnNlSW50KHBvcnRWYWwpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFVwZGF0aW5nIHBvcnQgdG86ICR7cG9ydH1gKTtcbiAgICAgICAgICAgIC8vIFNlbmQgbWVzc2FnZSB0byBtYWluIHByb2Nlc3MgdG8gcmVzdGFydCBzZXJ2ZXJcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnNlbmQocGFja2FnZUpTT04ubmFtZSwgJ3Jlc3RhcnQtc2VydmVyJywgcG9ydCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdXBkYXRlTWNwQ29kZUJsb2NrKCkge1xuICAgICAgICAgICAgY29uc3QgY29kZUVsID0gdGhpcy4kLm1jcENvbmZpZ0NvZGUgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgICAgICBpZiAoIWNvZGVFbCkgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCBjb25maWdNYW5hZ2VyID0gZ2V0Q29uZmlnTWFuYWdlcigpO1xuICAgICAgICAgICAgY29uc3QgY29uZmlnUGF0aCA9IGNvbmZpZ01hbmFnZXIuZ2V0Q29uZmlnUGF0aCgpO1xuXG4gICAgICAgICAgICBjb25zdCBjb25maWcgPSB7XG4gICAgICAgICAgICAgICAgXCJtY3BTZXJ2ZXJzXCI6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJjb2RlLW1vZGVcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJjb21tYW5kXCI6IFwibnB4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImFyZ3NcIjogW1wiLXlcIiwgXCJAdXRjcC9jb2RlLW1vZGUtbWNwXCJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJlbnZcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVVRDUF9DT05GSUdfRklMRVwiOiBjb25maWdQYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb2RlRWwudGV4dENvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShjb25maWcsIG51bGwsIDIpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGZldGNoQnJpZGdlTGlzdCgpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuJC5icmlkZ2VMaXN0IGFzIEhUTUxFbGVtZW50O1xuICAgICAgICAgICAgaWYgKCFjb250YWluZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0JyaWRnZSBDb25maWcgQ29udGFpbmVyIG5vdCBmb3VuZCcpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2xlYXIgXCJMb2FkaW5nLi4uXCIgb3IgcHJldmlvdXMgY29udGVudFxuICAgICAgICAgICAgY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuXG4gICAgICAgICAgICBjb25zdCBjb25maWdNYW5hZ2VyID0gZ2V0Q29uZmlnTWFuYWdlcigpO1xuICAgICAgICAgICAgY29uc3QgY29uZmlnID0gY29uZmlnTWFuYWdlci5yZWFkQ29uZmlnKCk7XG4gICAgICAgICAgICBjb25zdCB0ZW1wbGF0ZXMgPSBjb25maWcubWFudWFsX2NhbGxfdGVtcGxhdGVzIHx8IFtdO1xuXG4gICAgICAgICAgICBpZiAodGVtcGxhdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSAnPGRpdiBzdHlsZT1cInBhZGRpbmc6MTBweDsgY29sb3I6ICM4ODg7XCI+Tm8gdGVtcGxhdGVzIGZvdW5kLjwvZGl2Pic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldCBodG1sID0gJyc7XG4gICAgICAgICAgICAgICAgdGVtcGxhdGVzLmZvckVhY2goKHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0NvY29zID0gdC5uYW1lID09PSAnQ29jb3NFZGl0b3InO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWxCdG4gPSBpc0NvY29zXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGBgIC8vIE5vIGRlbGV0ZSBmb3IgQ29jb3NcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYDx1aS1idXR0b24gc2xvdD1cImhlYWRlclwiIHR5cGU9XCJkYW5nZXJcIiBjbGFzcz1cInJlbW92ZS1idG5cIiB0b29sdGlwPVwiUmVtb3ZlIFRlbXBsYXRlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx1aS1pY29uIHZhbHVlPVwiZGVsXCI+PC91aS1pY29uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgPC91aS1idXR0b24+YDtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJUZXh0ID0gYCR7dC5uYW1lfSAoJHt0LmNhbGxfdGVtcGxhdGVfdHlwZX0pYDtcblxuICAgICAgICAgICAgICAgICAgICBodG1sICs9IGBcbiAgICAgICAgICAgICAgICAgICAgPHVpLXNlY3Rpb24gY2xhc3M9XCJicmlkZ2UtaXRlbS1zZWN0aW9uXCIgZGF0YS1uYW1lPVwiJHt0Lm5hbWV9XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHNsb3Q9XCJoZWFkZXJcIiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgYWxpZ24taXRlbXM6IGNlbnRlcjsgd2lkdGg6IDEwMCU7IHBhZGRpbmctcmlnaHQ6IDEwcHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHVpLWxhYmVsPiR7aGVhZGVyVGV4dH08L3VpLWxhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7ZGVsQnRufVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnJpZGdlLWl0ZW0tY29udGVudFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dWktY29kZSBsYW5ndWFnZT1cImpzb25cIiByZWFkb25seSBpZD1cImNvZGUtJHt0Lm5hbWV9XCI+PC91aS1jb2RlPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvdWktc2VjdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgYDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gaHRtbDtcblxuICAgICAgICAgICAgICAgIC8vIE5vdyBwb3B1bGF0ZSB0aGUgY29kZSB2YWx1ZXMgY29ycmVjdGx5XG4gICAgICAgICAgICAgICAgdGVtcGxhdGVzLmZvckVhY2goKHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKGAjY29kZS0ke3QubmFtZX1gKSBhcyBhbnk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlbCkgZWwudGV4dENvbnRlbnQgPSBKU09OLnN0cmluZ2lmeSh0LCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBhZGRCcmlkZ2VUZW1wbGF0ZSgpIHtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gdGhpcy4kLm5ld1RlbXBsYXRlSnNvbiBhcyBhbnk7XG4gICAgICAgICAgICBpZiAoIWlucHV0KSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gaW5wdXQudmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgaWYgKCFjb250ZW50KSByZXR1cm47XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbGV0IG5ld1RwbCA9IEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgd2l0aCBAdXRjcC9zZGsgb3Igc2ltcGxlIHNjaGVtYVxuICAgICAgICAgICAgICAgIGlmICghbmV3VHBsLm5hbWUgfHwgIW5ld1RwbC5jYWxsX3RlbXBsYXRlX3R5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgYWxlcnQoJ0ludmFsaWQgdGVtcGxhdGUuIE11c3QgaGF2ZSBuYW1lIGFuZCBjYWxsX3RlbXBsYXRlX3R5cGUuJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb25maWdNYW5hZ2VyID0gZ2V0Q29uZmlnTWFuYWdlcigpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGNvbmZpZ01hbmFnZXIucmVhZENvbmZpZygpO1xuXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZHVwbGljYXRlc1xuICAgICAgICAgICAgICAgIGlmIChjb25maWcubWFudWFsX2NhbGxfdGVtcGxhdGVzLmZpbmQoKHQ6IGFueSkgPT4gdC5uYW1lID09PSBuZXdUcGwubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgYWxlcnQoYFRlbXBsYXRlICR7bmV3VHBsLm5hbWV9IGFscmVhZHkgZXhpc3RzLmApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uZmlnLm1hbnVhbF9jYWxsX3RlbXBsYXRlcy5wdXNoKG5ld1RwbCk7XG4gICAgICAgICAgICAgICAgY29uZmlnTWFuYWdlci53cml0ZUNvbmZpZyhjb25maWcpO1xuICAgICAgICAgICAgICAgIGlucHV0LnZhbHVlID0gJyc7XG4gICAgICAgICAgICAgICAgdGhpcy5mZXRjaEJyaWRnZUxpc3QoKTtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgYWxlcnQoJ0ludmFsaWQgSlNPTjogJyArIGUubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgcmVtb3ZlQnJpZGdlKG5hbWU6IHN0cmluZykge1xuICAgICAgICAgICAgaWYgKG5hbWUgPT09ICdDb2Nvc0VkaXRvcicpIHJldHVybjtcbiAgICAgICAgICAgIGlmICghY29uZmlybShgUmVtb3ZlIHRlbXBsYXRlICR7bmFtZX0/YCkpIHJldHVybjtcblxuICAgICAgICAgICAgY29uc3QgY29uZmlnTWFuYWdlciA9IGdldENvbmZpZ01hbmFnZXIoKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGNvbmZpZ01hbmFnZXIucmVhZENvbmZpZygpO1xuICAgICAgICAgICAgaWYgKGNvbmZpZy5tYW51YWxfY2FsbF90ZW1wbGF0ZXMpIHtcbiAgICAgICAgICAgICAgICBjb25maWcubWFudWFsX2NhbGxfdGVtcGxhdGVzID0gY29uZmlnLm1hbnVhbF9jYWxsX3RlbXBsYXRlcy5maWx0ZXIoKHQ6IGFueSkgPT4gdC5uYW1lICE9PSBuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25maWdNYW5hZ2VyLndyaXRlQ29uZmlnKGNvbmZpZyk7XG4gICAgICAgICAgICAgICAgdGhpcy5mZXRjaEJyaWRnZUxpc3QoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICB9LFxuICAgIHJlYWR5KCkge1xuICAgICAgICB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgICAgIC8vIExpc3RlbmVyc1xuICAgICAgICBjb25zdCBzYXZlUG9ydCA9IHRoaXMuJC5zYXZlUG9ydEJ0biBhcyBIVE1MRWxlbWVudDtcbiAgICAgICAgaWYgKHNhdmVQb3J0KSBzYXZlUG9ydC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMudXBkYXRlUG9ydCgpKTtcblxuICAgICAgICBjb25zdCBzYXZlUGF0aCA9IHRoaXMuJC51dGNwQ29uZmlnUGF0aFNhdmVCdG4gYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgIGlmIChzYXZlUGF0aCkgc2F2ZVBhdGguYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnNhdmVTZXR0aW5ncygpKTtcblxuICAgICAgICBjb25zdCBhZGRCdG4gPSB0aGlzLiQuYWRkQnJpZGdlQnRuIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICBpZiAoYWRkQnRuKSBhZGRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmFkZEJyaWRnZVRlbXBsYXRlKCkpO1xuXG4gICAgICAgIGNvbnN0IGxpc3QgPSB0aGlzLiQuYnJpZGdlTGlzdCBhcyBIVE1MRWxlbWVudDtcbiAgICAgICAgaWYgKGxpc3QpIHtcbiAgICAgICAgICAgIGxpc3QuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIGRlbGV0ZSBjbGlja3NcbiAgICAgICAgICAgICAgICBjb25zdCBidG4gPSBlLnRhcmdldC5jbG9zZXN0KCcucmVtb3ZlLWJ0bicpO1xuICAgICAgICAgICAgICAgIGlmIChidG4pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSW4gbmV3IHN0cnVjdHVyZSwgYnRuIGlzIGluc2lkZSAuYnJpZGdlLWl0ZW0tY29udGVudCBpbnNpZGUgdWktc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWN0aW9uID0gYnRuLmNsb3Nlc3QoJy5icmlkZ2UtaXRlbS1zZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWN0aW9uICYmIHNlY3Rpb24uZGF0YXNldC5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUJyaWRnZShzZWN0aW9uLmRhdGFzZXQubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgYmVmb3JlQ2xvc2UoKSB7IH0sXG4gICAgY2xvc2UoKSB7IH0sXG59KTsiXX0=