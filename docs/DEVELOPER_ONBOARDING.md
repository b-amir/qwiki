# Developer Onboarding Guide

## Welcome to Qwiki

This guide will help you get started with developing the Qwiki VS Code extension. Qwiki is a VS Code extension that generates documentation for code using AI models.

## Prerequisites

Before you start, make sure you have:

- Node.js (v18 or higher)
- pnpm package manager
- Visual Studio Code
- Basic knowledge of TypeScript
- Understanding of VS Code extension development

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd qwiki
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build the Extension

```bash
pnpm run compile
```

### 4. Run in Development Mode

1. Open the project in VS Code
2. Press F5 to launch a new Extension Development Host window
3. In the new window, open a project folder
4. Open the Qwiki panel from the activity bar

## Project Structure

The project follows a clean architecture with clear separation of concerns:

```
src/
├── application/          # Application services and commands
├── domain/              # Core business entities and interfaces
├── infrastructure/      # External integrations and implementations
├── panels/              # VS Code webview panels
├── constants/           # Application constants
├── container/           # Dependency injection container
├── errors/              # Custom error classes
├── events/              # Event system
├── factories/           # Factory classes
├── llm/                 # LLM provider implementations
└── utilities/           # Utility functions
```

## Key Concepts

### 1. Architecture Layers

The extension follows a layered architecture:

- **Domain Layer**: Core business entities and interfaces
- **Application Layer**: Services, commands, and business logic
- **Infrastructure Layer**: External integrations and implementations
- **Presentation Layer**: UI components and webviews

### 2. Dependency Injection

The extension uses a dependency injection container to manage services:

```typescript
// Register a service
container.register("serviceName", () => new Service());

// Get a service
const service = container.get<Service>("serviceName");
```

### 3. Command Pattern

All user actions are implemented as commands:

```typescript
class GenerateWikiCommand implements Command {
  async execute(...args: any[]): Promise<any> {
    // Command implementation
  }
}
```

### 4. Repository Pattern

Data access is abstracted through repositories:

```typescript
interface ApiKeyRepository {
  save(provider: string, apiKey: string): Promise<void>;
  get(provider: string): Promise<string | undefined>;
  delete(provider: string): Promise<void>;
  list(): Promise<string[]>;
}
```

## Development Workflow

### 1. Making Changes

1. Identify the appropriate layer for your changes
2. Follow the existing patterns and conventions
3. Ensure your code follows SOLID principles
4. Test your changes in the development environment

### 2. Adding New Features

1. Define domain entities if needed
2. Create repository interfaces
3. Implement application services
4. Create commands for user interactions
5. Add infrastructure implementations
6. Update UI components if necessary

### 3. Adding New LLM Providers

1. Create provider implementation in `src/llm/providers/`
2. Update `LLMProviderFactory` to include the new provider
3. Add provider configuration to constants
4. Update provider list command

## Code Style Guidelines

### 1. General Rules

- No comments in the code (code should be self-explanatory)
- Keep functions small and focused
- Use descriptive variable and function names
- Follow TypeScript best practices
- Use barrel imports for cleaner import statements

### 2. File Organization

- Use index.ts files for barrel exports
- Group related files in directories
- Follow the established naming conventions
- Keep file structure consistent with the architecture

### 3. Error Handling

- Use custom error classes from `src/errors/`
- Implement proper error recovery
- Provide meaningful error messages to users
- Use the global error handler for consistent error processing

## Common Tasks

### 1. Adding a New Command

1. Create command class in `src/application/commands/`
2. Implement the `Command` interface
3. Register the command in `CommandRegistry`
4. Add command to constants
5. Update webview to call the new command

Example:

```typescript
// src/application/commands/NewFeatureCommand.ts
export class NewFeatureCommand implements Command {
  async execute(...args: any[]): Promise<any> {
    // Implementation
  }
}

// Register in CommandRegistry
container.register("newFeatureCommand", () => new NewFeatureCommand());
commandRegistry.register("newFeature", "newFeatureCommand");
```

### 2. Adding a New Service

1. Create service class in `src/application/services/`
2. Define service interface if needed
3. Register service in `AppBootstrap`
4. Inject service where needed

Example:

