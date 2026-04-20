const DEFAULT_MODIFIERS = {
  esthetic: false,
  sinus: false,
  immediate: false,
  full_arch: false,
  gbr: false,
  guide: true,
};

const LEGACY_TYPE_TO_MODIFIERS = {
  esthetic: { esthetic: true },
  sinus: { sinus: true },
  full_arch: { full_arch: true },
  immediate: { immediate: true },
};

function parseNumericValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;
  const numeric = Number.parseFloat(String(rawValue).replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function getBaseCase(data = {}) {
  const span = String(data.span || '').toLowerCase();
  const restorativeContext = String(data.restorativeContext || '').toLowerCase();
  const toothCount = parseNumericValue(data.teeth_count ?? data.teethCount);

  if (span === 'full_arch' || restorativeContext === 'fixed_prosthesis') return 'full_arch';
  if (toothCount !== null && toothCount > 1) return 'multiple_teeth';
  return 'single_tooth';
}

function getLegacyModifierMap(legacyType) {
  const normalized = String(legacyType || '').toLowerCase();
  return LEGACY_TYPE_TO_MODIFIERS[normalized] || {};
}

export function deriveCaseContext(data = {}, options = {}) {
  const boneHeightNumeric = parseNumericValue(data.bone_height ?? data.boneHeight);
  const buccalPlateNumeric = parseNumericValue(data.buccal_plate_thickness ?? data.buccalPlateThickness);
  const toothPosition = String(data.tooth_position || '').toLowerCase();
  const socketStatus = String(data.socket_status || '').toLowerCase();
  const span = String(data.span || '').toLowerCase();

  const legacyCamel = data['case' + 'Type'];
  const legacySnake = data['case_' + 'type'];
  const legacyMap = getLegacyModifierMap(options.legacyCaseType ?? legacyCamel ?? legacySnake);

  return {
    baseCase: getBaseCase(data),
    modifiers: {
      ...DEFAULT_MODIFIERS,
      ...legacyMap,
      esthetic: legacyMap.esthetic || toothPosition === 'anterior' || data.estheticZone === 'high',
      sinus: legacyMap.sinus || (boneHeightNumeric !== null && boneHeightNumeric < 8) || data.boneHeight === '6-8mm' || data.boneHeight === '<6mm',
      immediate: legacyMap.immediate || socketStatus === 'fresh_extraction',
      full_arch: legacyMap.full_arch || span === 'full_arch' || data.restorativeContext === 'fixed_prosthesis',
      gbr: legacyMap.gbr || (buccalPlateNumeric !== null && buccalPlateNumeric < 1) || data.boneWidth === '<4mm',
      guide: data.guide ?? options.guideDefault ?? true,
    },
  };
}

export function migrateLegacyCaseContext(data = {}) {
  const existing = data.caseContext;
  if (existing?.baseCase && existing?.modifiers) {
    return { caseContext: existing, migrated: false };
  }

  const legacyCamel = data['case' + 'Type'];
  const legacySnake = data['case_' + 'type'];
  const hasLegacyType = legacyCamel !== undefined || legacySnake !== undefined;
  if (!hasLegacyType) {
    return { caseContext: deriveCaseContext(data), migrated: false };
  }

  return {
    caseContext: deriveCaseContext(data, { legacyCaseType: legacyCamel ?? legacySnake }),
    migrated: true,
  };
}

export function getRoutingVariant(caseContext) {
  if (!caseContext?.modifiers) return 'standard';
  if (caseContext.modifiers.full_arch) return 'full_arch';
  if (caseContext.modifiers.sinus) return 'sinus';
  if (caseContext.modifiers.esthetic) return 'esthetic';
  if (caseContext.modifiers.immediate) return 'immediate';
  return 'standard';
}
