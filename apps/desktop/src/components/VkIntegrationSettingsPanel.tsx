import { VkIntegrationSetup } from './VkIntegrationSetup';
import './vk-integration-settings.css';

export function VkIntegrationSettingsPanel() {
  return (
    <section className="settings-panel" data-testid="vk-integration-settings-panel">
      <h2>Интеграции</h2>
      <p className="settings-panel__desc">
        Глобальные параметры приложения VK ID для OAuth и серверной части Reizoko.
      </p>

      <h3 className="vk-settings__title">ВКонтакте</h3>
      <VkIntegrationSetup presentation="settings" showAllFields />
    </section>
  );
}
