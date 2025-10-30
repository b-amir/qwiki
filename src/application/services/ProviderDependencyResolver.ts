import { ProviderMetadata } from "../../llm/types/ProviderMetadata";
import { ValidationResult } from "../../llm/types/ProviderCapabilities";

export interface DependencyGraph {
  nodes: Map<string, ProviderMetadata>;
  edges: Map<string, string[]>;
  resolved: boolean;
}

export class ProviderDependencyResolver {
  resolveDependencies(providers: ProviderMetadata[]): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      resolved: false,
    };

    for (const provider of providers) {
      graph.nodes.set(provider.id, provider);
      graph.edges.set(provider.id, provider.dependencies || []);
    }

    this.detectCircularDependencies(graph);

    graph.resolved = true;
    return graph;
  }

  getLoadOrder(providers: ProviderMetadata[]): string[] {
    const graph = this.resolveDependencies(providers);
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const loadOrder: string[] = [];

    const visit = (providerId: string): void => {
      if (visiting.has(providerId)) {
        throw new Error(`Circular dependency detected involving ${providerId}`);
      }

      if (visited.has(providerId)) {
        return;
      }

      visiting.add(providerId);

      const dependencies = graph.edges.get(providerId) || [];
      for (const dep of dependencies) {
        if (!graph.nodes.has(dep)) {
          throw new Error(`Dependency ${dep} not found for provider ${providerId}`);
        }
        visit(dep);
      }

      visiting.delete(providerId);
      visited.add(providerId);
      loadOrder.push(providerId);
    };

    for (const providerId of graph.nodes.keys()) {
      if (!visited.has(providerId)) {
        visit(providerId);
      }
    }

    return loadOrder;
  }

  checkCircularDependencies(providers: ProviderMetadata[]): ValidationResult {
    const graph = this.resolveDependencies(providers);
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.getLoadOrder(providers);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Circular dependency")) {
        errors.push(error.message);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateDependencies(providers: ProviderMetadata[]): ValidationResult {
    const graph = this.resolveDependencies(providers);
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [providerId, dependencies] of graph.edges.entries()) {
      for (const dep of dependencies) {
        if (!graph.nodes.has(dep)) {
          errors.push(`Provider ${providerId} depends on missing provider ${dep}`);
        }
      }
    }

    const circularCheck = this.checkCircularDependencies(providers);
    errors.push(...circularCheck.errors);
    warnings.push(...circularCheck.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private detectCircularDependencies(graph: DependencyGraph): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (providerId: string): boolean => {
      if (recursionStack.has(providerId)) {
        return true;
      }

      if (visited.has(providerId)) {
        return false;
      }

      visited.add(providerId);
      recursionStack.add(providerId);

      const dependencies = graph.edges.get(providerId) || [];
      for (const dep of dependencies) {
        if (hasCycle(dep)) {
          return true;
        }
      }

      recursionStack.delete(providerId);
      return false;
    };

    for (const providerId of graph.nodes.keys()) {
      if (!visited.has(providerId) && hasCycle(providerId)) {
        throw new Error(`Circular dependency detected involving ${providerId}`);
      }
    }
  }

  getDependencyLevels(providers: ProviderMetadata[]): Map<number, string[]> {
    const graph = this.resolveDependencies(providers);
    const loadOrder = this.getLoadOrder(providers);
    const levels = new Map<number, string[]>();
    const providerLevels = new Map<string, number>();

    for (let i = 0; i < loadOrder.length; i++) {
      const providerId = loadOrder[i];
      const dependencies = graph.edges.get(providerId) || [];

      let maxDepLevel = -1;
      for (const dep of dependencies) {
        const depLevel = providerLevels.get(dep) || 0;
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }

      const level = maxDepLevel + 1;
      providerLevels.set(providerId, level);

      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(providerId);
    }

    return levels;
  }

  getMissingDependencies(providers: ProviderMetadata[]): string[] {
    const graph = this.resolveDependencies(providers);
    const allDependencies = new Set<string>();
    const availableProviders = new Set(providers.map((p) => p.id));

    for (const dependencies of graph.edges.values()) {
      for (const dep of dependencies) {
        allDependencies.add(dep);
      }
    }

    const missing: string[] = [];
    for (const dep of allDependencies) {
      if (!availableProviders.has(dep)) {
        missing.push(dep);
      }
    }

    return missing;
  }

  getDependencyTree(providers: ProviderMetadata[], rootId: string): DependencyTree | null {
    const graph = this.resolveDependencies(providers);

    if (!graph.nodes.has(rootId)) {
      return null;
    }

    const buildTree = (providerId: string): DependencyTree => {
      const metadata = graph.nodes.get(providerId)!;
      const dependencies = graph.edges.get(providerId) || [];
      const children = dependencies.map((dep) => buildTree(dep));

      return {
        providerId,
        metadata,
        dependencies: children,
        level: 0,
      };
    };

    const tree = buildTree(rootId);
    this.calculateTreeLevels(tree);
    return tree;
  }

  private calculateTreeLevels(tree: DependencyTree, currentLevel = 0): void {
    tree.level = currentLevel;
    for (const child of tree.dependencies) {
      this.calculateTreeLevels(child, currentLevel + 1);
    }
  }
}

export interface DependencyTree {
  providerId: string;
  metadata: ProviderMetadata;
  dependencies: DependencyTree[];
  level: number;
}
