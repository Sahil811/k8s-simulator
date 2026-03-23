import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EventsPanel } from './components/EventsPanel';
import { WhyPanel } from './components/WhyPanel';
import { LearningPathModule } from './modules/LearningPathModule';
import { OverviewModule } from './modules/OverviewModule';
import { ControlPlaneModule } from './modules/ControlPlaneModule';
import { WorkloadsModule } from './modules/WorkloadsModule';
import { NetworkingModule } from './modules/NetworkingModule';
import { StorageModule } from './modules/StorageModule';
import { RBACModule } from './modules/RBACModule';
import { ScalingModule } from './modules/ScalingModule';
import { ScenariosModule } from './modules/ScenariosModule';
import { YAMLEditorModule } from './modules/YAMLEditorModule';
import { KubectlTerminalModule } from './modules/KubectlTerminalModule';
import { useSimulator } from './store/simulatorStore';
import { ConceptCard, registerConceptCardOpener } from './components/ConceptCard';
import { AchievementToastContainer } from './components/AchievementToast';
import { XRayOverlay } from './components/XRayOverlay';

export function App() {
  const { activeModule, startLoop } = useSimulator();
  const [openConceptId, setOpenConceptId] = useState<string | null>(null);

  useEffect(() => {
    startLoop();
    registerConceptCardOpener((id) => setOpenConceptId(id));
  }, []);

  function renderModule() {
    switch (activeModule) {
      case 'learningpath': return <LearningPathModule />;
      case 'overview': return <OverviewModule />;
      case 'controlplane': return <ControlPlaneModule />;
      case 'workloads': return <WorkloadsModule />;
      case 'networking': return <NetworkingModule />;
      case 'storage': return <StorageModule />;
      case 'rbac': return <RBACModule />;
      case 'scaling': return <ScalingModule />;
      case 'scenarios': return <ScenariosModule />;
      case 'yaml': return <YAMLEditorModule />;
      case 'terminal': return <KubectlTerminalModule />;
      default: return <OverviewModule />;
    }
  }

  return (
    <div className="app-shell">
      <Header />
      <Sidebar />
      <main className="main-content" role="main">
        {renderModule()}
      </main>
      <EventsPanel />
      <WhyPanel />
      <AchievementToastContainer />
      <XRayOverlay />
      {openConceptId && (
        <ConceptCard conceptId={openConceptId} onClose={() => setOpenConceptId(null)} />
      )}
    </div>
  );
}
