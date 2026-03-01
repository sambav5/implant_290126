import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ============ DENTIST COPY PDF ============
export const generateDentistPDF = (caseData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor = [47, 128, 237];
  const textColor = [31, 41, 55];
  const mutedColor = [100, 116, 139];
  
  let yPos = 20;
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Clinical Case Documentation', 14, 22);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 22, { align: 'right' });
  doc.text('Dentist Copy', pageWidth - 14, 28, { align: 'right' });
  
  yPos = 45;
  
  // ============ SECTION 1: CASE INFORMATION ============
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Case Information', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  
  const caseInfo = [
    ['Case Name:', caseData.caseName],
    ['Tooth Number:', `#${caseData.toothNumber}`],
    ['Status:', caseData.status.replace('_', ' ').toUpperCase()],
    ['Created:', new Date(caseData.createdAt).toLocaleDateString()],
  ];
  
  if (caseData.optionalAge) {
    caseInfo.push(['Patient Age:', `${caseData.optionalAge} years`]);
  }
  if (caseData.optionalSex) {
    caseInfo.push(['Patient Sex:', caseData.optionalSex]);
  }
  
  caseInfo.forEach(([label, value]) => {
    doc.setTextColor(...mutedColor);
    doc.text(label, 14, yPos);
    doc.setTextColor(...textColor);
    doc.text(value || '-', 50, yPos);
    yPos += 6;
  });
  
  yPos += 10;
  
  // ============ SECTION 2: PLANNING DATA ============
  if (caseData.planningData) {
    doc.setTextColor(...textColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Planning Data', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const planningData = [
      ['Bone Availability:', caseData.planningData.boneAvailability || '-'],
      ['Bone Height:', caseData.planningData.boneHeight || '-'],
      ['Bone Width:', caseData.planningData.boneWidth || '-'],
      ['Esthetic Zone:', caseData.planningData.estheticZone || '-'],
      ['Soft Tissue Biotype:', caseData.planningData.softTissueBiotype || '-'],
      ['Restorative Context:', caseData.planningData.restorativeContext?.replace('_', ' ') || '-'],
      ['Smoking Status:', caseData.planningData.smokingStatus || '-'],
      ['Diabetes Status:', caseData.planningData.diabetesStatus || '-'],
    ];
    
    planningData.forEach(([label, value]) => {
      doc.setTextColor(...mutedColor);
      doc.text(label, 14, yPos);
      doc.setTextColor(...textColor);
      doc.text(value, 60, yPos);
      yPos += 6;
    });
    
    if (caseData.planningData.medications?.length > 0) {
      doc.setTextColor(...mutedColor);
      doc.text('Medications:', 14, yPos);
      doc.setTextColor(...textColor);
      doc.text(caseData.planningData.medications.join(', '), 60, yPos);
      yPos += 6;
    }
    
    if (caseData.planningData.additionalNotes) {
      yPos += 4;
      doc.setTextColor(...mutedColor);
      doc.text('Additional Notes:', 14, yPos);
      yPos += 5;
      doc.setTextColor(...textColor);
      const noteLines = doc.splitTextToSize(caseData.planningData.additionalNotes, pageWidth - 28);
      doc.text(noteLines, 14, yPos);
      yPos += noteLines.length * 5;
    }
  }
  
  yPos += 10;
  
  // ============ SECTION 3: RISK ASSESSMENT ============
  if (caseData.riskAssessment) {
    doc.setTextColor(...textColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Risk Assessment', 14, yPos);
    yPos += 8;
    
    const riskColors = {
      low: [16, 185, 129],
      moderate: [245, 158, 11],
      high: [239, 68, 68],
    };
    
    doc.setFillColor(...(riskColors[caseData.riskAssessment.overallRisk] || mutedColor));
    doc.roundedRect(14, yPos - 4, 60, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`Overall: ${caseData.riskAssessment.overallRisk?.toUpperCase() || 'MODERATE'}`, 16, yPos + 2);
    yPos += 12;
    
    // Primary Issue and Complexity
    if (caseData.riskAssessment.primaryIssue) {
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Primary Issue:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(caseData.riskAssessment.primaryIssue, 50, yPos);
      yPos += 6;
    }
    
    if (caseData.riskAssessment.caseComplexity) {
      doc.setFont('helvetica', 'bold');
      doc.text('Complexity:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(caseData.riskAssessment.caseComplexity, 50, yPos);
      yPos += 6;
    }
    
    if (caseData.riskAssessment.implantTiming) {
      doc.setFont('helvetica', 'bold');
      doc.text('Timing:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      const timingLines = doc.splitTextToSize(caseData.riskAssessment.implantTiming, pageWidth - 60);
      doc.text(timingLines, 50, yPos);
      yPos += timingLines.length * 5 + 4;
    }
    
    yPos += 4;
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(caseData.riskAssessment.plainLanguageSummary, pageWidth - 28);
    doc.text(summaryLines, 14, yPos);
    yPos += summaryLines.length * 5 + 8;
    
    if (caseData.riskAssessment.considerations?.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Clinical Considerations:', 14, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      caseData.riskAssessment.considerations.forEach((consideration) => {
        const lines = doc.splitTextToSize(`• ${consideration}`, pageWidth - 32);
        doc.text(lines, 18, yPos);
        yPos += lines.length * 5 + 2;
      });
    }
  }
  
  // Check if we need a new page for checklists
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  
  yPos += 10;
  
  // ============ SECTION 4-6: CHECKLISTS ============
  const renderChecklist = (title, items) => {
    if (!items || items.length === 0) return;
    
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setTextColor(...textColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, yPos);
    yPos += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    items.forEach((item) => {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }
      
      const checkbox = item.completed ? '☑' : '☐';
      doc.setTextColor(...(item.completed ? primaryColor : mutedColor));
      doc.text(checkbox, 14, yPos);
      doc.setTextColor(...textColor);
      const textLines = doc.splitTextToSize(item.text, pageWidth - 32);
      doc.text(textLines, 22, yPos);
      yPos += textLines.length * 5;
      
      if (item.notes) {
        yPos += 2;
        doc.setTextColor(...mutedColor);
        doc.setFontSize(8);
        const noteLines = doc.splitTextToSize(`Note: ${item.notes}`, pageWidth - 36);
        doc.text(noteLines, 22, yPos);
        yPos += noteLines.length * 4;
        doc.setFontSize(9);
      }
      
      yPos += 6;
    });
    
    yPos += 6;
  };
  
  renderChecklist('Pre-Treatment Checklist', caseData.preTreatmentChecklist);
  renderChecklist('Treatment Checklist', caseData.treatmentChecklist);
  renderChecklist('Post-Treatment Checklist', caseData.postTreatmentChecklist);
  
  // Learning Feedback
  if (caseData.feedback?.whatWasUnexpected || caseData.feedback?.whatToDoubleCheckNextTime) {
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos += 10;
    doc.setTextColor(...textColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Learning Reflections', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (caseData.feedback.whatWasUnexpected) {
      doc.setTextColor(...mutedColor);
      doc.text('What was unexpected:', 14, yPos);
      yPos += 5;
      doc.setTextColor(...textColor);
      const lines = doc.splitTextToSize(caseData.feedback.whatWasUnexpected, pageWidth - 28);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 5 + 6;
    }
    
    if (caseData.feedback.whatToDoubleCheckNextTime) {
      doc.setTextColor(...mutedColor);
      doc.text('What to double-check next time:', 14, yPos);
      yPos += 5;
      doc.setTextColor(...textColor);
      const lines = doc.splitTextToSize(caseData.feedback.whatToDoubleCheckNextTime, pageWidth - 28);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 5 + 6;
    }
  }
  
  // Footer disclaimer on each page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(
      'Decision support only. Final clinical responsibility lies with the treating clinician.',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - 14,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
  }
  
  return doc;
};

