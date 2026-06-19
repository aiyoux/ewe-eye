// Dashboard layout tree types

export type DashboardNode =
  | { type: 'split'; data: SplitNode }
  | { type: 'tabs'; data: TabsNode }
  | { type: 'widget'; data: WidgetNode };

export interface SplitNode {
  direction: 'horizontal' | 'vertical';
  children: DashboardNode[];
  sizes: number[];
  mobileStack?: boolean;
  stackBreakpoint?: number;
  minHeight?: number;
}

export interface TabsNode {
  tabs: TabEntry[];
  activeIndex: number;
}

export interface TabEntry {
  id: string;
  label: string;
  node: DashboardNode;
}

export interface WidgetNode {
  widgetType: string;
  config: Record<string, unknown>;
  title?: string;
}

export interface DashboardLayout {
  root: DashboardNode | null;
  version: number;
}

// Widget registry types
export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'system' | 'module' | 'custom';
  defaultConfig: Record<string, unknown>;
  configSchema?: ConfigField[];
}

export interface ConfigField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'item-ref';
  label: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

// Dashboard context for mutations
export interface DashboardEditContext {
  layout: DashboardLayout;
  editMode: boolean;
  activeDrag: { path: number[]; handleIndex: number } | null;

  // Node mutations
  updateNode(path: number[], node: DashboardNode): void;
  removeNode(path: number[]): void;
  pushChild(path: number[], node: DashboardNode): void;
  splitNode(path: number[], direction: 'horizontal' | 'vertical'): void;
  createTabs(path: number[]): void;

  // Widget operations
  addWidget(widgetType: string, targetPath?: number[]): void;
  updateWidgetConfig(path: number[], config: Record<string, unknown>): void;
  updateWidgetTitle(path: number[], title: string): void;
}

// Helper to create empty layout
export function createEmptyLayout(): DashboardLayout {
  return {
    root: null,
    version: 1
  };
}

// Helper to create a widget node
export function createWidgetNode(
  widgetType: string,
  config: Record<string, unknown> = {},
  title?: string
): DashboardNode {
  return {
    type: 'widget',
    data: {
      widgetType,
      config,
      title
    }
  };
}

// Helper to create a split node
export function createSplitNode(
  direction: 'horizontal' | 'vertical',
  children: DashboardNode[] = []
): DashboardNode {
  const sizes = new Array(children.length).fill(1);
  return {
    type: 'split',
    data: {
      direction,
      children,
      sizes,
      mobileStack: true
    }
  };
}

// Helper to create a tabs node
export function createTabsNode(tabs: TabEntry[] = []): DashboardNode {
  return {
    type: 'tabs',
    data: {
      tabs,
      activeIndex: 0
    }
  };
}

// Generate unique ID for tabs
export function generateTabId(): string {
  return crypto.randomUUID();
}
