import { Button } from '@/components/ui/button';
import { CASE_TYPES } from '../engine/routingEngine';
import { deriveCaseContext, getRoutingVariant } from '@/lib/caseContext';

export default function RoutingFlow({ state, dispatch, onContinue }) {
  return (
    <div className="space-y-4 card-clinical">
      <h2 className="text-xl font-semibold">Routing Phase</h2>
      <p className="text-sm text-gray-600">Select case type to branch workflow.</p>
      <div className="flex flex-wrap gap-2">
        {CASE_TYPES.map((type) => (
          <Button
            key={type}
            variant={getRoutingVariant(state.caseContext) === type ? 'default' : 'outline'}
            onClick={() => dispatch({ type: 'SET_CASE_CONTEXT', payload: deriveCaseContext({}, { legacyCaseType: type }) })}
          >
            {type}
          </Button>
        ))}
      </div>
      <Button disabled={!state.caseContext} onClick={onContinue}>Start Visit Execution</Button>
    </div>
  );
}