// ============ LAB COPY PDF ============
export const generateLabPDF = (caseData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors - Using green theme for lab copy to differentiate
  const labColor = [16, 185, 129]; // Green
  const textColor = [31, 41, 55];
  const mutedColor = [100, 116, 139];
  
  let yPos = 20;
  
  // Header
  doc.setFillColor(...labColor);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Prosthetic Fabrication Order', 14, 22);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 14, 22, { align: 'right' });
  doc.text('Lab Copy', pageWidth - 14, 28, { align: 'right' });
  
  yPos = 50;
  
  // ============ SECTION 1: CASE IDENTIFICATION ============
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Case Identification', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const caseId = [
    ['Case Name:', caseData.caseName],
    ['Tooth Number:', `#${caseData.toothNumber}`],
    ['Order Date:', new Date(caseData.createdAt).toLocaleDateString()],
  ];
  
  caseId.forEach(([label, value]) => {
    doc.setTextColor(...mutedColor);
    doc.text(label, 14, yPos);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text(value || '-', 60, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 7;
  });
  
  yPos += 12;
  
  // ============ SECTION 2: RESTORATION TYPE ============
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Restoration Specification', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const restorationType = caseData.planningData?.restorativeContext || 'Not specified';
  const restorationMap = {
    'single_crown': 'Single Implant Crown',
    'bridge_abutment': 'Bridge Abutment',
    'overdenture': 'Overdenture Support',
    'fixed_prosthesis': 'Fixed Full Arch Prosthesis',
  };
  
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, yPos - 4, pageWidth - 28, 12, 2, 2, 'F');
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(restorationMap[restorationType] || restorationType, 18, yPos + 4);
  yPos += 16;
  
  // ============ SECTION 3: IMPLANT SITE NOTES ============
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Implant Site Notes', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const siteNotes = [
    ['Location:', `Tooth #${caseData.toothNumber}`],
    ['Esthetic Zone:', caseData.planningData?.estheticZone?.toUpperCase() || 'Not specified'],
    ['Adjacent Teeth:', caseData.planningData?.adjacentTeeth || 'Not specified'],
  ];
  
  siteNotes.forEach(([label, value]) => {
    doc.setTextColor(...mutedColor);
    doc.text(label, 14, yPos);
    doc.setTextColor(...textColor);
    doc.text(value, 60, yPos);
    yPos += 6;
  });
  
  yPos += 12;
  
  // ============ SECTION 4: PROSTHETIC INSTRUCTIONS ============
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Prosthetic Instructions', 14, yPos);
  yPos += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Retention Type
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, yPos - 4, pageWidth - 28, 10, 2, 2, 'F');
  doc.setTextColor(...mutedColor);
  doc.text('Retention Type:', 18, yPos + 2);
  doc.setTextColor(...textColor);
  doc.text('Screw-retained (confirm with clinician)', 80, yPos + 2);
  yPos += 14;
  
  // Emergence Profile
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, yPos - 4, pageWidth - 28, 10, 2, 2, 'F');
  doc.setTextColor(...mutedColor);
  doc.text('Emergence Profile:', 18, yPos + 2);
  doc.setTextColor(...textColor);
  const estheticHigh = caseData.planningData?.estheticZone === 'high';
  doc.text(estheticHigh ? 'Critical - confirm ideal contour with clinician' : 'Standard profile (clinician to confirm)', 80, yPos + 2);
  yPos += 14;
  
  // Margin Depth
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, yPos - 4, pageWidth - 28, 10, 2, 2, 'F');
  doc.setTextColor(...mutedColor);
  doc.text('Margin Depth:', 18, yPos + 2);
  doc.setTextColor(...textColor);
  doc.text('Per clinician instruction', 80, yPos + 2);
  yPos += 14;
  
  // Provisional Required
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, yPos - 4, pageWidth - 28, 10, 2, 2, 'F');
  doc.setTextColor(...mutedColor);
  doc.text('Provisional Required:', 18, yPos + 2);
  doc.setTextColor(...textColor);
  doc.text(estheticHigh ? 'Yes - esthetic zone' : 'Confirm with clinician', 80, yPos + 2);
  yPos += 16;
  
  // ============ SECTION 5: ADDITIONAL LAB NOTES ============
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Additional Lab Notes', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (caseData.planningData?.additionalNotes) {
    const noteLines = doc.splitTextToSize(caseData.planningData.additionalNotes, pageWidth - 28);
    doc.setTextColor(...textColor);
    doc.text(noteLines, 14, yPos);
    yPos += noteLines.length * 5 + 8;
  } else {
    doc.setTextColor(...mutedColor);
    doc.setFont('helvetica', 'italic');
    doc.text('No additional notes provided.', 14, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 8;
  }
  
  if (caseData.planningData?.occlusion) {
    yPos += 4;
    doc.setTextColor(...mutedColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Occlusal Notes:', 14, yPos);
    yPos += 5;
    const occlusionLines = doc.splitTextToSize(caseData.planningData.occlusion, pageWidth - 28);
    doc.setTextColor(...textColor);
    doc.text(occlusionLines, 14, yPos);
    yPos += occlusionLines.length * 5;
  }
  
  yPos += 15;
  
  // ============ LAB DISCLAIMER ============
  doc.setFillColor(255, 250, 230);
  doc.roundedRect(14, yPos - 4, pageWidth - 28, 28, 2, 2, 'F');
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTANT LAB NOTICE:', 18, yPos + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  const disclaimerText = 'This order is for prosthetic fabrication only. The laboratory assumes no clinical responsibility. All measurements, specifications, and clinical decisions remain the sole responsibility of the treating clinician. Confirm all details before proceeding with fabrication.';
  const disclaimerLines = doc.splitTextToSize(disclaimerText, pageWidth - 40);
  doc.text(disclaimerLines, 18, yPos + 8);
  
  // Footer on each page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(
      'For prosthetic fabrication only - No clinical responsibility',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - 14,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
  }
  
  return doc;
};

// ============ DOWNLOAD FUNCTIONS ============
export const downloadDentistPDF = (caseData) => {
  const doc = generateDentistPDF(caseData);
  const filename = `${caseData.caseName.replace(/\s+/g, '_')}_Dentist_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

export const downloadLabPDF = (caseData) => {
  const doc = generateLabPDF(caseData);
  const filename = `${caseData.caseName.replace(/\s+/g, '_')}_Lab_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

// Legacy function for backward compatibility
export const downloadCasePDF = (caseData, variant = 'dentist') => {
  if (variant === 'lab') {
    downloadLabPDF(caseData);
  } else {
    downloadDentistPDF(caseData);
  }
};
