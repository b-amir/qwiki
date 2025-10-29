# Troubleshooting & FAQ

This document provides solutions to common issues and answers to frequently asked questions about Qwiki.

## Table of Contents

1. [Installation & Setup Issues](#installation--setup-issues)
2. [Configuration Problems](#configuration-problems)
3. [LLM Provider Issues](#llm-provider-issues)
4. [Performance Issues](#performance-issues)
5. [Webview Problems](#webview-problems)
6. [Development Issues](#development-issues)
7. [Frequently Asked Questions](#frequently-asked-questions)

## Installation & Setup Issues

### Extension won't load

**Symptoms**: Extension appears in the extensions list but doesn't activate, or shows an error in the Extensions panel.

**Solutions**:

1. **Check VS Code Version**: Ensure you're using VS Code 1.105.0 or higher
2. **Restart VS Code**: Sometimes a simple restart resolves loading issues
3. **Check Developer Console**: Open Help → Toggle Developer Tools and check for errors
4. **Verify Installation**: Make sure all dependencies are installed:
   ```bash
   pnpm run install:all
   ```
5. **Rebuild Extension**: Try rebuilding the extension:
   ```bash
   pnpm run compile
   ```

### Dependencies not installing

**Symptoms**: Error messages during `pnpm install` or missing node_modules.

**Solutions**:

1. **Clear Cache**: Clear pnpm cache:
   ```bash
   pnpm store prune
   ```
2. **Delete node_modules**: Remove and reinstall:
   ```bash
   rm -rf node_modules
   rm -rf webview-ui/node_modules
   pnpm run install:all
   ```
3. **Check pnpm Version**: Ensure you're using a recent version of pnpm
4. **Network Issues**: Check if you're behind a corporate firewall that might block package downloads

### Build errors

**Symptoms**: TypeScript compilation errors or webpack build failures.

**Solutions**:

1. **Build Webview First**: Always build the webview UI before the extension:
   ```bash
   pnpm run build:webview
   pnpm run compile
   ```
2. **Check TypeScript Version**: Ensure compatible TypeScript versions
3. **Clean Build**: Clean and rebuild:
   ```bash
   rm -rf dist out
   pnpm run compile
   ```

## Configuration Problems

### API keys not saving

**Symptoms**: API keys disappear after restarting VS Code or show as not configured.

**Solutions**:

1. **Check VS Code Version**: Secret storage requires VS Code 1.105.0+
2. **Verify Permissions**: Ensure VS Code has permission to access secure storage
3. **Manual Test**: Test secret storage directly in VS Code:
   ```javascript
   // In developer console
   const secret = await secrets.get("qwiki");
   ```
4. **Clear and Re-add**: Delete existing keys and add them again

### Settings not persisting

**Symptoms**: Configuration changes are lost after restart.

**Solutions**:

1. **Check Settings File**: Verify settings in VS Code settings.json
2. **Workspace vs User Settings**: Ensure you're saving to the correct scope
3. **Sync Settings**: If using Settings Sync, check if it's overriding your configuration
4. **Reset Settings**: Reset to defaults and reconfigure

### Provider configuration issues

**Symptoms**: Provider shows as not configured despite having an API key.

**Solutions**:

1. **Check Required Fields**: Ensure all required fields are filled
2. **Validate API Key**: Verify the API key is correct and active
3. **Check Custom Fields**: Some providers require additional configuration
4. **Test Connection**: Use the provider's test endpoint to verify connectivity
5. **Use Validation**: Click "Validate Configuration" to check settings

### Configuration validation errors (VALIDATION_ERROR, CONFIGURATION_ERROR)

**Symptoms**: Configuration validation fails with error messages.

**Solutions**:

1. **Check Error Messages**: Review specific validation errors provided
2. **Fix Invalid Fields**: Correct any fields marked as invalid
3. **Check Provider Requirements**: Ensure all provider-specific requirements are met
4. **Use Templates**: Apply a configuration template for your use case
5. **Reset Configuration**: Reset to defaults and reconfigure if needed

### Configuration migration failed (CONFIGURATION_MIGRATION_FAILED)

**Symptoms**: Settings fail to migrate after extension update.

**Solutions**:

1. **Check Backup**: Verify configuration backup was created
2. **Manual Migration**: Manually transfer settings from old version
3. **Reset to Defaults**: Start with default configuration
4. **Contact Support**: Report migration issues for assistance

### Configuration backup failed (CONFIGURATION_BACKUP_FAILED)

**Symptoms**: Unable to create configuration backup.

**Solutions**:

1. **Check Storage**: Verify VS Code has sufficient storage space
2. **Check Permissions**: Ensure extension has write permissions
3. **Reduce Configuration Size**: Remove unnecessary settings before backup
4. **Manual Export**: Export configuration manually before making changes

## LLM Provider Issues

### "Provider not found" error

**Symptoms**: Error message indicating a provider is not available.

**Solutions**:

1. **Check Registry**: Verify the provider is registered in `src/llm/providers/registry.ts`
2. **Restart Extension**: Reload the VS Code window
3. **Check Provider ID**: Ensure you're using the correct provider ID
4. **Update Extension**: Ensure you have the latest version

### API key authentication failures

**Symptoms**: 401 Unauthorized or invalid API key errors.

**Solutions**:

1. **Verify API Key**: Double-check the API key for typos
2. **Check Key Status**: Ensure the key is active and not expired
3. **Provider Console**: Check the provider's dashboard for key status
4. **Regenerate Key**: Sometimes regenerating the key helps

### Rate limiting errors

**Symptoms**: 429 Too Many Requests or rate limit exceeded messages.

**Solutions**:

1. **Wait and Retry**: Most rate limits reset after a period
2. **Check Usage**: Monitor your API usage in the provider dashboard
3. **Upgrade Plan**: Consider upgrading to a higher tier plan
4. **Spread Requests**: Avoid making too many requests in quick succession

### Model not supported

**Symptoms**: Error indicating the selected model is not available.

**Solutions**:

1. **Check Available Models**: Use the `getProviders` command to see available models
2. **Update Provider**: Ensure you have the latest provider implementation
3. **Use Default Model**: Fall back to the provider's default model
4. **Check Provider Docs**: Refer to the provider's documentation for model availability

### Network connectivity issues

**Symptoms**: Timeouts, connection refused, or network errors.

**Solutions**:

1. **Check Internet Connection**: Verify your internet connection is stable
2. **Firewall Settings**: Ensure your firewall allows API connections
3. **Proxy Configuration**: Configure proxy settings if behind a corporate firewall
4. **Custom Endpoints**: For providers like Z.ai, verify the custom endpoint URL

## Performance Issues

### Slow documentation generation

**Symptoms**: Long wait times when generating documentation.

**Solutions**:

1. **Check Model Performance**: Some models are slower than others
2. **Reduce Context**: Limit the amount of code sent for documentation
3. **Use Caching**: Enable caching for repeated requests
4. **Check Network**: Slow network connections can impact performance

### High memory usage

**Symptoms**: VS Code becomes slow or unresponsive.

**Solutions**:

1. **Clear Cache**: Clear the extension cache regularly
2. **Reduce Context Size**: Limit the project context size
3. **Restart VS Code**: Periodically restart VS Code to clear memory
4. **Monitor Usage**: Use the performance monitor to identify bottlenecks

### Webview loading slowly

**Symptoms**: The Qwiki panel takes a long time to load.

**Solutions**:

1. **Optimize Build**: Ensure the webview is built in production mode
2. **Clear Webview Cache**: Clear the webview cache in developer tools
3. **Check Dependencies**: Large dependencies can slow down loading
4. **Disable Extensions**: Try disabling other extensions to identify conflicts

## Webview Problems

### Webview not displaying

**Symptoms**: The Qwiki panel shows blank or doesn't load.

**Solutions**:

1. **Check Console**: Open developer tools in the webview for errors
2. **Reload Webview**: Right-click and reload the webview
3. **Check Build**: Ensure the webview UI is built:
   ```bash
   pnpm run build:webview
   ```
4. **Verify Paths**: Check that all file paths are correct in the webview configuration

### Styles not loading

**Symptoms**: The webview appears unstyled or broken.

**Solutions**:

1. **Check CSS Build**: Ensure Tailwind CSS is properly built
2. **Verify Asset Paths**: Check that CSS and asset paths are correct
3. **Clear Cache**: Clear the browser cache in the webview
4. **Check CSP**: Verify Content Security Policy allows required resources

### Communication issues

**Symptoms**: Commands from the webview don't work or responses aren't received.

**Solutions**:

1. **Check MessageBus**: Verify the MessageBus is properly initialized
2. **Debug Messages**: Add console.log to message handlers
3. **Check Command Registry**: Ensure commands are properly registered
4. **Verify Event Listeners**: Check that event listeners are properly set up

## Development Issues

### Hot reload not working

**Symptoms**: Changes don't appear when running in development mode.

**Solutions**:

1. **Check Watch Mode**: Ensure webpack is running in watch mode:
   ```bash
   pnpm run watch
   ```
2. **Webview Dev Server**: Start the webview dev server:
   ```bash
   pnpm run start:webview
   ```
3. **Reload Extension**: Use the "Developer: Reload Window" command
4. **Check File Watchers**: Ensure file watchers are properly configured

### TypeScript errors

**Symptoms**: TypeScript compilation errors or type checking failures.

**Solutions**:

1. **Check tsconfig.json**: Verify TypeScript configuration
2. **Update Types**: Ensure all @types packages are up to date
3. **Strict Mode**: Consider disabling strict mode temporarily
4. **Check Imports**: Verify all imports are correct and paths are valid

### Debugging not working

**Symptoms**: Breakpoints don't hit or debugger doesn't attach.

**Solutions**:

1. **Check Launch Configuration**: Verify .vscode/launch.json settings
2. **Source Maps**: Ensure source maps are generated correctly
3. **Extension Host**: Use the Extension Development Host for debugging
4. **Console Output**: Check the Debug Console for error messages

## Frequently Asked Questions

### General

**Q: What programming languages does Qwiki support?**
A: Qwiki supports any programming language that VS Code can highlight, including JavaScript, TypeScript, Python, Java, C++, Go, Rust, and many more.

**Q: Can I use Qwiki offline?**
A: Qwiki requires an internet connection to communicate with LLM providers. However, some cached content may be available offline.

**Q: Is my code sent to third-party services?**
A: Yes, code snippets are sent to the configured LLM provider for documentation generation. Choose providers that align with your privacy requirements.

**Q: Can I use custom LLM models?**
A: Yes, if the provider supports custom models and they're OpenAI-compatible, you can configure them through the provider settings.

### Configuration

**Q: How do I switch between LLM providers?**
A: Open the Qwiki settings panel, select the desired provider from the dropdown, and configure the required settings.

**Q: Can I use multiple providers simultaneously?**
A: Currently, Qwiki uses one active provider at a time, but you can switch between providers as needed.

**Q: How are API keys stored?**
A: API keys are stored securely using VS Code's built-in secret storage, which encrypts the data at rest.

**Q: Can I export/import my configuration?**
A: Configuration is stored in VS Code settings and can be synced using Settings Sync or manually exported.

### Usage

**Q: How much context does Qwiki consider?**
A: Qwiki considers the selected code, file context, and related files. You can configure the context size in the settings.

**Q: Can I generate documentation for entire projects?**
A: Currently, Qwiki focuses on file-level and selection-level documentation. Project-wide documentation is planned for future releases.

**Q: How do I improve the quality of generated documentation?**
A: Provide clear code context, use meaningful variable names, and select the appropriate model for your needs.

**Q: Can I customize the documentation format?**
A: Documentation format is primarily determined by the LLM provider, but you can influence it through the prompt and context provided.

### Troubleshooting

**Q: Why is my documentation generation failing?**
A: Check your API key, network connection, and provider status. Common issues include invalid keys, rate limits, or network problems.

**Q: How do I report bugs or request features?**
A: Create an issue in the project's GitHub repository with detailed information about the problem or feature request.

**Q: Where can I find help if I'm stuck?**
A: Check the documentation, search existing issues, or create a new issue with details about your problem.

### Development

**Q: How do I contribute to Qwiki?**
A: Fork the repository, make your changes following the development guidelines, and submit a pull request.

**Q: What are the system requirements for development?**
A: Node.js 18+, pnpm, VS Code 1.105.0+, and basic knowledge of TypeScript and Vue.js.

**Q: How do I add a new LLM provider?**
A: Implement the LLMProvider interface, add it to the registry, and update the documentation. See the API reference for details.

**Q: Can I customize the webview UI?**
A: Yes, the webview is built with Vue.js and can be customized. Follow the existing component patterns and styling guidelines.

### LLM Provider System

**Q: How does the LLM provider system work?**

A: Qwiki uses a **Registry Pattern** (not Factory) for provider management:

- **Current**: Providers are statically instantiated and registered in `src/llm/providers/registry.ts`
- **Interface**: All providers implement `LLMProvider` interface with standardized methods
- **Configuration**: Each provider defines its own UI configuration through `getUiConfig()`
- **Data Concentration**: Provider-specific HTTP logic, models, and configuration are isolated in provider files
- **Limitations**: Adding providers requires modifying core registry code
- **Future**: Planned evolution to plugin architecture with dynamic discovery

**Current Provider Process**:

1. Implement `LLMProvider` interface
2. Add hardcoded instantiation in registry
3. Provider handles its own HTTP, models, errors
4. UI discovers providers generically

**Future Plugin Vision**:

1. Providers register themselves dynamically
2. Runtime capability discovery
3. No core code modifications needed
4. True extensibility without recompilation

## Getting Additional Help

If you're still experiencing issues:

1. **Check the Logs**: Look at the VS Code developer console and extension logs
2. **Search Issues**: Check the GitHub repository for similar issues
3. **Create an Issue**: Provide detailed information about your problem
4. **Join Discussions**: Participate in community discussions for tips and solutions
5. **Contact Support**: Reach out through the official support channels

## Performance Tips

To get the best performance from Qwiki:

1. **Use Appropriate Models**: Choose models that balance speed and quality
2. **Optimize Context**: Provide relevant but concise context
3. **Enable Caching**: Use cached results for repeated documentation
4. **Regular Updates**: Keep the extension and providers updated
5. **Monitor Usage**: Track your API usage to avoid rate limits

## Security Considerations

- **API Keys**: Never share your API keys or commit them to version control
- **Code Privacy**: Be aware that code is sent to third-party services
- **Provider Selection**: Choose providers that meet your security and privacy requirements
- **Network Security**: Use secure connections (HTTPS) for all API communications
