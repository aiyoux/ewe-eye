import type { AppModule, BuildProfile } from '@modular-app/module-sdk';

export * from './scope-filter.ts';

export function createBuildProfile(
  name: string,
  appTitle: string,
  modules: AppModule[]
): BuildProfile {
  return { name, appTitle, modules };
}

export function getModuleById(profile: BuildProfile, moduleId: string): AppModule | undefined {
  return profile.modules.find((module) => module.id === moduleId);
}

export function listModuleSummaries(profile: BuildProfile) {
  return profile.modules.map((module) => ({
    id: module.id,
    title: module.title,
    summary: module.summary,
    href: module.href,
    visibility: module.visibility
  }));
}
