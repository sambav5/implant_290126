import AppLayout from '@/layout/AppLayout';
import ContentContainer from '@/components/ui/ContentContainer';
import ChecklistPage from '@/modules/checklist/components/ChecklistPage';
import { ChecklistProvider } from '@/modules/checklist/state/checklist.store';
import { useChecklist } from '@/modules/checklist/hooks/useChecklist';

function ChecklistScreen() {
  const { state, dispatch } = useChecklist();
  return <ChecklistPage state={state} dispatch={dispatch} />;
}

export default function ProstheticChecklist() {
  return (
    <AppLayout>
      <ContentContainer className="py-4">
        <ChecklistProvider>
          <ChecklistScreen />
        </ChecklistProvider>
      </ContentContainer>
    </AppLayout>
  );
}
