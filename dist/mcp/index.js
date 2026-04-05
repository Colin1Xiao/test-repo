"use strict";
/**
 * MCP - 统一导出
 *
 * @version v0.1.0
 * @date 2026-04-03
 *
 * Sprint 3A: MCP Core Registry
 * Sprint 3B: MCP Policy & Approval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServerHealthManager = exports.ServerHealthManager = exports.createMcpContextAdapter = exports.McpContextAdapter = exports.resolveMcpRequirements = exports.createAgentMcpRequirementsResolver = exports.AgentMcpRequirementsResolver = exports.createResourceSearcher = exports.ResourceSearcher = exports.createResourceReader = exports.ResourceReader = exports.createResourceRegistry = exports.ResourceRegistry = exports.requestMcpApproval = exports.createMcpApprovalManager = exports.McpApprovalManager = exports.checkMcpAccess = exports.createMcpAccessControl = exports.McpAccessControl = exports.createDefaultMcpPolicy = exports.createConservativePolicy = exports.createRestrictivePolicy = exports.createPermissivePolicy = exports.createMcpPolicy = exports.McpPolicy = exports.createCapabilityIndex = exports.CapabilityIndex = exports.createMcpRegistry = exports.McpRegistry = exports.getSupportedServers = exports.buildQualifiedName = exports.extractNamePart = exports.extractServerName = exports.getCapabilityType = exports.checkNameConflict = exports.validateNamePart = exports.normalizeNamePart = exports.normalizeServerName = exports.validateQualifiedName = exports.parseQualifiedName = exports.buildPromptName = exports.buildResourceName = exports.buildToolName = void 0;
// MCP Naming
var mcp_naming_1 = require("./mcp_naming");
Object.defineProperty(exports, "buildToolName", { enumerable: true, get: function () { return mcp_naming_1.buildToolName; } });
Object.defineProperty(exports, "buildResourceName", { enumerable: true, get: function () { return mcp_naming_1.buildResourceName; } });
Object.defineProperty(exports, "buildPromptName", { enumerable: true, get: function () { return mcp_naming_1.buildPromptName; } });
Object.defineProperty(exports, "parseQualifiedName", { enumerable: true, get: function () { return mcp_naming_1.parseQualifiedName; } });
Object.defineProperty(exports, "validateQualifiedName", { enumerable: true, get: function () { return mcp_naming_1.validateQualifiedName; } });
Object.defineProperty(exports, "normalizeServerName", { enumerable: true, get: function () { return mcp_naming_1.normalizeServerName; } });
Object.defineProperty(exports, "normalizeNamePart", { enumerable: true, get: function () { return mcp_naming_1.normalizeNamePart; } });
Object.defineProperty(exports, "validateNamePart", { enumerable: true, get: function () { return mcp_naming_1.validateNamePart; } });
Object.defineProperty(exports, "checkNameConflict", { enumerable: true, get: function () { return mcp_naming_1.checkNameConflict; } });
Object.defineProperty(exports, "getCapabilityType", { enumerable: true, get: function () { return mcp_naming_1.getCapabilityType; } });
Object.defineProperty(exports, "extractServerName", { enumerable: true, get: function () { return mcp_naming_1.extractServerName; } });
Object.defineProperty(exports, "extractNamePart", { enumerable: true, get: function () { return mcp_naming_1.extractNamePart; } });
Object.defineProperty(exports, "buildQualifiedName", { enumerable: true, get: function () { return mcp_naming_1.buildQualifiedName; } });
Object.defineProperty(exports, "getSupportedServers", { enumerable: true, get: function () { return mcp_naming_1.getSupportedServers; } });
// MCP Registry
var mcp_registry_1 = require("./mcp_registry");
Object.defineProperty(exports, "McpRegistry", { enumerable: true, get: function () { return mcp_registry_1.McpRegistry; } });
Object.defineProperty(exports, "createMcpRegistry", { enumerable: true, get: function () { return mcp_registry_1.createMcpRegistry; } });
// Capability Index
var capability_index_1 = require("./capability_index");
Object.defineProperty(exports, "CapabilityIndex", { enumerable: true, get: function () { return capability_index_1.CapabilityIndex; } });
Object.defineProperty(exports, "createCapabilityIndex", { enumerable: true, get: function () { return capability_index_1.createCapabilityIndex; } });
// MCP Policy (3B)
var mcp_policy_1 = require("./mcp_policy");
Object.defineProperty(exports, "McpPolicy", { enumerable: true, get: function () { return mcp_policy_1.McpPolicy; } });
Object.defineProperty(exports, "createMcpPolicy", { enumerable: true, get: function () { return mcp_policy_1.createMcpPolicy; } });
Object.defineProperty(exports, "createPermissivePolicy", { enumerable: true, get: function () { return mcp_policy_1.createPermissivePolicy; } });
Object.defineProperty(exports, "createRestrictivePolicy", { enumerable: true, get: function () { return mcp_policy_1.createRestrictivePolicy; } });
Object.defineProperty(exports, "createConservativePolicy", { enumerable: true, get: function () { return mcp_policy_1.createConservativePolicy; } });
Object.defineProperty(exports, "createDefaultMcpPolicy", { enumerable: true, get: function () { return mcp_policy_1.createDefaultMcpPolicy; } });
// MCP Access Control (3B)
var mcp_access_control_1 = require("./mcp_access_control");
Object.defineProperty(exports, "McpAccessControl", { enumerable: true, get: function () { return mcp_access_control_1.McpAccessControl; } });
Object.defineProperty(exports, "createMcpAccessControl", { enumerable: true, get: function () { return mcp_access_control_1.createMcpAccessControl; } });
Object.defineProperty(exports, "checkMcpAccess", { enumerable: true, get: function () { return mcp_access_control_1.checkMcpAccess; } });
// MCP Approval (3B)
var mcp_approval_1 = require("./mcp_approval");
Object.defineProperty(exports, "McpApprovalManager", { enumerable: true, get: function () { return mcp_approval_1.McpApprovalManager; } });
Object.defineProperty(exports, "createMcpApprovalManager", { enumerable: true, get: function () { return mcp_approval_1.createMcpApprovalManager; } });
Object.defineProperty(exports, "requestMcpApproval", { enumerable: true, get: function () { return mcp_approval_1.requestMcpApproval; } });
// MCP Resources (3C)
var resource_registry_1 = require("./resource_registry");
Object.defineProperty(exports, "ResourceRegistry", { enumerable: true, get: function () { return resource_registry_1.ResourceRegistry; } });
Object.defineProperty(exports, "createResourceRegistry", { enumerable: true, get: function () { return resource_registry_1.createResourceRegistry; } });
var resource_reader_1 = require("./resource_reader");
Object.defineProperty(exports, "ResourceReader", { enumerable: true, get: function () { return resource_reader_1.ResourceReader; } });
Object.defineProperty(exports, "createResourceReader", { enumerable: true, get: function () { return resource_reader_1.createResourceReader; } });
var resource_search_1 = require("./resource_search");
Object.defineProperty(exports, "ResourceSearcher", { enumerable: true, get: function () { return resource_search_1.ResourceSearcher; } });
Object.defineProperty(exports, "createResourceSearcher", { enumerable: true, get: function () { return resource_search_1.createResourceSearcher; } });
// Agent/MCP Integration (3D)
var agent_mcp_requirements_1 = require("./agent_mcp_requirements");
Object.defineProperty(exports, "AgentMcpRequirementsResolver", { enumerable: true, get: function () { return agent_mcp_requirements_1.AgentMcpRequirementsResolver; } });
Object.defineProperty(exports, "createAgentMcpRequirementsResolver", { enumerable: true, get: function () { return agent_mcp_requirements_1.createAgentMcpRequirementsResolver; } });
Object.defineProperty(exports, "resolveMcpRequirements", { enumerable: true, get: function () { return agent_mcp_requirements_1.resolveMcpRequirements; } });
var mcp_context_adapter_1 = require("./mcp_context_adapter");
Object.defineProperty(exports, "McpContextAdapter", { enumerable: true, get: function () { return mcp_context_adapter_1.McpContextAdapter; } });
Object.defineProperty(exports, "createMcpContextAdapter", { enumerable: true, get: function () { return mcp_context_adapter_1.createMcpContextAdapter; } });
var server_health_1 = require("./server_health");
Object.defineProperty(exports, "ServerHealthManager", { enumerable: true, get: function () { return server_health_1.ServerHealthManager; } });
Object.defineProperty(exports, "createServerHealthManager", { enumerable: true, get: function () { return server_health_1.createServerHealthManager; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWNwL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7O0FBS0gsYUFBYTtBQUNiLDJDQWVzQjtBQWRwQiwyR0FBQSxhQUFhLE9BQUE7QUFDYiwrR0FBQSxpQkFBaUIsT0FBQTtBQUNqQiw2R0FBQSxlQUFlLE9BQUE7QUFDZixnSEFBQSxrQkFBa0IsT0FBQTtBQUNsQixtSEFBQSxxQkFBcUIsT0FBQTtBQUNyQixpSEFBQSxtQkFBbUIsT0FBQTtBQUNuQiwrR0FBQSxpQkFBaUIsT0FBQTtBQUNqQiw4R0FBQSxnQkFBZ0IsT0FBQTtBQUNoQiwrR0FBQSxpQkFBaUIsT0FBQTtBQUNqQiwrR0FBQSxpQkFBaUIsT0FBQTtBQUNqQiwrR0FBQSxpQkFBaUIsT0FBQTtBQUNqQiw2R0FBQSxlQUFlLE9BQUE7QUFDZixnSEFBQSxrQkFBa0IsT0FBQTtBQUNsQixpSEFBQSxtQkFBbUIsT0FBQTtBQUdyQixlQUFlO0FBQ2YsK0NBR3dCO0FBRnRCLDJHQUFBLFdBQVcsT0FBQTtBQUNYLGlIQUFBLGlCQUFpQixPQUFBO0FBSW5CLG1CQUFtQjtBQUNuQix1REFHNEI7QUFGMUIsbUhBQUEsZUFBZSxPQUFBO0FBQ2YseUhBQUEscUJBQXFCLE9BQUE7QUFJdkIsa0JBQWtCO0FBQ2xCLDJDQU9zQjtBQU5wQix1R0FBQSxTQUFTLE9BQUE7QUFDVCw2R0FBQSxlQUFlLE9BQUE7QUFDZixvSEFBQSxzQkFBc0IsT0FBQTtBQUN0QixxSEFBQSx1QkFBdUIsT0FBQTtBQUN2QixzSEFBQSx3QkFBd0IsT0FBQTtBQUN4QixvSEFBQSxzQkFBc0IsT0FBQTtBQUl4QiwwQkFBMEI7QUFDMUIsMkRBSThCO0FBSDVCLHNIQUFBLGdCQUFnQixPQUFBO0FBQ2hCLDRIQUFBLHNCQUFzQixPQUFBO0FBQ3RCLG9IQUFBLGNBQWMsT0FBQTtBQUloQixvQkFBb0I7QUFDcEIsK0NBSXdCO0FBSHRCLGtIQUFBLGtCQUFrQixPQUFBO0FBQ2xCLHdIQUFBLHdCQUF3QixPQUFBO0FBQ3hCLGtIQUFBLGtCQUFrQixPQUFBO0FBSXBCLHFCQUFxQjtBQUNyQix5REFHNkI7QUFGM0IscUhBQUEsZ0JBQWdCLE9BQUE7QUFDaEIsMkhBQUEsc0JBQXNCLE9BQUE7QUFJeEIscURBRzJCO0FBRnpCLGlIQUFBLGNBQWMsT0FBQTtBQUNkLHVIQUFBLG9CQUFvQixPQUFBO0FBSXRCLHFEQUcyQjtBQUZ6QixtSEFBQSxnQkFBZ0IsT0FBQTtBQUNoQix5SEFBQSxzQkFBc0IsT0FBQTtBQUl4Qiw2QkFBNkI7QUFDN0IsbUVBSWtDO0FBSGhDLHNJQUFBLDRCQUE0QixPQUFBO0FBQzVCLDRJQUFBLGtDQUFrQyxPQUFBO0FBQ2xDLGdJQUFBLHNCQUFzQixPQUFBO0FBSXhCLDZEQUcrQjtBQUY3Qix3SEFBQSxpQkFBaUIsT0FBQTtBQUNqQiw4SEFBQSx1QkFBdUIsT0FBQTtBQUl6QixpREFHeUI7QUFGdkIsb0hBQUEsbUJBQW1CLE9BQUE7QUFDbkIsMEhBQUEseUJBQXlCLE9BQUEiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE1DUCAtIOe7n+S4gOWvvOWHulxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqIFxuICogU3ByaW50IDNBOiBNQ1AgQ29yZSBSZWdpc3RyeVxuICogU3ByaW50IDNCOiBNQ1AgUG9saWN5ICYgQXBwcm92YWxcbiAqL1xuXG4vLyBUeXBlc1xuZXhwb3J0IHR5cGUgKiBmcm9tICcuL3R5cGVzJztcblxuLy8gTUNQIE5hbWluZ1xuZXhwb3J0IHtcbiAgYnVpbGRUb29sTmFtZSxcbiAgYnVpbGRSZXNvdXJjZU5hbWUsXG4gIGJ1aWxkUHJvbXB0TmFtZSxcbiAgcGFyc2VRdWFsaWZpZWROYW1lLFxuICB2YWxpZGF0ZVF1YWxpZmllZE5hbWUsXG4gIG5vcm1hbGl6ZVNlcnZlck5hbWUsXG4gIG5vcm1hbGl6ZU5hbWVQYXJ0LFxuICB2YWxpZGF0ZU5hbWVQYXJ0LFxuICBjaGVja05hbWVDb25mbGljdCxcbiAgZ2V0Q2FwYWJpbGl0eVR5cGUsXG4gIGV4dHJhY3RTZXJ2ZXJOYW1lLFxuICBleHRyYWN0TmFtZVBhcnQsXG4gIGJ1aWxkUXVhbGlmaWVkTmFtZSxcbiAgZ2V0U3VwcG9ydGVkU2VydmVycyxcbn0gZnJvbSAnLi9tY3BfbmFtaW5nJztcblxuLy8gTUNQIFJlZ2lzdHJ5XG5leHBvcnQge1xuICBNY3BSZWdpc3RyeSxcbiAgY3JlYXRlTWNwUmVnaXN0cnksXG59IGZyb20gJy4vbWNwX3JlZ2lzdHJ5JztcbmV4cG9ydCB0eXBlIHsgTWNwUmVnaXN0cnlDb25maWcgfSBmcm9tICcuL21jcF9yZWdpc3RyeSc7XG5cbi8vIENhcGFiaWxpdHkgSW5kZXhcbmV4cG9ydCB7XG4gIENhcGFiaWxpdHlJbmRleCxcbiAgY3JlYXRlQ2FwYWJpbGl0eUluZGV4LFxufSBmcm9tICcuL2NhcGFiaWxpdHlfaW5kZXgnO1xuZXhwb3J0IHR5cGUgeyBDYXBhYmlsaXR5SW5kZXhDb25maWcsIENhcGFiaWxpdHlTZWFyY2hRdWVyeSB9IGZyb20gJy4vY2FwYWJpbGl0eV9pbmRleCc7XG5cbi8vIE1DUCBQb2xpY3kgKDNCKVxuZXhwb3J0IHtcbiAgTWNwUG9saWN5LFxuICBjcmVhdGVNY3BQb2xpY3ksXG4gIGNyZWF0ZVBlcm1pc3NpdmVQb2xpY3ksXG4gIGNyZWF0ZVJlc3RyaWN0aXZlUG9saWN5LFxuICBjcmVhdGVDb25zZXJ2YXRpdmVQb2xpY3ksXG4gIGNyZWF0ZURlZmF1bHRNY3BQb2xpY3ksXG59IGZyb20gJy4vbWNwX3BvbGljeSc7XG5leHBvcnQgdHlwZSB7IE1jcFBvbGljeUNvbmZpZyB9IGZyb20gJy4vbWNwX3BvbGljeSc7XG5cbi8vIE1DUCBBY2Nlc3MgQ29udHJvbCAoM0IpXG5leHBvcnQge1xuICBNY3BBY2Nlc3NDb250cm9sLFxuICBjcmVhdGVNY3BBY2Nlc3NDb250cm9sLFxuICBjaGVja01jcEFjY2Vzcyxcbn0gZnJvbSAnLi9tY3BfYWNjZXNzX2NvbnRyb2wnO1xuZXhwb3J0IHR5cGUgeyBBY2Nlc3NDb250cm9sQ29uZmlnIH0gZnJvbSAnLi9tY3BfYWNjZXNzX2NvbnRyb2wnO1xuXG4vLyBNQ1AgQXBwcm92YWwgKDNCKVxuZXhwb3J0IHtcbiAgTWNwQXBwcm92YWxNYW5hZ2VyLFxuICBjcmVhdGVNY3BBcHByb3ZhbE1hbmFnZXIsXG4gIHJlcXVlc3RNY3BBcHByb3ZhbCxcbn0gZnJvbSAnLi9tY3BfYXBwcm92YWwnO1xuZXhwb3J0IHR5cGUgeyBJQXBwcm92YWxIYW5kbGVyLCBNY3BBcHByb3ZhbENvbmZpZyB9IGZyb20gJy4vbWNwX2FwcHJvdmFsJztcblxuLy8gTUNQIFJlc291cmNlcyAoM0MpXG5leHBvcnQge1xuICBSZXNvdXJjZVJlZ2lzdHJ5LFxuICBjcmVhdGVSZXNvdXJjZVJlZ2lzdHJ5LFxufSBmcm9tICcuL3Jlc291cmNlX3JlZ2lzdHJ5JztcbmV4cG9ydCB0eXBlIHsgUmVzb3VyY2VSZWdpc3RyeUNvbmZpZyB9IGZyb20gJy4vcmVzb3VyY2VfcmVnaXN0cnknO1xuXG5leHBvcnQge1xuICBSZXNvdXJjZVJlYWRlcixcbiAgY3JlYXRlUmVzb3VyY2VSZWFkZXIsXG59IGZyb20gJy4vcmVzb3VyY2VfcmVhZGVyJztcbmV4cG9ydCB0eXBlIHsgUmVzb3VyY2VSZWFkZXJDb25maWcsIElSZXNvdXJjZUV4ZWN1dG9yIH0gZnJvbSAnLi9yZXNvdXJjZV9yZWFkZXInO1xuXG5leHBvcnQge1xuICBSZXNvdXJjZVNlYXJjaGVyLFxuICBjcmVhdGVSZXNvdXJjZVNlYXJjaGVyLFxufSBmcm9tICcuL3Jlc291cmNlX3NlYXJjaCc7XG5leHBvcnQgdHlwZSB7IFJlc291cmNlU2VhcmNoZXJDb25maWcsIElSZXNvdXJjZVNlYXJjaEV4ZWN1dG9yIH0gZnJvbSAnLi9yZXNvdXJjZV9zZWFyY2gnO1xuXG4vLyBBZ2VudC9NQ1AgSW50ZWdyYXRpb24gKDNEKVxuZXhwb3J0IHtcbiAgQWdlbnRNY3BSZXF1aXJlbWVudHNSZXNvbHZlcixcbiAgY3JlYXRlQWdlbnRNY3BSZXF1aXJlbWVudHNSZXNvbHZlcixcbiAgcmVzb2x2ZU1jcFJlcXVpcmVtZW50cyxcbn0gZnJvbSAnLi9hZ2VudF9tY3BfcmVxdWlyZW1lbnRzJztcbmV4cG9ydCB0eXBlIHsgUmVxdWlyZW1lbnRzUmVzb2x1dGlvbiB9IGZyb20gJy4vYWdlbnRfbWNwX3JlcXVpcmVtZW50cyc7XG5cbmV4cG9ydCB7XG4gIE1jcENvbnRleHRBZGFwdGVyLFxuICBjcmVhdGVNY3BDb250ZXh0QWRhcHRlcixcbn0gZnJvbSAnLi9tY3BfY29udGV4dF9hZGFwdGVyJztcbmV4cG9ydCB0eXBlIHsgQ29udGV4dEJ1aWxkT3B0aW9ucywgTWlzc2luZ0RlcGVuZGVuY3lSZXBvcnQgfSBmcm9tICcuL21jcF9jb250ZXh0X2FkYXB0ZXInO1xuXG5leHBvcnQge1xuICBTZXJ2ZXJIZWFsdGhNYW5hZ2VyLFxuICBjcmVhdGVTZXJ2ZXJIZWFsdGhNYW5hZ2VyLFxufSBmcm9tICcuL3NlcnZlcl9oZWFsdGgnO1xuZXhwb3J0IHR5cGUgeyBTZXJ2ZXJIZWFsdGhDb25maWcgfSBmcm9tICcuL3NlcnZlcl9oZWFsdGgnO1xuIl19