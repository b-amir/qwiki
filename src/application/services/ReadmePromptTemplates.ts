import type { ProjectTypeDetection } from "../../domain/entities/ContextIntelligence";

export class ReadmePromptTemplates {
  static buildRecommendedStructure(projectType: ProjectTypeDetection): string {
    const isWebProject =
      projectType.framework === "react" ||
      projectType.framework === "vue" ||
      projectType.framework === "angular" ||
      projectType.framework === "nextjs";
    const hasPackageManager = !!projectType.packageManager;

    const sections = [
      "1. **Title** - Clear project name with optional tagline or logo",
      "2. **Description** - 2-4 sentence overview: what it does, who it's for, why it exists",
      "3. **Features** - Key features and capabilities (incorporate wiki documentation here)",
      "4. **Installation** - Only if applicable: prerequisites and step-by-step setup instructions",
      "5. **Usage** - How to use the project with examples (incorporate wiki code examples here)",
      "6. **Project Structure** - Overview of directory organization and key files/folders",
      "7. **Configuration** - Only if applicable: configuration options, environment variables, settings",
      "8. **API Documentation** - Only if applicable: API endpoints, methods, parameters (from wikis)",
      "9. **Contributing** - Only if applicable: how to contribute, development setup, coding standards",
      "10. **License** - Only if applicable: license information",
      "11. **Acknowledgments** - Only if applicable: credits, thanks, attribution",
      "12. **Contact/Support** - Only if applicable: ways to get help, report issues, contact maintainers",
    ];

    if (hasPackageManager) {
      sections.splice(3, 0, "3. **Prerequisites** - Required software versions, dependencies");
      sections[4] = "4. **Installation** - Step-by-step setup instructions";
      sections[5] = "5. **Usage** - How to use the project with examples";
      sections[6] = "6. **Features** - Key features and capabilities (incorporate wiki documentation here)";
      sections[7] = "7. **Project Structure** - Overview of directory organization and key files/folders";
    }

    if (isWebProject) {
      sections.push("13. **Screenshots** - Only if applicable: visual examples of the application");
    }

    return sections.join("\n");
  }

  static getInstructionsForNewReadme(): string {
    return `Follow the recommended structure provided above, including these essential sections:
- **Title and Description**: Clear project name and 2-4 sentence overview based on project context
- **Features**: List key features, incorporating wiki documentation into relevant feature descriptions
- **Project Structure**: Explain directory organization based on the project structure from context
- **Installation**: Include only if the project type suggests installation is needed (e.g., has package manager)
- **Usage**: Provide clear examples showing how to use the project, incorporating wiki code examples
- **API Documentation**: Include if wikis contain API/function documentation - organize by component/module

Additional sections to consider (only if relevant):
- Table of Contents (if README has 5+ sections)
- Configuration (if project has config files or environment variables)
- Contributing (if project appears to be open source)
- License (if license information is available)
- Contact/Support (if applicable)

IMPORTANT: 
- The README should provide a comprehensive overview of the ENTIRE project
- The saved wikis document specific components - integrate them into relevant feature/component sections
- Do not let wikis dominate the README - they enhance specific areas, not define the whole project
- Be concise but comprehensive - essential information without overwhelming readers
- Write for developers who may be new to the project`;
  }

  static getInstructionsForUserContributed(): string {
    return `1. **Analyze** the existing README's style, tone, structure, and section ordering
2. **Understand** the full project scope using the project overview context
3. **Integrate** wiki content by updating or adding relevant sections that match the existing structure
4. **Preserve** ALL existing user-written content, formatting style, and personal touches
5. **Maintain** the existing README's formatting conventions (heading levels, code block styles, spacing)
6. **Enhance** existing sections with information from wikis and project context where appropriate
7. **Add** new sections only if they provide value and match the README's style
8. **Ensure** the updated README flows naturally and maintains consistency with the original style

Section Integration Guidelines:
- If a "Features" section exists, add wiki-documented components as new feature items
- If a "Usage" section exists, incorporate wiki code examples into relevant subsections
- If an "API Documentation" section exists, organize wiki content by component/module
- If no relevant section exists, create new sections that match the existing style and structure
- Remember: Wikis document specific parts - integrate them appropriately without making the README seem focused only on those parts

IMPORTANT: Do NOT remove or significantly alter any existing user-written content. Preserve the user's voice and formatting preferences.`;
  }

  static getInstructionsForExistingReadme(): string {
    return `1. **Analyze** the existing README's style, tone, structure, and section ordering
2. **Understand** the full project scope using the project overview context
3. **Integrate** wiki content by updating or adding relevant sections that match the existing structure
4. **Preserve** ALL existing user-written content, formatting style, and personal touches
5. **Maintain** the existing README's formatting conventions (heading levels, code block styles, spacing)
6. **Enhance** existing sections with information from wikis and project context where appropriate
7. **Add** new sections only if they provide value and match the README's style
8. **Ensure** the updated README flows naturally and maintains consistency with the original style

Section Integration Guidelines:
- If a "Features" section exists, add wiki-documented components as new feature items
- If a "Usage" section exists, incorporate wiki code examples into relevant subsections
- If an "API Documentation" section exists, organize wiki content by component/module
- If no relevant section exists, create new sections that match the existing style and structure
- Remember: Wikis document specific parts - integrate them appropriately without making the README seem focused only on those parts

Follow the style and structure of the existing README. Preserve the user's voice and formatting preferences.`;
  }
}

