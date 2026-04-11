import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { gateFields } from '../engine/gateEngine';
import WarningBanner from '../components/WarningBanner';

export default function GateFlow({ state, dispatch, onContinue }) {
  const updateRisk = (key, value) => dispatch({ type: 'SET_PATIENT_DATA', payload: { [key]: value } });

  return (
    <div className="space-y-6 card-clinical">
      <h2 className="text-xl font-semibold">Gate Phase</h2>
      {gateFields.map((field) => (
        <div key={field.key} className="space-y-2">
          <p className="text-sm font-medium">{field.label}</p>
          <Select value={state.patientData[field.key]} onValueChange={(value) => updateRisk(field.key, value)}>
            <SelectTrigger className="w-full max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="severe">Severe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}

      {state.gate.gateStatus === 'AMBER' && <WarningBanner warnings={state.gate.warnings} />}
      {state.gate.gateStatus === 'GO' && <div className="text-emerald-700 font-medium">GO — Gate cleared.</div>}
      {state.gate.gateStatus !== 'STOP' && <Button onClick={onContinue}>Continue to Routing</Button>}
    </div>
  );
}
