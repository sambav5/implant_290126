import { expect, test } from '@playwright/test';
import { WORKFLOW_ASSIGNMENTS } from '../fixtures/mock-data';
import { PlaywrightApiClient } from '../helpers/api-client';
import { createCaseViaApi } from '../helpers/create-case-helper';

test.describe('API regression - case creation and team assignment APIs', () => {
  test('creates a case and exposes it in the clinician dashboard feed', async () => {
    const client = await PlaywrightApiClient.create();

    const created = await createCaseViaApi(client, {
      patientName: 'Kiran Patel',
      caseTitle: 'Posterior implant - 36',
      toothNumber: '36',
    });

    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ caseTitle: 'Posterior implant - 36', toothNumber: '36' });

    const cases = await client.getCases();
    expect(cases.status).toBe(200);
    expect((cases.data as { cases: unknown[] }).cases).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: (created.data as { id: string }).id })]),
    );

    await client.dispose();
  });

  test('updates persisted workflow team assignments after case creation', async () => {
    const client = await PlaywrightApiClient.create();
    const created = await createCaseViaApi(client);
    const caseId = (created.data as { id: string }).id;

    const updated = await client.updateCaseTeam(caseId, [
      ...WORKFLOW_ASSIGNMENTS.slice(0, 4),
      { stage: 'ASSISTANT_SUPPORT', userId: 'tm-periodontist' },
    ]);

    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({
      stageAssignments: expect.arrayContaining([
        expect.objectContaining({ stage: 'ASSISTANT_SUPPORT', user: expect.objectContaining({ id: 'tm-periodontist' }) }),
      ]),
    });

    await client.dispose();
  });
});
