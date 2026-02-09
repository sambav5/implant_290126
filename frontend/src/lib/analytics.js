import posthog from "posthog-js";

export const initAnalytics = () => {

  if (!import.meta.env.VITE_POSTHOG_KEY && !import.meta.env.VITE_PUBLIC_POSTHOG_KEY) return;

  const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
  const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY || import.meta.env.VITE_POSTHOG_KEY;

  posthog.init(apiKey, {
    api_host: apiHost,

    autocapture: false,
    capture_pageview: false,

    mask_all_text: true,
    mask_all_element_attributes: true
  });
};

export const trackEvent = (event, props = {}) => {
  posthog.capture(event, props);
};

export const identifyUser = (id) => {
  posthog.identify(id);
};

export const trackPageView = (path) => {
  posthog.capture("$pageview", { path });
};

/* ------------------------------------------------ */
/* Clinical Workflow Tracking */
/* ------------------------------------------------ */

export const trackCaseCreated = (caseData) => {
  posthog.capture("case_created", {
    case_id: caseData.id,
    tooth_number: caseData.toothNumber,
    has_age: !!caseData.optionalAge,
    has_sex: !!caseData.optionalSex,
  });
};

export const trackPlanningCompleted = (caseId, planningData) => {
  posthog.capture("planning_completed", {
    case_id: caseId,
    bone_availability: planningData.boneAvailability,
    esthetic_zone: planningData.estheticZone,
    soft_tissue_biotype: planningData.softTissueBiotype,
    smoking_status: planningData.smokingStatus,
    diabetes_status: planningData.diabetesStatus,
    has_medications: planningData.medications?.length > 0,
  });
};

export const trackRiskAnalysisRun = (caseId, riskData) => {
  posthog.capture("risk_analysis_run", {
    case_id: caseId,
    case_complexity: riskData.caseComplexity,
    implant_timing: riskData.implantTiming,
    immediate_placement_eligible: riskData.immediatePlacementEligible,
    has_risk_modifiers: riskData.riskModifiers?.length > 0,
  });
};

export const trackTreatmentBlueprintCompleted = (caseId, checklistData) => {
  posthog.capture("treatment_blueprint_completed", {
    case_id: caseId,
    total_items: checklistData.totalItems,
    completed_items: checklistData.completedItems,
    completion_percentage: checklistData.percentage,
  });
};

export const trackFeedbackSubmitted = (caseId, feedbackData) => {
  posthog.capture("feedback_submitted", {
    case_id: caseId,
    has_unexpected: !!feedbackData.whatWasUnexpected,
    has_double_check: !!feedbackData.whatToDoubleCheckNextTime,
    has_custom_suggestions: feedbackData.customChecklistSuggestions?.length > 0,
  });
};
