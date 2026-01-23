import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateCasePDF = (caseData, variant = 'dentist') => {
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
  doc.text('Implant Case Summary', 14, 22);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 22, { align: 'right' });
  doc.text(variant === 'lab' ? 'Lab Copy' : 'Dentist Copy', pageWidth - 14, 28, { align: 'right' });
  
  yPos = 45;
  
  // Case Info Section
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
  
  // Planning Data Section
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
      ['Restorative Context:', caseData.planningData.restorativeContext || '-'],
    ];
    
    planningData.forEach(([label, value]) => {
      doc.setTextColor(...mutedColor);
      doc.text(label, 14, yPos);
      doc.setTextColor(...textColor);
      doc.text(value, 60, yPos);
      yPos += 6;
    });
    
    if (caseData.planningData.systemicModifiers?.length > 0) {
      doc.setTextColor(...mutedColor);
      doc.text('Systemic Modifiers:', 14, yPos);
      doc.setTextColor(...textColor);
      doc.text(caseData.planningData.systemicModifiers.join(', '), 60, yPos);
      yPos += 6;
    }
  }
  
  yPos += 10;
  
  // Risk Assessment Section
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
    doc.text(`Overall: ${caseData.riskAssessment.overallRisk.toUpperCase()}`, 16, yPos + 2);
    yPos += 12;
    
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(caseData.riskAssessment.plainLanguageSummary, pageWidth - 28);
    doc.text(summaryLines, 14, yPos);
    yPos += summaryLines.length * 5 + 8;
    
    if (caseData.riskAssessment.considerations?.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Considerations:', 14, yPos);
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
  
  // Checklists Section
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
      doc.setTextColor(item.completed ? ...primaryColor : ...mutedColor);
      doc.text(checkbox, 14, yPos);
      doc.setTextColor(...textColor);
      doc.text(item.text, 22, yPos);
      
      if (item.notes && variant === 'dentist') {
        yPos += 4;
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
  
  // Learning Feedback (dentist copy only)
  if (variant === 'dentist' && caseData.feedback?.whatWasUnexpected) {
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
      'Decision support only. Final responsibility lies with the clinician.',
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

export const downloadCasePDF = (caseData, variant = 'dentist') => {
  const doc = generateCasePDF(caseData, variant);
  const filename = `${caseData.caseName.replace(/\s+/g, '_')}_${variant}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};
