import { WorkspaceState } from '@reizoko/shared';

export const DEFAULT_WORKSPACE: WorkspaceState = {
  activeTabId: 'editor',
  openPlatformTabs: [],
  currentContentItemId: null,
  sidebarSection: 'editor',
};

export class WorkspaceService {
  private state: WorkspaceState = { ...DEFAULT_WORKSPACE };

  getState(): WorkspaceState {
    return { ...this.state };
  }

  setState(state: WorkspaceState): void {
    this.state = { ...state };
  }

  openPlatformTab(platformId: string): WorkspaceState {
    if (!this.state.openPlatformTabs.includes(platformId)) {
      this.state.openPlatformTabs = [...this.state.openPlatformTabs, platformId];
    }
    this.state.activeTabId = `platform-${platformId}`;
    return this.getState();
  }

  closePlatformTab(platformId: string): WorkspaceState {
    this.state.openPlatformTabs = this.state.openPlatformTabs.filter((id) => id !== platformId);
    if (this.state.activeTabId === `platform-${platformId}`) {
      this.state.activeTabId = 'editor';
    }
    return this.getState();
  }

  setActiveTab(tabId: string): WorkspaceState {
    this.state.activeTabId = tabId;
    return this.getState();
  }

  setCurrentContentItem(contentItemId: string | null): WorkspaceState {
    this.state.currentContentItemId = contentItemId;
    return this.getState();
  }

  setSidebarSection(section: WorkspaceState['sidebarSection']): WorkspaceState {
    this.state.sidebarSection = section;
    return this.getState();
  }
}
