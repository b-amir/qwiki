# Configuration Management System

This document explains how to use the configuration management system implemented in Phase 10.

## Purpose

The configuration management system provides:

- Centralized configuration access through `ConfigurationManager`
- Automatic validation of configuration values
- Migration of configuration between versions
- Type-safe configuration access

## How to Use

### 1. Getting Configuration Values

```typescript
// Get a specific configuration value
const zaiBaseUrl = configManager.getZaiBaseUrl();
const googleEndpoint = configManager.getGoogleAIEndpoint();

// Get any configuration value
const value = await configManager.get<string>("someKey");

// Get all configuration
const allConfig = await configManager.getAll();
```

### 2. Setting Configuration Values

```typescript
// Set a configuration value (with validation)
await configManager.set("zaiBaseUrl", "https://api.example.com");

// Using convenience methods
await configManager.setZaiBaseUrl("https://api.example.com");
await configManager.setGoogleAIEndpoint("native");
```

### 3. Validation

Configuration values are automatically validated against the schema defined in `ConfigurationSchema.ts`:

```typescript
// This will throw ConfigurationError if invalid
await configManager.set("googleAIEndpoint", "invalid-value");
```

### 4. Migration

Configuration is automatically migrated when the extension starts. The migration system:

- Tracks current configuration version
- Applies migration steps in order
- Handles migration errors gracefully

## About the Migration System

The migration system is designed for future-proofing. Currently it has basic migrations, but as the extension evolves:

1. **Adding new configuration keys**: Add a migration step that sets default values
2. **Changing configuration structure**: Add a migration step that transforms old values to new format
3. **Removing configuration keys**: Add a migration step that cleans up old keys

Example of adding a new configuration in the future:

```typescript
// In ConfigurationMigration.ts
{
  version: "1.1.0",
  description: "Add new maxTokens configuration",
  migrate: async (config) => {
    const newConfig = { ...config };
    if (newConfig.maxTokens === undefined) {
      newConfig.maxTokens = 1000; // Default value
    }
    return newConfig;
  },
}
```

## Do We Need to Keep the Migration System?

**Yes, for these reasons:**

1. **Future Changes**: As the extension grows, configuration will likely change
2. **User Experience**: Users won't lose their settings when updating
3. **Version Compatibility**: Handles upgrades smoothly
4. **Error Prevention**: Ensures configuration is always valid

However, if you feel the migration system is over-engineered for current needs, we could simplify it to just:

- Remove version tracking
- Keep only validation
- Keep the centralized ConfigurationManager

The migration system adds minimal complexity and provides significant benefits for future maintenance.