```typescript
// src/application/services/NewService.ts
export class NewService {
  constructor(private dependency: Dependency) {}

  async performAction(): Promise<Result> {
    // Implementation
  }
}

// Register in AppBootstrap
container.register("newService", () => new NewService(container.get("dependency")));
```

### 3. Adding a New Repository Implementation

1. Create implementation in `src/infrastructure/repositories/`
2. Implement the repository interface from domain layer
3. Register implementation in `AppBootstrap`

Example:

```typescript
// src/infrastructure/repositories/NewRepositoryImpl.ts
export class NewRepositoryImpl implements NewRepository {
  async save(data: Data): Promise<void> {
    // Implementation
  }
}

// Register in AppBootstrap
container.register("newRepository", () => new NewRepositoryImpl());
```

## Testing

### 1. Running Tests

```bash
pnpm test
```

### 2. Writing Tests

- Test individual components in isolation
- Use dependency injection for mocking
- Test commands, services, and repositories separately
- Focus on business logic testing

### 3. Test Structure

```
src/test/
├── unit/              # Unit tests for individual components
├── integration/       # Integration tests
├── mocks/            # Mock implementations
└── utils/            # Test utilities
```

## Debugging

### 1. Extension Debugging

1. Set breakpoints in your code
2. Press F5 to launch the extension in debug mode
3. Use the VS Code debugger to step through code

### 2. Webview Debugging

1. Open the webview in the extension
2. Right-click and select "Inspect" to open DevTools
3. Use DevTools for frontend debugging

### 3. Common Issues

- **Extension not loading**: Check the extension.ts file for errors
- **Commands not working**: Verify command registration in CommandRegistry
- **Services not available**: Ensure proper DI registration in AppBootstrap
- **Webview not communicating**: Check MessageBus implementation

## Performance Considerations

### 1. Caching

- Use cached services for expensive operations
- Implement TTL-based caching where appropriate
- Cache webview messages to reduce communication overhead

### 2. Lazy Loading

- Services are lazy-loaded by default
- Use lazy loading for heavy initialization
- Consider lazy loading for webview components

### 3. Memory Management

- Dispose of resources properly
- Clean up event listeners
- Use weak references where appropriate

## Contributing Guidelines

### 1. Before Submitting

1. Ensure your code follows the project's style guidelines
2. Test your changes thoroughly
3. Update documentation if necessary
4. Ensure all existing tests pass

### 2. Pull Request Process

1. Create a feature branch from main
2. Make your changes following the established patterns
3. Test your changes
4. Submit a pull request with a clear description
5. Address any feedback from code review

### 3. Code Review

- Focus on architecture adherence
- Check for SOLID principles violations
- Verify error handling implementation
- Ensure performance considerations are addressed

## Resources

### 1. Documentation

- [Architecture Documentation](./ARCHITECTURE.md)
- [SOLID Principles Implementation](./SOLID_PRINCIPLES.md)
- [VS Code Extension API](https://code.visualstudio.com/api)

### 2. Tools

- [VS Code Extension Development](https://code.visualstudio.com/api/get-started/your-first-extension)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vue.js Documentation](https://vuejs.org/guide/) (for webview UI)

### 3. Best Practices

- [Clean Code Principles](https://clean-code-developer.com/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Design Patterns](https://refactoring.guru/design-patterns)

## Getting Help

If you need help:

1. Check the existing documentation
2. Look at similar implementations in the codebase
3. Ask questions in team channels
4. Create an issue for bugs or feature requests

## Quick Reference

### Common File Locations

- Commands: `src/application/commands/`
- Services: `src/application/services/`
- Repositories: `src/infrastructure/repositories/`
- Constants: `src/constants/`
- Error Classes: `src/errors/`
- Webview UI: `webview-ui/src/`

### Common Patterns

- **Command Pattern**: All user actions
- **Repository Pattern**: Data access
- **Factory Pattern**: Object creation
- **Dependency Injection**: Service management
- **Event System**: Loose coupling

### Key Classes

- `CommandRegistry`: Command management
- `Container`: Dependency injection
- `MessageBus`: Webview communication
- `EventBus`: Event system
- `AppBootstrap`: Application initialization

Remember: The goal is to maintain clean, modular, and maintainable code following SOLID principles. When in doubt, look at existing implementations for guidance.
