import { caseFilesApi } from '@/services/api';

export const socialPostApi = {
  getCaseImages: async (caseId) => {
    const response = await caseFilesApi.getByCase(caseId);
    return response.data.files || {};
  },
  saveGenerationMeta: async ({ caseId, generatedBy, imageUrl }) => ({
    caseId,
    generatedBy,
    generatedAt: new Date().toISOString(),
    imageUrl,
  }),
};
