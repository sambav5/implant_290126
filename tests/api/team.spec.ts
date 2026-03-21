import { expect, test } from '@playwright/test';
import { NEW_MEMBER } from '../fixtures/mock-data';
import { PlaywrightApiClient } from '../helpers/api-client';

test.describe('API regression - team APIs', () => {
  test('lists, creates, and updates team members', async () => {
    const client = await PlaywrightApiClient.create();

    const before = await client.getTeam();
    expect(before.status).toBe(200);
    expect((before.data as unknown[]).length).toBeGreaterThan(0);

    const created = await client.addTeamMember(NEW_MEMBER);
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ name: NEW_MEMBER.name, role: NEW_MEMBER.role });

    const updated = await client.updateTeamMember((created.data as { id: string }).id, {
      ...NEW_MEMBER,
      name: 'Dr. Nisha Updated',
    });
    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({ name: 'Dr. Nisha Updated' });

    await client.dispose();
  });
});
