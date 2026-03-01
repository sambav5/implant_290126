import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaseForm from '../CaseForm';
import { caseApi } from '../../services/api';
import { toast } from 'sonner';

jest.mock('../../services/api', () => ({
  caseApi: {
    create: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const setup = async () => {
  render(<CaseForm />);

  const boneQuality = screen.getByRole('combobox', { name: /bone quality/i });
  const smokingStatus = screen.getByRole('combobox', { name: /smoking status/i });
  const aestheticZone = screen.getByRole('combobox', { name: /aesthetic zone/i });
  const systemicRisk = screen.getByRole('combobox', { name: /systemic risk/i });
  const submitButton = screen.getByRole('button', { name: /submit|save|create case/i });

  return {
    boneQuality,
    smokingStatus,
    aestheticZone,
    systemicRisk,
    submitButton,
  };
};

describe('CaseForm - advanced validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('highlights all required fields when submitted empty', async () => {
    const { submitButton, boneQuality, smokingStatus, systemicRisk } = await setup();

    submitButton.click();

    expect(caseApi.create).not.toHaveBeenCalled();

    // Prefer aria-invalid, but class-based fallback is also accepted for visual highlighting
    expect(boneQuality).toHaveAttribute('aria-invalid', 'true');
    expect(smokingStatus).toHaveAttribute('aria-invalid', 'true');
    expect(systemicRisk).toHaveAttribute('aria-invalid', 'true');
  });

  test('enforces conditional validation: aesthetic zone required when case is anterior', async () => {
    const { boneQuality, smokingStatus, systemicRisk, submitButton } = await setup();

    fireEvent.change(boneQuality, { target: { value: 'D2' } });
    fireEvent.change(smokingStatus, { target: { value: 'never' } });
    fireEvent.change(systemicRisk, { target: { value: 'low' } });

    const anteriorCheckbox = screen.getByRole('checkbox', { name: /anterior/i });
    fireEvent.click(anteriorCheckbox);

    submitButton.click();

    expect(caseApi.create).not.toHaveBeenCalled();
    expect(screen.getByText(/aesthetic zone is required for anterior cases/i)).toBeInTheDocument();
  });

  test('submits with correct payload when form is valid', async () => {
    caseApi.create.mockResolvedValueOnce({ data: { id: 'case-123' } });

    const { boneQuality, smokingStatus, systemicRisk, aestheticZone, submitButton } = await setup();

    fireEvent.change(boneQuality, { target: { value: 'D2' } });
    fireEvent.change(smokingStatus, { target: { value: 'former' } });
    fireEvent.change(systemicRisk, { target: { value: 'moderate' } });

    const anteriorCheckbox = screen.getByRole('checkbox', { name: /anterior/i });
    fireEvent.click(anteriorCheckbox);
    fireEvent.change(aestheticZone, { target: { value: 'high' } });

    submitButton.click();

    await waitFor(() => {
      expect(caseApi.create).toHaveBeenCalledWith({
        boneQuality: 'D2',
        smokingStatus: 'former',
        isAnterior: true,
        aestheticZone: 'high',
        systemicRisk: 'moderate',
      });
    });

    expect(toast.error).not.toHaveBeenCalled();
  });

  test('prevents submission while invalid and only submits after fixing errors', async () => {
    caseApi.create.mockResolvedValueOnce({ data: { id: 'case-123' } });

    const { boneQuality, smokingStatus, systemicRisk, aestheticZone, submitButton } = await setup();

    const anteriorCheckbox = screen.getByRole('checkbox', { name: /anterior/i });
    fireEvent.click(anteriorCheckbox);

    fireEvent.change(boneQuality, { target: { value: 'D3' } });
    fireEvent.change(smokingStatus, { target: { value: 'current' } });
    fireEvent.change(systemicRisk, { target: { value: 'high' } });

    submitButton.click();
    expect(caseApi.create).not.toHaveBeenCalled();

    fireEvent.change(aestheticZone, { target: { value: 'medium' } });
    submitButton.click();

    await waitFor(() => {
      expect(caseApi.create).toHaveBeenCalledTimes(1);
    });
  });

  test('shows API error feedback when submission fails', async () => {
    caseApi.create.mockRejectedValueOnce(new Error('Server unavailable'));

    const { boneQuality, smokingStatus, systemicRisk, submitButton } = await setup();

    fireEvent.change(boneQuality, { target: { value: 'D1' } });
    fireEvent.change(smokingStatus, { target: { value: 'never' } });
    fireEvent.change(systemicRisk, { target: { value: 'low' } });

    const anteriorCheckbox = screen.getByRole('checkbox', { name: /anterior/i });
    // posterior case should not require aesthetic zone
    expect(anteriorCheckbox).not.toBeChecked();

    submitButton.click();

    await waitFor(() => {
      expect(caseApi.create).toHaveBeenCalledTimes(1);
    });

    expect(toast.error).toHaveBeenCalled();
  });
});
